jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';

/**
 * Los avisos ya no llaman a Meta: se encolan en el outbox dentro de la transacción del cambio de estado.
 * El envío (texto libre o plantilla según la ventana de 24 h) lo prueba outbox-whatsapp.service.spec.ts.
 */
describe('AvisosPedidoService (avisos de reparto al cliente, encolados en el outbox)', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let pedido: any;
  let parametros: Record<string, unknown>;

  beforeEach(() => {
    pedido = {
      id: BigInt(77),
      codigo: 'CP-077',
      cliente_nombre: 'Marta',
      cliente_telefono: '987654321',
      modalidad: 'DELIVERY',
      total: 30,
      pago_metodo: 'EFECTIVO',
      pago_preferido: 'EFECTIVO',
    };
    parametros = { tiempo_prometido_min: 25 };

    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido) },
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => ({ valor: parametros[where.clave] ?? 'si' })),
      },
      mensajeReparto: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      conversacion: {
        upsert: jest.fn().mockResolvedValue({ id: BigInt(5), flujo: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    outbox = {
      encolar: jest.fn().mockResolvedValue(true),
      despertar: jest.fn(),
    };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  it('encola el aviso con clave pedido-<id>-<ETAPA> y marca la etapa PENDIENTE, en la misma transacción', async () => {
    const res = await servicio.avisar(77, 'LLEGADA');

    expect(res.estado).toBe('ENCOLADO');
    expect(prisma.mensajeReparto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pedido_id: BigInt(77), numero: 2, estado: 'PENDIENTE' }),
    });
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({
        telefono: '51987654321',
        tipo: 'TEXTO',
        clave: 'pedido-77-LLEGADA',
        origen: 'AVISO_PEDIDO',
        carga: expect.objectContaining({
          plantillaClave: expect.any(String),
          repartoNumero: 2,
          pedidoCodigo: 'CP-077',
          etapa: 'LLEGADA',
          autor: 'BOT',
        }),
      }),
      expect.anything(),
    );
  });

  it('sin transacción propia: abre una y despierta el envío al confirmarla', async () => {
    await servicio.avisar(77, 'LLEGADA');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(outbox.despertar).toHaveBeenCalledTimes(1);
  });

  it('con transacción ajena: encola dentro de ella y no despierta (lo hace el emisor tras el commit)', async () => {
    const tx = { ...prisma, mensajeReparto: prisma.mensajeReparto };
    await servicio.avisar(77, 'LLEGADA', {}, tx as any);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.encolar).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(outbox.despertar).not.toHaveBeenCalled();
  });

  it('idempotente: si la etapa ya existe en mensaje_reparto no encola nada', async () => {
    prisma.mensajeReparto.findUnique.mockResolvedValueOnce({ numero: 2 });
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('YA_ENVIADO');
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
  });

  it('carrera (P2002 al crear la etapa): se trata como ya encolado', async () => {
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('YA_ENVIADO');
  });

  it('parámetro apagado: no encola ni registra la etapa', async () => {
    parametros.whatsapp_aviso_llegada_activo = 'no';
    prisma.parametro.findUnique.mockImplementation(async ({ where }: any) =>
      where.clave === 'whatsapp_aviso_llegada_activo' ? { valor: 'no' } : { valor: 'si' },
    );
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.create).not.toHaveBeenCalled();
  });

  it('pedido que no es delivery o sin teléfono: se omite sin encolar', async () => {
    pedido.modalidad = 'RECOJO';
    expect((await servicio.avisar(77, 'LLEGADA')).motivo).toBe('NO_ES_DELIVERY');
    pedido.modalidad = 'DELIVERY';
    pedido.cliente_telefono = '';
    expect((await servicio.avisar(77, 'LLEGADA')).motivo).toBe('SIN_TELEFONO');
    expect(outbox.encolar).not.toHaveBeenCalled();
  });

  it('pago digital en RECIBIDO: pasa la conversación a una persona y encola el aviso de voucher', async () => {
    pedido.pago_metodo = 'YAPE';
    pedido.pago_preferido = 'YAPE';
    const res = await servicio.avisar(77, 'RECIBIDO');
    expect(res.estado).toBe('ENCOLADO');
    expect(prisma.conversacion.upsert).toHaveBeenCalled();
    expect(outbox.encolar).toHaveBeenCalledWith(
      expect.objectContaining({ carga: expect.objectContaining({ etapa: 'RECIBIDO' }) }),
      expect.anything(),
    );
  });

  it('retiro: el texto dice el monto exacto antes del SÍ/NO', async () => {
    await servicio.avisar(77, 'RETIRO', { recargo: 5, recargoModo: 'FIJO' });
    const carga = outbox.encolar.mock.calls[0][0].carga;
    expect(carga.textoLibre).toContain('S/ 5.00');
    expect(carga.repartoNumero).toBe(5);
  });

  it('un error al encolar fuera de transacción no se propaga: el resultado es FALLIDO', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('BD caída'));
    const res = await servicio.avisar(77, 'LLEGADA');
    expect(res.estado).toBe('FALLIDO');
  });

  it('dentro de una transacción ajena el error se propaga para que esa transacción se deshaga', async () => {
    outbox.encolar.mockRejectedValueOnce(new Error('BD caída'));
    await expect(servicio.avisar(77, 'LLEGADA', {}, prisma as any)).rejects.toThrow('BD caída');
  });
});

