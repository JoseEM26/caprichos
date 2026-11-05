import {
  cerrarValidarPagoDePedido,
  motivoSalidaValidarPago,
  pedidoIdDePago,
  sacarDeValidarPago,
} from '../validar-pago-salida.util';

const AHORA = new Date('2026-11-05T18:30:00Z');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60000);
const pedidoPendiente = (extra: Record<string, unknown> = {}) => ({
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  creado_en: hace(5),
  ...extra,
});

describe('motivoSalidaValidarPago (regla única de VALIDAR_PAGO)', () => {
  it('pedido inexistente -> sale', () => {
    expect(motivoSalidaValidarPago(null, { timestampUltimoVoucher: AHORA.getTime() }, AHORA, 30)).toBe('el pedido ya no existe');
  });

  it.each(['ANULADO', 'ENTREGADO', 'CANCELADO'])('pedido %s -> sale', (estado) => {
    expect(motivoSalidaValidarPago(pedidoPendiente({ estado }), { timestampUltimoVoucher: 1 }, AHORA, 30)).toBe(
      `el pedido está ${estado}`,
    );
  });

  it.each(['PAGADO', 'COORDINADO'])('pago %s (Caja ya decidió) -> sale aunque haya voucher', (pago) => {
    expect(
      motivoSalidaValidarPago(pedidoPendiente({ pago_estado: pago }), { timestampUltimoVoucher: AHORA.getTime() }, AHORA, 30),
    ).toBe(`el pago está ${pago}`);
  });

  it('pedido PENDIENTE con voucher enviado y sin vencer -> sigue en espera', () => {
    expect(
      motivoSalidaValidarPago(pedidoPendiente(), { timestampUltimoVoucher: AHORA.getTime() }, AHORA, 30),
    ).toBeNull();
  });

  it('pedido en COLA/PREPARANDO/LISTO sin pagar con voucher -> sigue en espera (solo Caja decide)', () => {
    for (const estado of ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO']) {
      expect(
        motivoSalidaValidarPago(pedidoPendiente({ estado }), { timestampUltimoVoucher: AHORA.getTime() }, AHORA, 30),
      ).toBeNull();
    }
  });

  it('sin voucher y pasado el plazo de espera -> sale por vencimiento', () => {
    expect(motivoSalidaValidarPago(pedidoPendiente({ creado_en: hace(45) }), {}, AHORA, 30)).toBe(
      'venció la espera de pago (30 min)',
    );
  });

  it('sin voucher dentro del plazo -> sigue en espera', () => {
    expect(motivoSalidaValidarPago(pedidoPendiente({ creado_en: hace(10) }), {}, AHORA, 30)).toBeNull();
  });

  it('sin voucher con expiraMin 0 (sin vencimiento) -> sigue en espera', () => {
    expect(motivoSalidaValidarPago(pedidoPendiente({ creado_en: hace(500) }), {}, AHORA, 0)).toBeNull();
  });

  it('con voucher enviado nunca vence por tiempo', () => {
    expect(
      motivoSalidaValidarPago(pedidoPendiente({ creado_en: hace(500) }), { timestampUltimoVoucher: AHORA.getTime() }, AHORA, 30),
    ).toBeNull();
  });

  it('pago en blanco (pago_estado null) no cuenta como cerrado', () => {
    expect(motivoSalidaValidarPago(pedidoPendiente({ pago_estado: null }), { timestampUltimoVoucher: 1 }, AHORA, 30)).toBeNull();
  });
});

describe('pedidoIdDePago', () => {
  it('devuelve el id numérico marcado en flujo.pago', () => {
    expect(pedidoIdDePago({ pago: { pedidoId: '42' } })).toBe(42n);
    expect(pedidoIdDePago({ pago: { pedidoId: 42 } })).toBe(42n);
  });

  it('sin pedido, flujo nulo o id no numérico -> null', () => {
    expect(pedidoIdDePago({ pago: {} })).toBeNull();
    expect(pedidoIdDePago(null)).toBeNull();
    expect(pedidoIdDePago({ pago: { pedidoId: 'CP-W019' } })).toBeNull();
  });
});

