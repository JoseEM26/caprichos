import { esMadreCombo, leerPuntosPromoSuman, montoElegiblePuntos, tipoPromoLinea } from './puntos-elegibles.util';

const normal = { productoId: '1', subtotal: 20 };
const combo = { productoId: '2', subtotal: 30, enPromocion: true, tipoPromo: 'COMBO' as const };
const oferta = { productoId: '3', subtotal: 10, enPromocion: true, tipoPromo: 'OFERTA' as const };
const todas = [normal, combo, oferta];

describe('montoElegiblePuntos con puntos_combos_suman / puntos_ofertas_suman', () => {
  it('apagado (o sin interruptores) = como hoy: solo lo normal', () => {
    expect(montoElegiblePuntos(todas, [])).toBe(20);
    expect(montoElegiblePuntos(todas, [], {})).toBe(20);
    expect(montoElegiblePuntos(todas, [], { combos: false, ofertas: false })).toBe(20);
  });
  it('combos encendido: suma el combo sobre lo cobrado, la oferta sigue fuera', () => {
    expect(montoElegiblePuntos(todas, [], { combos: true })).toBe(50);
  });
  it('ofertas encendido: suma la oferta, el combo sigue fuera', () => {
    expect(montoElegiblePuntos(todas, [], { ofertas: true })).toBe(30);
  });
  it('ambos encendidos', () => {
    expect(montoElegiblePuntos(todas, [], { combos: true, ofertas: true })).toBe(60);
  });
  it('promoción sin tipo conocido sigue excluida aunque haya interruptores', () => {
    expect(montoElegiblePuntos([{ productoId: '9', subtotal: 8, enPromocion: true }], [], { combos: true, ofertas: true })).toBe(0);
  });
  it('no suma beneficios y descuento aplicado siguen excluyendo con los interruptores encendidos', () => {
    const lineas = [{ ...combo, noSumaBeneficios: true }, { ...oferta, productoId: '4' }];
    expect(montoElegiblePuntos(lineas, [{ lineasAfectadas: [{ productoId: '4' } as any] }], { combos: true, ofertas: true })).toBe(0);
  });
});

describe('tipoPromoLinea / esMadreCombo (líneas guardadas)', () => {
  it('madre de combo, parte de combo y oferta suelta', () => {
    expect(esMadreCombo({ oferta_id: 1n, producto_id: null, linea_combo_id: null })).toBe(true);
    expect(tipoPromoLinea({ oferta_id: 1n, producto_id: null })).toBe('COMBO');
    expect(tipoPromoLinea({ linea_combo_id: 5n, producto_id: 7n })).toBe('COMBO');
    expect(tipoPromoLinea({ oferta_id: 1n, producto_id: 7n })).toBe('OFERTA');
    expect(tipoPromoLinea({ producto_id: 7n })).toBeUndefined();
  });
});

describe('leerPuntosPromoSuman', () => {
  const prisma = (filas: any) => ({ parametro: { findMany: jest.fn().mockResolvedValue(filas) } });
  it('sin parámetros = apagado', async () => {
    expect(await leerPuntosPromoSuman(prisma([]))).toEqual({ combos: false, ofertas: false });
  });
  it('lee «si» y true de forma independiente', async () => {
    expect(await leerPuntosPromoSuman(prisma([{ clave: 'puntos_combos_suman', valor: 'si' }, { clave: 'puntos_ofertas_suman', valor: 'no' }]))).toEqual({ combos: true, ofertas: false });
    expect(await leerPuntosPromoSuman(prisma([{ clave: 'puntos_ofertas_suman', valor: true }]))).toEqual({ combos: false, ofertas: true });
  });
  it('si la lectura falla = apagado', async () => {
    expect(await leerPuntosPromoSuman({ parametro: { findMany: jest.fn().mockRejectedValue(new Error('x')) } })).toEqual({});
  });
});
