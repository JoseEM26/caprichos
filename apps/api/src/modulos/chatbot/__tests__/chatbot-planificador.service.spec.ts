jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ChatbotPlanificadorService } from '../servicios/chatbot-planificador.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

describe('ChatbotPlanificadorService (avisos por tiempo)', () => {
  let planificador: ChatbotPlanificadorService;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockVentana24h: any;
  let mockAvisos: any;
  let mockEventos: any;

  const parametros = (valores: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = {
      whatsapp_aviso_salida_activo: 'si',
      whatsapp_aviso_llegada_activo: 'si',
      whatsapp_aviso_espera_activo: 'si',
      whatsapp_aviso_recojo_activo: 'si',
      whatsapp_aviso_pago_confirmado_activo: 'si',
      whatsapp_aviso_listo_activo: 'si',
      whatsapp_aviso_entregado_activo: 'si',
      whatsapp_aviso_encuesta_activo: 'si',
      reparto_insistencia_min: 3,
      reparto_espera_max_min: 10,
      reparto_recargo_reprogramacion: 5,
      ...valores,
    };
    return Object.entries(base).map(([clave, valor]) => ({ clave, valor }));
  };

  beforeEach(() => {
    const redisCliente = { set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1) };
    mockRedisService = { obtenerCliente: jest.fn().mockReturnValue(redisCliente) };

    mockPrisma = {
      parametro: { findMany: jest.fn().mockResolvedValue(parametros()) },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      whatsappMensaje: { findFirst: jest.fn().mockResolvedValue(null) },
      notificacion: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
      incidenteEntrega: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
      },
      pedidoEstadoHistorial: { create: jest.fn().mockResolvedValue({}) },
      mensajeReparto: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
      encuestaPosventa: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
    };
    // Transacción interactiva: ejecuta el callback con el mismo cliente falso
    mockPrisma.$transaction = jest.fn(async (fn: any) =>
      fn({
        ...mockPrisma,
        pedido: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }),
    );

    mockVentana24h = {
      tieneConsentimiento: jest.fn().mockResolvedValue(true),
      enviarMensajeNegocio: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };

    mockAvisos = {
      avisar: jest.fn().mockResolvedValue({ estado: 'ENVIADO' }),
    };

    mockEventos = { emitirAdmin: jest.fn() };

    planificador = new ChatbotPlanificadorService(
      mockPrisma as PrismaService,
      mockRedisService as RedisService,
      mockVentana24h as Ventana24hService,
      mockEventos as EventosGateway,
      undefined,
      mockAvisos as AvisosPedidoService,
    );
  });

  afterEach(() => {
    planificador.detener();
    jest.clearAllMocks();
  });

  const pedidoEnPuerta = (minutos: number, extra: Record<string, unknown> = {}) => ({
    id: BigInt(13),
    codigo: 'CP-104',
    modalidad: 'DELIVERY',
    estado: 'EN_CAMINO',
    pago_estado: 'PENDIENTE',
    cliente_telefono: '51987654321',
    cliente_nombre: 'Luis',
    repartidor_party_id: BigInt(7),
    llego_en: new Date(Date.now() - minutos * 60000),
    entregado_en: null,
    creado_en: new Date(),
    ...extra,
  });

  it('omite ejecución si otra instancia ya posee el bloqueo distribuido', async () => {
    const redis = mockRedisService.obtenerCliente();
    redis.set.mockResolvedValueOnce(null);

    const res = await planificador.ejecutarCiclo();

    expect(res.bloqueadoPorOtraInstancia).toBe(true);
    expect(mockAvisos.avisar).not.toHaveBeenCalled();
  });

  it('no avisa a clientes con consentimiento revocado (BAJA)', async () => {
    mockVentana24h.tieneConsentimiento.mockResolvedValue(false);
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(20)]);

    await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('insistencia: avisa a los reparto_insistencia_min minutos en puerta con los minutos exactos', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(4)]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosInsistencia).toBe(1);
    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(13), 'INSISTENCIA', { minutos: 4 });
  });

  it('insistencia: no avisa antes del umbral', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(2)]);

    await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).not.toHaveBeenCalledWith(expect.anything(), 'INSISTENCIA', expect.anything());
  });

  it('parámetro de espera apagado: no avisa espera ni retira aunque pase el tiempo', async () => {
    mockPrisma.parametro.findMany.mockResolvedValueOnce(parametros({ whatsapp_aviso_espera_activo: 'no' }));
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(30)]);

    const res = await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).not.toHaveBeenCalledWith(expect.anything(), 'ESPERA_AGOTADA', expect.anything());
    expect(mockAvisos.avisar).not.toHaveBeenCalledWith(expect.anything(), 'RETIRO', expect.anything());
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(res.retiros).toBe(0);
  });

  it('espera agotada: avisa al cliente con el recargo y notifica a Caja una sola vez', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(11)]);

    const res = await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(13), 'ESPERA_AGOTADA', { recargo: 5 });
    expect(res.avisosEspera).toBe(1);
    expect(mockPrisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'ESPERA_AGOTADA', rol_destino: 'CAJERO' }) }),
    );
  });

  it('espera agotada ya enviada (YA_ENVIADO): no vuelve a notificar a Caja', async () => {
    mockAvisos.avisar.mockResolvedValue({ estado: 'YA_ENVIADO' });
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(11)]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosEspera).toBe(0);
    expect(mockPrisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('retiro: tras espera máxima + gracia retira la movilidad, registra incidente con recargo y avisa al cliente', async () => {
    // 10 (espera) + 3 (insistencia) = 13 minutos; llegó hace 14
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(14)]);

    const res = await planificador.ejecutarCiclo();

    expect(res.retiros).toBe(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.incidenteEntrega.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ motivo: 'NO_CONTESTA', intento: 1, recargo: 5 }),
      }),
    );
    expect(mockPrisma.mensajeReparto.deleteMany).toHaveBeenCalledWith({
      where: { pedido_id: BigInt(13), numero: { in: [1, 2, 3, 4, 5, 10] } },
    });
    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(13), 'RETIRO', { recargo: 5 });
    expect(mockEventos.emitirAdmin).toHaveBeenCalledWith('reparto:incidente', expect.anything());
  });

  it('retiro: si el pedido ya no está en puerta con ese repartidor (updateMany sin filas) no avisa ni registra', async () => {
    mockPrisma.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        ...mockPrisma,
        pedido: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }),
    );
    mockPrisma.pedido.findMany.mockResolvedValueOnce([pedidoEnPuerta(14)]);

    const res = await planificador.ejecutarCiclo();

    expect(res.retiros).toBe(0);
    expect(mockAvisos.avisar).not.toHaveBeenCalledWith(expect.anything(), 'RETIRO', expect.anything());
    expect(mockPrisma.incidenteEntrega.create).not.toHaveBeenCalled();
  });

  it('aceptación: pedido en PREPARANDO o cobrado en COLA dispara el aviso ACEPTADO', async () => {
    mockPrisma.pedido.findMany.mockResolvedValueOnce([
      { id: BigInt(20), codigo: 'CP-200', modalidad: 'DELIVERY', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', cliente_telefono: '987654321', cliente_nombre: 'Ana', creado_en: new Date() },
      { id: BigInt(21), codigo: 'CP-201', modalidad: 'DELIVERY', estado: 'COLA', pago_estado: 'PAGADO', cliente_telefono: '987654321', cliente_nombre: 'Ana', creado_en: new Date() },
      { id: BigInt(22), codigo: 'CP-202', modalidad: 'DELIVERY', estado: 'COLA', pago_estado: 'PENDIENTE', cliente_telefono: '987654321', cliente_nombre: 'Ana', creado_en: new Date() },
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(20), 'ACEPTADO');
    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(21), 'ACEPTADO');
    expect(mockAvisos.avisar).not.toHaveBeenCalledWith(BigInt(22), 'ACEPTADO');
    expect(res.avisosAceptado).toBe(2);
  });

  it('un pedido con error no detiene el ciclo: los demás pedidos en puerta siguen avisándose', async () => {
    mockPrisma.notificacion.create.mockRejectedValueOnce(new Error('FK rol_destino'));
    mockPrisma.pedido.findMany.mockResolvedValueOnce([
      pedidoEnPuerta(11, { id: BigInt(40), codigo: 'CP-400' }),
      pedidoEnPuerta(4, { id: BigInt(41), codigo: 'CP-401' }),
    ]);

    const res = await planificador.ejecutarCiclo();

    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(41), 'INSISTENCIA', { minutos: 4 });
    expect(res.bloqueadoPorOtraInstancia).toBe(false);
  });

  it('pedido para recoger listo: envía la plantilla de recojo una vez', async () => {
    mockPrisma.pedido.findMany
      .mockResolvedValueOnce([]) // delivery
      .mockResolvedValueOnce([
        { id: BigInt(30), codigo: 'CP-300', cliente_nombre: 'Rosa', cliente_telefono: '51987654321' },
      ]);

    const res = await planificador.ejecutarCiclo();

    expect(res.avisosRecojo).toBe(1);
    expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
      '51987654321',
      expect.objectContaining({ plantillaClave: 'PEDIDO_LISTO_RECOJO' }),
      { pedidoId: BigInt(30) },
    );
  });
});