describe('AvisosPedidoService: puntos en los avisos de la carta', () => {
  let servicio: AvisosPedidoService;
  let prisma: any;
  let outbox: any;
  let marcas: Set<string>;
  let parametrosPuntos: Record<string, unknown>;

  beforeEach(() => {
    process.env.CARTA_URL_PUBLICA = 'https://carta.test';
    marcas = new Set<string>();
    parametrosPuntos = { whatsapp_aviso_bienvenida_puntos_activo: 'si', whatsapp_aviso_puntos_ganados_activo: 'si' };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: {
        findUnique: jest.fn(async () => ({
          id: BigInt(90),
          codigo: 'CP-090',
          cliente_nombre: 'Lucia',
          cliente_telefono: '987654321',
          modalidad: 'DELIVERY',
          total: 30,
          pago_metodo: 'EFECTIVO',
          pago_preferido: 'EFECTIVO',
          canal: 'CARTA',
          party_id: BigInt(500),
          cliente_party_id: BigInt(500),
          puntos_ganados: 12.5,
        })),
      },
      parametro: { findUnique: jest.fn(async ({ where }: any) => ({ valor: parametrosPuntos[where.clave] ?? 'si' })) },
      mensajeReparto: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      avisoClienteUnico: {
        // Primer aviso del celular: la marca se inserta; después ya existe y no se vuelve a insertar
        createMany: jest.fn(async ({ data }: any) => {
          const clave = `${data.telefono}:${data.aviso}`;
          if (marcas.has(clave)) return { count: 0 };
          marcas.add(clave);
          return { count: 1 };
        }),
      },
      customerDetail: { findFirst: jest.fn(async () => ({ puntos: 40 })) },
    };
    outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    servicio = new AvisosPedidoService(prisma, outbox);
  });

  afterEach(() => {
    delete process.env.CARTA_URL_PUBLICA;
  });

  const cargaEncolada = () => outbox.encolar.mock.calls.at(-1)[0].carga;

  it('primer pedido de un celular: RECIBIDO con la línea de puntos y el enlace, en plantilla con variable', async () => {
    const r = await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(r.estado).toBe('ENCOLADO');
    expect(cargaEncolada().textoLibre).toContain('Ya sumas puntos con este número. Ve tus puntos aquí: https://carta.test/?puntos=1');
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_BIENVENIDA_PUNTOS');
    expect(cargaEncolada().variablesPlantilla).toEqual(['Lucia', 'CP-090', 'https://carta.test/?puntos=1']);
    expect(prisma.avisoClienteUnico.createMany).toHaveBeenCalledWith({ data: { telefono: '987654321', aviso: 'BIENVENIDA_PUNTOS' }, skipDuplicates: true });
  });

  it('segundo pedido del mismo celular: RECIBIDO normal, sin la línea de puntos', async () => {
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().textoLibre).not.toContain('Ya sumas puntos');
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
  });

  it('con el parámetro en «no» el RECIBIDO sale como siempre y no marca nada', async () => {
    parametrosPuntos.whatsapp_aviso_bienvenida_puntos_activo = 'no';
    await servicio.avisar(90, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().plantillaClave).toBe('CARTA_RECIBIDO_EFECTIVO');
    expect(prisma.avisoClienteUnico.createMany).not.toHaveBeenCalled();
  });

  it('pedido sin cliente con cuenta o de invitado: sin línea de puntos', async () => {
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(91), codigo: 'CP-091', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: null, cliente_party_id: null, puntos_ganados: 0,
    }));
    await servicio.avisar(91, 'RECIBIDO', {}, undefined);
    expect(cargaEncolada().textoLibre).not.toContain('Ya sumas puntos');
  });

  it('ENTREGADO de un pedido que sumó puntos: agrega «Ganaste N puntos. Total: M» con plantilla de puntos', async () => {
    await servicio.avisar(90, 'ENTREGADO');
    expect(cargaEncolada().textoLibre).toContain('Ganaste 12.5 puntos. Total: 40.');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO_PUNTOS');
    expect(cargaEncolada().variablesPlantilla).toEqual(['Lucia', 'CP-090', '12.5', '40']);
  });

  it('ENTREGADO sin puntos ganados o con el parámetro apagado: aviso normal', async () => {
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(92), codigo: 'CP-092', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: BigInt(500), cliente_party_id: BigInt(500), puntos_ganados: 0,
    }));
    await servicio.avisar(92, 'ENTREGADO');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO');
    parametrosPuntos.whatsapp_aviso_puntos_ganados_activo = 'no';
    prisma.pedido.findUnique = jest.fn(async () => ({
      id: BigInt(93), codigo: 'CP-093', cliente_nombre: 'Rosa', cliente_telefono: '987654321', modalidad: 'DELIVERY', total: 20,
      pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', canal: 'CARTA', party_id: BigInt(500), cliente_party_id: BigInt(500), puntos_ganados: 5,
    }));
    await servicio.avisar(93, 'ENTREGADO');
    expect(cargaEncolada().plantillaClave).toBe('DELIVERY_ENTREGADO');
  });
});
