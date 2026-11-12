jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
// El monto del retiro lo calcula la función única de reparto; aquí se fija en 5 (IGUAL_ENVIO)
jest.mock('../../repartos/recargo-reprogramacion', () => ({
  calcularMontoReprogramacion: jest.fn().mockResolvedValue({ monto: 5, modo: 'IGUAL_ENVIO' }),
}));
import { ChatbotPlanificadorService } from '../servicios/chatbot-planificador.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';

const mockOutbox: any = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), procesarLote: jest.fn().mockResolvedValue({}), limpiar: jest.fn().mockResolvedValue({}) };

describe('ChatbotPlanificadorService (avisos por tiempo)', () => {
  // Reloj fijo (12:00 en Lima): el horario de la encuesta no debe volver las pruebas dependientes de la hora
  const fijarReloj = (iso = '2026-11-12T17:00:00Z') => {
    beforeEach(() => { jest.useFakeTimers({ now: new Date(iso) }); });
    afterEach(() => { jest.useRealTimers(); });
  };
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
      encuestaPosventa: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }), findFirst: jest.fn().mockResolvedValue(null) },
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
      undefined,
      mockOutbox,
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

    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(13), 'ESPERA_AGOTADA');
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
      where: { pedido_id: BigInt(13), numero: { in: [1, 2, 3, 4, 5, 10, 15] } },
    });
    expect(mockAvisos.avisar).toHaveBeenCalledWith(BigInt(13), 'RETIRO', { recargo: 5, recargoModo: 'IGUAL_ENVIO' });
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
    expect(mockOutbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '51987654321',
        clave: 'recojo-30',
        origen: 'RECOJO',
        carga: expect.objectContaining({ plantillaClave: 'PEDIDO_LISTO_RECOJO' }),
      }),
    );
  });

  describe('encuesta posventa en mesa (sin teléfono real no se programa)', () => {
    fijarReloj();
    const pedidoMesa = (extra: Record<string, unknown> = {}) => ({
      id: BigInt(55),
      codigo: 'CP-M055',
      modalidad: 'MESA',
      estado: 'LISTO',
      cliente_nombre: 'Lucía Pérez',
      cliente_telefono: '987654321',
      entregado_en: null,
      entregado_mesa_en: new Date(Date.now() - 40 * 60000),
      ...extra,
    });

    // La consulta de encuestas es la que lleva OR (entregado, entregado en mesa o cobro)
    const conEncuestas = (filas: unknown[]) => {
      mockPrisma.pedido.findMany.mockImplementation(async (args: any) => (args?.where?.OR ? filas : []));
    };

    it('mesa con teléfono real: se programa la encuesta por el outbox, registrada como ENVIADA', async () => {
      conEncuestas([pedidoMesa()]);

      const res = await planificador.ejecutarCiclo();

      expect(res.avisosEncuesta).toBe(1);
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pedido_id: BigInt(55), estado: 'ENVIADA' }) }),
      );
      expect(mockOutbox.encolar).toHaveBeenCalledWith(
        expect.objectContaining({ telefono: '51987654321', clave: 'encuesta-55', origen: 'ENCUESTA' }),
        expect.anything(),
      );
    });

    it('mesa sin teléfono real (relleno 999999999 o vacío): no se programa ni se encola nada', async () => {
      conEncuestas([pedidoMesa({ cliente_telefono: '999999999' }), pedidoMesa({ id: BigInt(56), cliente_telefono: '' })]);

      const res = await planificador.ejecutarCiclo();

      expect(res.avisosEncuesta).toBe(0);
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'OMITIDA', motivo: 'SIN_CELULAR' }) });
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
    });
  });
  describe('encuesta posventa por todos los canales (carta, bot, mozo y caja)', () => {
    fijarReloj();
    const base = (extra: Record<string, unknown> = {}) => ({
      id: BigInt(70),
      codigo: 'CP-E070',
      modalidad: 'DELIVERY',
      estado: 'ENTREGADO',
      cliente_nombre: 'Ana',
      cliente_telefono: '987654321',
      entregado_en: new Date(Date.now() - 40 * 60000),
      entregado_mesa_en: null,
      ...extra,
    });
    const encuestas = () => mockPrisma.pedido.findMany.mock.calls.find((c: any[]) => c[0]?.where?.OR)?.[0];
    const conEncuestas = (filas: unknown[]) => {
      mockPrisma.pedido.findMany.mockImplementation(async (args: any) => (args?.where?.OR ? filas : []));
    };

    it('la consulta cubre entregado (delivery y recojo), mesa (entregado o cobro) y para llevar/recoger cobrado LISTO o ENTREGADO', async () => {
      conEncuestas([]);
      await planificador.ejecutarCiclo();

      const where = encuestas().where;
      expect(where.estado).toEqual({ notIn: ['ANULADO'] });
      expect(where.cliente_telefono).toEqual({ not: null });
      expect(where.es_personal).toBe(false);
      expect(where.encuestaPosventa).toBeNull();
      expect(where.OR).toHaveLength(4);
      expect(where.OR[0]).toEqual({ entregado_en: expect.any(Object) });
      expect(where.OR[1]).toEqual({ modalidad: 'MESA', entregado_mesa_en: expect.any(Object) });
      expect(where.OR[2]).toEqual({ modalidad: 'MESA', cobros: { some: expect.objectContaining({ anulado_en: null }) } });
      expect(where.OR[3]).toEqual({
        modalidad: { notIn: ['DELIVERY', 'MESA'] },
        estado: { in: ['LISTO', 'ENTREGADO'] },
        cobros: { some: expect.objectContaining({ anulado_en: null }) },
      });
    });

    it('envía a cada canal con teléfono real: carta delivery, recojo, bot, mozo en mesa y caja para llevar', async () => {
      conEncuestas([
        base({ id: BigInt(71), codigo: 'CP-D071' }), // carta o bot a domicilio
        base({ id: BigInt(72), codigo: 'CP-R072', modalidad: 'RECOGER', estado: 'ENTREGADO' }), // recojo entregado
        base({ id: BigInt(73), codigo: 'CP-M073', modalidad: 'MESA', estado: 'LISTO', entregado_en: null, entregado_mesa_en: new Date(Date.now() - 40 * 60000) }),
        base({ id: BigInt(74), codigo: 'CP-L074', modalidad: 'RECOGER', estado: 'LISTO', entregado_en: null }), // caja cobró sin cocina
      ]);

      const res = await planificador.ejecutarCiclo();

      expect(res.avisosEncuesta).toBe(4);
      const claves = mockOutbox.encolar.mock.calls.map((c: any[]) => c[0].clave).sort();
      expect(claves).toEqual(['encuesta-71', 'encuesta-72', 'encuesta-73', 'encuesta-74']);
    });

    it('un solo envío por pedido: tras crear la encuesta, el siguiente ciclo ya no la vuelve a traer (encuestaPosventa null)', async () => {
      // Simula la base: la fila creada deja de cumplir encuestaPosventa: null
      const creadas = new Set<bigint>();
      const fila = base({ id: BigInt(75) });
      mockPrisma.pedido.findMany.mockImplementation(async (args: any) =>
        args?.where?.OR && !creadas.has(fila.id) ? [fila] : [],
      );
      mockPrisma.encuestaPosventa.create.mockImplementation(async ({ data }: any) => {
        creadas.add(data.pedido_id);
        return { id: BigInt(1) };
      });

      const primero = await planificador.ejecutarCiclo();
      const segundo = await planificador.ejecutarCiclo();

      expect(primero.avisosEncuesta).toBe(1);
      expect(segundo.avisosEncuesta).toBe(0);
      expect(mockOutbox.encolar).toHaveBeenCalledTimes(1);
      expect(mockOutbox.encolar.mock.calls[0][0].clave).toBe('encuesta-75');
    });

    it('sin consentimiento (BAJA) no se encola nada', async () => {
      mockVentana24h.tieneConsentimiento.mockResolvedValue(false);
      conEncuestas([base({ id: BigInt(76) })]);

      const res = await planificador.ejecutarCiclo();

      expect(res.avisosEncuesta).toBe(0);
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'OMITIDA', motivo: 'SIN_CONSENTIMIENTO' }) });
    });

    it('teléfono relleno 999999999 o vacío no se encuesta aunque la consulta lo traiga', async () => {
      conEncuestas([base({ id: BigInt(77), cliente_telefono: '999999999' }), base({ id: BigInt(78), cliente_telefono: '  ' })]);

      const res = await planificador.ejecutarCiclo();

      expect(res.avisosEncuesta).toBe(0);
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
    });

    it('la encuesta se encola con botones 1/3/5 y la plantilla ENCUESTA_POSVENTA', async () => {
      conEncuestas([base({ id: BigInt(79) })]);

      await planificador.ejecutarCiclo();

      const carga = mockOutbox.encolar.mock.calls[0][0].carga;
      expect(carga.plantillaClave).toBe('ENCUESTA_POSVENTA');
      expect(carga.variablesPlantilla).toEqual(['Ana', 'CP-E070']);
      expect(carga.botones.map((b: any) => b.id)).toEqual(['encuesta:1', 'encuesta:3', 'encuesta:5']);
    });
    it('interruptor apagado: no consulta ni envía', async () => {
      mockPrisma.parametro.findMany.mockResolvedValue(parametros({ whatsapp_aviso_encuesta_activo: 'no' }));
      conEncuestas([base({ id: BigInt(80) })]);
      const res = await planificador.ejecutarCiclo();
      expect(res.avisosEncuesta).toBe(0);
      expect(encuestas()).toBeUndefined();
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
    });

    it('de madrugada (fuera del horario de Lima) espera: no envía ni registra omisión', async () => {
      jest.setSystemTime(new Date('2026-11-13T05:00:00Z')); // 00:00 en Lima
      conEncuestas([base({ id: BigInt(81) })]);
      const res = await planificador.ejecutarCiclo();
      expect(res.avisosEncuesta).toBe(0);
      expect(encuestas()).toBeUndefined();
      expect(mockPrisma.encuestaPosventa.create).not.toHaveBeenCalled();
    });

    it('el horario y la espera salen de los parámetros (con la espera acotada a 5 min como mínimo)', async () => {
      mockPrisma.parametro.findMany.mockResolvedValue(parametros({ encuesta_hora_desde: 13, encuesta_espera_min: 0 }));
      conEncuestas([base({ id: BigInt(82) })]);
      expect((await planificador.ejecutarCiclo()).avisosEncuesta).toBe(0); // 12:00 < 13:00
      expect((await planificador.obtenerParametros()).encuestaEsperaMin).toBe(5);
    });

    it('número bloqueado (spam): se omite con motivo y no se encola', async () => {
      (planificador as any).numeros = { motivoOmision: jest.fn().mockResolvedValue('DESTINO_BLOQUEADO') };
      conEncuestas([base({ id: BigInt(83) })]);
      const res = await planificador.ejecutarCiclo();
      expect(res.avisosEncuesta).toBe(0);
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'OMITIDA', motivo: 'NUMERO_BLOQUEADO' }) });
    });

    it('tope por celular: con una encuesta reciente del mismo celular se omite con motivo', async () => {
      mockPrisma.encuestaPosventa.findFirst.mockResolvedValue({ id: BigInt(9) });
      conEncuestas([base({ id: BigInt(84) })]);
      const res = await planificador.ejecutarCiclo();
      expect(res.avisosEncuesta).toBe(0);
      expect(mockOutbox.encolar).not.toHaveBeenCalled();
      expect(mockPrisma.encuestaPosventa.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado: 'OMITIDA', motivo: 'TOPE_POR_CELULAR' }) });
      const where = mockPrisma.encuestaPosventa.findFirst.mock.calls[0][0].where;
      expect(where.pedido.cliente_telefono.in).toEqual(['987654321', '51987654321']);
    });
  });
});
