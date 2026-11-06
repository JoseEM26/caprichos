jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { calcularDisponibilidadCombo, ParteDisp, ProductoDisp, productoDisponible, SaborDisp } from './combo-disponibilidad.util';

const futuro = new Date(Date.now() + 3600_000);
const prod = (id: string, extra: Partial<ProductoDisp> = {}): ProductoDisp => ({
  id, nombre: `P${id}`, categoriaId: '1', oculto: false, agotadoHasta: null, ...extra,
});
const fijo = (reemplazos: string[] = []): ParteDisp => ({ tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['10'], reemplazos });

describe('calcularDisponibilidadCombo', () => {
  it('principal disponible: se usa el principal', () => {
    const r = calcularDisponibilidadCombo([fijo(['11'])], [prod('10'), prod('11')]);
    expect(r.disponible).toBe(true);
    expect(r.partes[0].opcionesDisponibles).toEqual(['10']);
  });

  it('principal agotado con reemplazos: devuelve los reemplazos disponibles en orden', () => {
    const r = calcularDisponibilidadCombo([fijo(['11', '12', '13'])], [
      prod('10', { agotadoHasta: futuro }), prod('11', { agotadoHasta: 'infinity' }), prod('12'), prod('13'),
    ]);
    expect(r.disponible).toBe(true);
    expect(r.partes[0].principalDisponible).toBe(false);
    expect(r.partes[0].opcionesDisponibles).toEqual(['12', '13']);
  });

  it('todos agotados: combo agotado con motivo', () => {
    const r = calcularDisponibilidadCombo([fijo(['11'])], [prod('10', { agotadoHasta: futuro }), prod('11', { agotadoHasta: futuro })]);
    expect(r.disponible).toBe(false);
    expect(r.motivoAgotado).toBe('Falta P10');
  });

  it('oculto cuenta como no disponible; agotado vencido sí está disponible', () => {
    const r = calcularDisponibilidadCombo([fijo(['11'])], [
      prod('10', { oculto: true }), prod('11', { agotadoHasta: new Date(Date.now() - 1000) }),
    ]);
    expect(r.partes[0].opcionesDisponibles).toEqual(['11']);
  });

  it('UNA_DE: basta un producto disponible', () => {
    const parte: ParteDisp = { tipo: 'UNA_DE', cantidad: 1, categorias: [], productos: ['1', '2'], reemplazos: [] };
    expect(calcularDisponibilidadCombo([parte], [prod('1', { oculto: true }), prod('2')]).disponible).toBe(true);
    expect(calcularDisponibilidadCombo([parte], [prod('1', { oculto: true }), prod('2', { agotadoHasta: futuro })]).disponible).toBe(false);
  });

  it('A_ELECCION: mira los productos de sus categorías', () => {
    const parte: ParteDisp = { tipo: 'A_ELECCION', cantidad: 2, categorias: ['1'], productos: [], reemplazos: [] };
    expect(calcularDisponibilidadCombo([parte], [prod('1'), prod('2', { categoriaId: '9' })]).disponible).toBe(true);
    expect(calcularDisponibilidadCombo([parte], [prod('1', { agotadoHasta: futuro }), prod('2', { categoriaId: '9' })]).disponible).toBe(false);
  });

  describe('stock heredado', () => {
    const sabor = (id: string, saldo: number, extra: Partial<SaborDisp> = {}): SaborDisp => ({
      id, nombre: `S${id}`, activo: true, agotadoHasta: null, saldo, ...extra,
    });

    it('producto que controla stock con saldo 0 no está disponible; con saldo, sí', () => {
      expect(productoDisponible(prod('1', { controlaStock: true, saldo: 0 }))).toBe(false);
      expect(productoDisponible(prod('1', { controlaStock: true, saldo: 2 }))).toBe(true);
    });

    it('producto por sabor: disponible si algún sabor activo tiene saldo', () => {
      expect(productoDisponible(prod('1', { controlaStock: true, sabores: [sabor('a', 0), sabor('b', 1)] }))).toBe(true);
      expect(productoDisponible(prod('1', { controlaStock: true, sabores: [sabor('a', 0), sabor('b', 0, { activo: false })] }))).toBe(false);
    });

    it('sin control de stock el saldo no cuenta (bebidas y empanada no cambian)', () => {
      expect(productoDisponible(prod('1', { controlaStock: false, saldo: 0 }))).toBe(true);
    });

    it('UNA_DE de donas en 0 no deja elegir y la parte sin opciones deja el combo sin disponibilidad', () => {
      const parte: ParteDisp = { tipo: 'UNA_DE', cantidad: 1, categorias: [], productos: ['1'], reemplazos: [] };
      const r = calcularDisponibilidadCombo([parte], [prod('1', { controlaStock: true, saldo: 0 })]);
      expect(r.disponible).toBe(false);
      expect(r.motivoAgotado).toBe('Falta una de las opciones');
    });

    it('FIJO con principal sin stock usa el reemplazo con saldo', () => {
      const r = calcularDisponibilidadCombo([fijo(['11'])], [prod('10', { controlaStock: true, saldo: 0 }), prod('11', { controlaStock: true, saldo: 4 })]);
      expect(r.partes[0].opcionesDisponibles).toEqual(['11']);
    });
  });
});
