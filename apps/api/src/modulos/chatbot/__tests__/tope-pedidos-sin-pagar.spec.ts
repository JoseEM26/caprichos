import { topePedidosSinPagarAlcanzado, MAX_PEDIDOS_SIN_PAGAR_DEFECTO } from '../servicios/tope-pedidos-sin-pagar.util';

describe('Tope de pedidos por WhatsApp sin pagar', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      pedido: { count: jest.fn().mockResolvedValue(0) },
    };
  });

  it('con 3 pedidos digitales sin pagar del número, no deja crear otro', async () => {
    prisma.pedido.count.mockResolvedValue(3);
    await expect(topePedidosSinPagarAlcanzado(prisma, '51987654321')).resolves.toEqual({
      alcanzado: true,
      max: MAX_PEDIDOS_SIN_PAGAR_DEFECTO,
    });
  });

  it('con 2 pedidos sin pagar todavía puede pedir', async () => {
    prisma.pedido.count.mockResolvedValue(2);
    await expect(topePedidosSinPagarAlcanzado(prisma, '51987654321')).resolves.toMatchObject({ alcanzado: false });
  });

  it('cuenta solo pedidos de WhatsApp, en medio digital, sin pagar, no anulados y de las últimas 24 h', async () => {
    await topePedidosSinPagarAlcanzado(prisma, '51987654321');
    const where = prisma.pedido.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      canal: 'WHATSAPP',
      cliente_telefono: { endsWith: '987654321' },
      estado: { not: 'ANULADO' },
      pago_estado: 'PENDIENTE',
    });
    expect(where.OR).toEqual([
      { pago_preferido: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] } },
      { pago_metodo: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] } },
    ]);
    const hace = Date.now() - new Date(where.creado_en.gte).getTime();
    expect(hace).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5000);
    expect(hace).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5000);
  });

  it('el máximo sale del parámetro whatsapp_max_pedidos_sin_pagar', async () => {
    prisma.parametro.findUnique.mockResolvedValue({ valor: '5' });
    prisma.pedido.count.mockResolvedValue(4);
    await expect(topePedidosSinPagarAlcanzado(prisma, '51987654321')).resolves.toEqual({ alcanzado: false, max: 5 });
  });

  it('un teléfono sin 9 dígitos finales no cuenta nada (BSUID)', async () => {
    await expect(topePedidosSinPagarAlcanzado(prisma, 'wa-user:abc')).resolves.toMatchObject({ alcanzado: false });
    expect(prisma.pedido.count).not.toHaveBeenCalled();
  });

  it('si la lectura falla, no bloquea el pedido', async () => {
    prisma.pedido.count.mockRejectedValue(new Error('bd caída'));
    await expect(topePedidosSinPagarAlcanzado(prisma, '51987654321')).resolves.toMatchObject({ alcanzado: false });
  });
});
