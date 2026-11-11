import { explicarPuntosPedido, PedidoParaPuntos } from './explicar-puntos-pedido';

const ctx = { porcentaje: 5, tieneRolCliente: true };
const linea = (subtotal: number, extra: any = {}) => ({ id: 1n, producto_id: 1n, subtotal, cantidad: 1, producto: { no_suma_beneficios: false }, ...extra });
const base = (extra: Partial<PedidoParaPuntos> = {}): PedidoParaPuntos => ({
  canal: 'CARTA', party_id: 5n, cliente_party_id: 5n, estado: 'COLA', pago_estado: 'PENDIENTE', lineas: [linea(15)], ...extra,
});

describe('explicarPuntosPedido', () => {
  it('pendiente: estima 5 % de los productos elegibles', () => {
    const r = explicarPuntosPedido(base(), ctx);
    expect(r).toMatchObject({ estado: 'PENDIENTE_DE_COBRO', estimado: 0.75 });
    expect(r.texto).toContain('0.75');
  });
  it('sumado cuando ya hay puntos_ganados', () => {
    expect(explicarPuntosPedido(base({ puntos_ganados: 0.73, pago_estado: 'PAGADO' }), ctx)).toMatchObject({ estado: 'SUMADO', puntos: 0.73 });
  });
  it('invitado', () => {
    expect(explicarPuntosPedido(base({ party_id: null, cliente_party_id: null }), ctx).motivo).toBe('INVITADO');
  });
  it('mozo: party_id es del personal, no del cliente', () => {
    expect(explicarPuntosPedido(base({ canal: 'MOZO', cliente_party_id: null }), ctx).motivo).toBe('INVITADO');
  });
  it('cupón', () => {
    expect(explicarPuntosPedido(base({ cupon_emitido_id: 3n }), ctx).motivo).toBe('CUPON');
  });
  it('descuento del equipo (PERSONAL): no suma puntos', () => {
    const r = explicarPuntosPedido(base({ descuento_detalle: [{ tipo: 'PERSONAL', montoDescontado: 3 }] }), ctx);
    expect(r).toMatchObject({ estado: 'NO_SUMA', motivo: 'PERSONAL' });
  });
  it('anulado', () => {
    expect(explicarPuntosPedido(base({ estado: 'ANULADO' }), ctx).motivo).toBe('ANULADO');
  });
  it('sin rol cliente', () => {
    expect(explicarPuntosPedido(base(), { ...ctx, tieneRolCliente: false }).motivo).toBe('SIN_CUENTA_CLIENTE');
  });
  it('solo combo/promoción', () => {
    const r = explicarPuntosPedido(base({ lineas: [linea(33, { linea_combo_id: 9n })] }), ctx);
    expect(r.motivo).toBe('SOLO_PROMOCION');
    expect(r.texto).toContain('combos y promociones');
  });
  it('mezcla: solo suma la parte sin promoción', () => {
    const r = explicarPuntosPedido(base({ lineas: [linea(20), linea(33, { id: 2n, producto_id: 2n, oferta_id: 1n })] }), ctx);
    expect(r.estimado).toBe(1);
  });
  it('producto marcado sin beneficios', () => {
    const r = explicarPuntosPedido(base({ lineas: [linea(10, { producto: { no_suma_beneficios: true } })] }), ctx);
    expect(r.motivo).toBe('SIN_BENEFICIOS');
  });
  it('canje total', () => {
    expect(explicarPuntosPedido(base({ puntos_canjeados: 15 }), ctx).motivo).toBe('CANJE_TOTAL');
  });
  it('cobrado sin puntos registrados se señala como anomalía', () => {
    expect(explicarPuntosPedido(base({ pago_estado: 'PAGADO' }), ctx).motivo).toBe('NO_REGISTRADO');
  });
});