function prismaConConversaciones(conversaciones: any[]) {
  return {
    conversacion: {
      findMany: jest.fn().mockResolvedValue(conversaciones),
      update: jest.fn().mockResolvedValue({}),
    },
    mensajeChat: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

describe('sacarDeValidarPago', () => {
  it('sin persona: vuelve al bot, MENU, quita urgente y deja mensaje de sistema', async () => {
    const prisma = prismaConConversaciones([]);
    const res = await sacarDeValidarPago(
      prisma,
      { id: 7n, tomado_por: null, motivo_derivacion: 'VOUCHER' },
      { estado: 'VALIDAR_PAGO', pago: { pedidoId: '5' } },
      'el pedido está ENTREGADO',
    );
    expect(res.flujo.estado).toBe('MENU');
    expect(res.flujo.pago).toEqual({ pedidoId: '5' });
    expect(prisma.conversacion.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: expect.objectContaining({ estado: 'MENU', duenio: 'BOT', urgente: false, motivo_derivacion: null }),
    });
    expect(prisma.mensajeChat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversacion_id: 7n,
        tipo: 'SISTEMA',
        contenido: { texto: 'La conversación salió de «Validar pago»: el pedido está ENTREGADO.' },
      }),
    });
  });

  it('tomada por una persona: no toca el dueño ni el urgente', async () => {
    const prisma = prismaConConversaciones([]);
    await sacarDeValidarPago(prisma, { id: 7n, tomado_por: 3n }, { estado: 'VALIDAR_PAGO' }, 'x');
    const data = prisma.conversacion.update.mock.calls[0][0].data;
    expect(data).toEqual({ estado: 'MENU', flujo: { estado: 'MENU' } });
  });

  it('derivada por calificación baja: conserva su motivo', async () => {
    const prisma = prismaConConversaciones([]);
    await sacarDeValidarPago(prisma, { id: 7n, tomado_por: null, motivo_derivacion: 'CALIFICACION_BAJA' }, {}, 'x');
    const data = prisma.conversacion.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('duenio');
    expect(data).not.toHaveProperty('motivo_derivacion');
  });
});

describe('cerrarValidarPagoDePedido (cierre silencioso desde Caja)', () => {
  const enEspera = (id: bigint, pedidoId: string) => ({
    id,
    flujo: { estado: 'VALIDAR_PAGO', pago: { pedidoId } },
    tomado_por: null,
    motivo_derivacion: null,
  });

  it('cierra solo las conversaciones ligadas a ese pedido y no envía nada al cliente', async () => {
    const prisma = prismaConConversaciones([enEspera(1n, '100'), enEspera(2n, '200')]);
    const emitir = { emitirAdmin: jest.fn() };
    const cerradas = await cerrarValidarPagoDePedido(prisma, 100n, 'Caja registró el cobro', emitir);
    expect(cerradas).toEqual([1n]);
    expect(prisma.conversacion.update).toHaveBeenCalledTimes(1);
    expect(prisma.conversacion.update.mock.calls[0][0].where).toEqual({ id: 1n });
    expect(emitir.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '1' });
  });

  it('es idempotente: una segunda llamada no encuentra nada que cerrar', async () => {
    const prisma = prismaConConversaciones([enEspera(1n, '100')]);
    await cerrarValidarPagoDePedido(prisma, 100n, 'Caja registró el cobro');
    prisma.conversacion.findMany.mockResolvedValueOnce([]);
    expect(await cerrarValidarPagoDePedido(prisma, 100n, 'Caja registró el cobro')).toEqual([]);
    expect(prisma.conversacion.update).toHaveBeenCalledTimes(1);
  });

  it('si la base falla no lanza error (el cobro no se deshace)', async () => {
    const prisma = prismaConConversaciones([]);
    prisma.conversacion.findMany.mockRejectedValueOnce(new Error('BD caída'));
    await expect(cerrarValidarPagoDePedido(prisma, 100n, 'x')).resolves.toEqual([]);
  });

  it('una conversación sin pedido marcado no se toca', async () => {
    const prisma = prismaConConversaciones([{ id: 3n, flujo: { estado: 'VALIDAR_PAGO' }, tomado_por: null }]);
    expect(await cerrarValidarPagoDePedido(prisma, 100n, 'x')).toEqual([]);
    expect(prisma.conversacion.update).not.toHaveBeenCalled();
  });
});
