jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ChatbotPlanificadorService } from '../servicios/chatbot-planificador.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

describe('ChatbotPlanificadorService', () => {
  let planificador: ChatbotPlanificadorService;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockRedisClient: any;
  let mockVentana24h: any;
  let mockEventos: any;

  beforeEach(() => {
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockRedisService = {
      obtenerCliente: jest.fn().mockReturnValue(mockRedisClient),
    };

    mockPrisma = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'whatsapp_aviso_salida_activo', valor: true },
          { clave: 'whatsapp_aviso_llegada_activo', valor: true },
          { clave: 'whatsapp_aviso_espera_activo', valor: true },
          { clave: 'whatsapp_aviso_recojo_activo', valor: true },
          { clave: 'whatsapp_aviso_pago_confirmado_activo', valor: true },
          { clave: 'whatsapp_aviso_encuesta_activo', valor: true },
          { clave: 'reparto_insistencia_min', valor: 3 },
          { clave: 'reparto_espera_max_min', valor: 10 },
          { clave: 'reparto_recargo_reprogramacion', valor: 5 },
          { clave: 'encuesta_espera_min', valor: 30 },
          { clave: 'tiempo_prometido_min', valor: 25 },
        ]),
      },
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      mensajeReparto: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      whatsappMensaje: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      encuestaPosventa: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
    };

    mockVentana24h = {
      tieneConsentimiento: jest.fn().mockResolvedValue(true),
      enviarMensajeNegocio: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };

    mockEventos = {
      emitirAdmin: jest.fn(),
    };

    planificador = new ChatbotPlanificadorService(
      mockPrisma as PrismaService,
      mockRedisService as RedisService,
      mockVentana24h as Ventana24hService,
      mockEventos as EventosGateway,
    );
  });

  afterEach(() => {
    planificador.detener();
    jest.clearAllMocks();
  });

  it('omite ejecución si otra instancia de la API ya posee el bloqueo distribuido en Redis', async () => {
    mockRedisClient.set.mockResolvedValue(null); // No se pudo adquirir el lock

    const res = await planificador.ejecutarCiclo();

    expect(res.bloqueadoPorOtraInstancia).toBe(true);
    expect(mockPrisma.pedido.findMany).not.toHaveBeenCalled();
  });

  it('respeta parámetros apagados y no envía avisos si están inactivos', async () => {
    mockPrisma.parametro.findMany.mockResolvedValue([
      { clave: 'whatsapp_aviso_salida_activo', valor: false },
      { clave: 'whatsapp_aviso_llegada_activo', valor: false },
      { clave: 'whatsapp_aviso_espera_activo', valor: false },
      { clave: 'whatsapp_aviso_pago_confirmado_activo', valor: false },
    ]);

    mockPrisma.pedido.findMany.mockResolvedValue([
      {
        id: BigInt(10),
        codigo: 'CP-100',
        modalidad: 'DELIVERY',
        salio_en: new Date(),
        cliente_telefono: '51987654321',
        cliente_nombre: 'Pedro',
        mensajesReparto: [],
      },
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosSalida).toBe(0);
    expect(mockVentana24h.enviarMensajeNegocio).not.toHaveBeenCalled();
  });

  it('no envía avisos a clientes que han revocado consentimiento (BAJA)', async () => {
    mockVentana24h.tieneConsentimiento.mockResolvedValue(false);

    mockPrisma.pedido.findMany.mockResolvedValue([
      {
        id: BigInt(10),
        codigo: 'CP-100',
        modalidad: 'DELIVERY',
        salio_en: new Date(),
        cliente_telefono: '51987654321',
        cliente_nombre: 'Pedro',
        mensajesReparto: [],
      },
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosSalida).toBe(0);
    expect(mockVentana24h.enviarMensajeNegocio).not.toHaveBeenCalled();
  });

  it('envía Aviso 1 (Salida de delivery) una sola vez y registra mensaje_reparto con numero 1', async () => {
    const pedidoSalio = {
      id: BigInt(10),
      codigo: 'CP-101',
      modalidad: 'DELIVERY',
      salio_en: new Date(),
      cliente_telefono: '51987654321',
      cliente_nombre: 'Maria',
      mensajesReparto: [],
    };

    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoSalio]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosSalida).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'DELIVERY_SALIDA',
      }),
      { pedidoId: BigInt(10) },
    );
    expect(mockPrisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pedido_id: BigInt(10),
        numero: 1,
        estado: 'ENVIADO',
      }),
    });
  });

  it('envía Aviso 2 (Llegada en puerta) cuando llego_en está marcado', async () => {
    const pedidoLlego = {
      id: BigInt(11),
      codigo: 'CP-102',
      modalidad: 'DELIVERY',
      salio_en: new Date(Date.now() - 15 * 60000),
      llego_en: new Date(),
      cliente_telefono: '51987654321',
      cliente_nombre: 'Carlos',
      mensajesReparto: [{ numero: 1 }],
    };

    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoLlego]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosLlegada).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'DELIVERY_LLEGADA',
      }),
      { pedidoId: BigInt(11) },
    );
    expect(mockPrisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pedido_id: BigInt(11),
        numero: 2,
        estado: 'ENVIADO',
      }),
    });
  });

  it('envía Aviso 3 (Insistencia) a los N minutos sin respuesta ni entrega', async () => {
    // Repartidor llegó hace 4 minutos (umbral es 3 min) y aún no se entrega
    const hace4Min = new Date(Date.now() - 4 * 60000);
    const pedidoInsistencia = {
      id: BigInt(12),
      codigo: 'CP-103',
      modalidad: 'DELIVERY',
      salio_en: new Date(Date.now() - 20 * 60000),
      llego_en: hace4Min,
      entregado_en: null,
      cliente_telefono: '51987654321',
      cliente_nombre: 'Ana',
      mensajesReparto: [{ numero: 1 }, { numero: 2 }],
    };

    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoInsistencia]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosInsistencia).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'DELIVERY_INSISTENCIA',
      }),
      { pedidoId: BigInt(12) },
    );
    expect(mockPrisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pedido_id: BigInt(12),
        numero: 3,
        estado: 'ENVIADO',
      }),
    });
  });

  it('avisa retiro por espera agotada tras reparto_espera_max_min y alerta a Caja por campana', async () => {
    // Repartidor llegó hace 11 minutos (umbral es 10 min) y aún no entrega
    const hace11Min = new Date(Date.now() - 11 * 60000);
    const pedidoEsperaAgotada = {
      id: BigInt(13),
      codigo: 'CP-104',
      modalidad: 'DELIVERY',
      salio_en: new Date(Date.now() - 25 * 60000),
      llego_en: hace11Min,
      entregado_en: null,
      cliente_telefono: '51987654321',
      cliente_nombre: 'Luis',
      mensajesReparto: [{ numero: 1 }, { numero: 2 }, { numero: 3 }],
    };

    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEsperaAgotada]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosEspera).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'DELIVERY_ESPERA_AGOTADA',
        botones: expect.arrayContaining([
          expect.objectContaining({ id: 'reprogramar_si' }),
          expect.objectContaining({ id: 'reprogramar_no' }),
        ]),
      }),
      { pedidoId: BigInt(13) },
    );
    expect(mockPrisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rol_destino: 'CAJA',
          titulo: expect.stringContaining('Espera agotada'),
        }),
      }),
    );
  });

  it('envía aviso de pago confirmado cuando Caja valida el comprobante', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([]); // Delivery vacío
    mockPrisma.pedido.findMany.mockResolvedValueOnce([
      {
        id: BigInt(20),
        codigo: 'CP-200',
        cliente_nombre: 'Raquel',
        cliente_telefono: '51987654321',
      },
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosPago).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'PAGO_CONFIRMADO',
        textoLibre: expect.stringContaining('Recibimos tu pago'),
      }),
      { pedidoId: BigInt(20) },
    );
  });

  it('envía aviso de pedido listo para recoger en modalidad RECOJO', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([]); // Delivery
    mockPrisma.pedido.findMany.mockResolvedValueOnce([]); // Pagados
    mockPrisma.pedido.findMany.mockResolvedValueOnce([
      {
        id: BigInt(30),
        codigo: 'CP-300',
        cliente_nombre: 'Mateo',
        cliente_telefono: '51987654321',
      },
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosRecojo).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({
        plantillaClave: 'PEDIDO_LISTO_RECOJO',
        textoLibre: expect.stringContaining('listo para recoger'),
      }),
      { pedidoId: BigInt(30) },
    );
  });
});
