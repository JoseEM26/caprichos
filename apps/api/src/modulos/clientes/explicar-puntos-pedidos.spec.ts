import { explicarPedidosPorId } from './explicar-puntos-pedidos';

describe('explicarPedidosPorId', () => {
  const pedido = (id: bigint, extra: any = {}) => ({
    id, canal: 'CARTA', party_id: 5n, cliente_party_id: 5n, estado: 'COLA', pago_estado: 'PENDIENTE',
    cupon_id: null, cupon_emitido_id: null, puntos_ganados: 0, puntos_canjeados: 0, descuento_detalle: null,
    lineas: [{ id: 1n, producto_id: 1n, subtotal: 20, precio_unit: 20, cantidad: 1, oferta_id: null, linea_combo_id: null, producto: { no_suma_beneficios: false } }],
    ...extra,
  });
  const prisma = (pedidos: any[], roles: any[], porcentaje: any = null) =>
    ({
      pedido: { findMany: jest.fn().mockResolvedValue(pedidos) },
      parametro: { findUnique: jest.fn().mockResolvedValue(porcentaje === null ? null : { valor: porcentaje }) },
      partyRole: { findMany: jest.fn().mockResolvedValue(roles) },
    }) as any;

  it('usa 5 % por defecto y el parámetro puntos_porcentaje cuando existe', async () => {
    const a = await explicarPedidosPorId(prisma([pedido(1n)], [{ party_id: 5n }]), [1n]);
    expect(a.get('1')?.estimado).toBe(1);
    const b = await explicarPedidosPorId(prisma([pedido(1n)], [{ party_id: 5n }], 10), [1n]);
    expect(b.get('1')?.estimado).toBe(2);
  });

  it('sin rol CLIENTE activo explica SIN_CUENTA_CLIENTE; invitado y cupón por su motivo', async () => {
    const r = await explicarPedidosPorId(
      prisma([pedido(1n), pedido(2n, { cliente_party_id: null, party_id: null }), pedido(3n, { cupon_id: 9n })], [{ party_id: 5n }]),
      [1n, 2n, 3n],
    );
    expect(r.get('1')?.estado).toBe('PENDIENTE_DE_COBRO');
    expect(r.get('2')?.motivo).toBe('INVITADO');
    expect(r.get('3')?.motivo).toBe('CUPON');
    const sinRol = await explicarPedidosPorId(prisma([pedido(1n)], []), [1n]);
    expect(sinRol.get('1')?.motivo).toBe('SIN_CUENTA_CLIENTE');
  });

  it('sin ids no consulta nada', async () => {
    const p = prisma([], []);
    expect((await explicarPedidosPorId(p, [])).size).toBe(0);
    expect(p.pedido.findMany).not.toHaveBeenCalled();
  });
});
