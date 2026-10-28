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
