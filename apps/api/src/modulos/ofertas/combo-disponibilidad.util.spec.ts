jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { calcularDisponibilidadCombo, ParteDisp, ProductoDisp, productoDisponible, SaborDisp, unidadesDisponibles } from './combo-disponibilidad.util';

const futuro = new Date(Date.now() + 3600_000);
const prod = (id: string, extra: Partial<ProductoDisp> = {}): ProductoDisp => ({
  id, nombre: `P${id}`, categoriaId: '1', oculto: false, agotadoHasta: null, ...extra,
});
const alts = (ids: string[], cantidad = 1) => ids.map((id) => ({ id, cantidad }));
const fijo = (reemplazos: string[] = []): ParteDisp => ({ tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['10'], alternativas: alts(reemplazos) });

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
    const parte: ParteDisp = { tipo: 'UNA_DE', cantidad: 1, categorias: [], productos: ['1', '2'], alternativas: [] };
    expect(calcularDisponibilidadCombo([parte], [prod('1', { oculto: true }), prod('2')]).disponible).toBe(true);
    expect(calcularDisponibilidadCombo([parte], [prod('1', { oculto: true }), prod('2', { agotadoHasta: futuro })]).disponible).toBe(false);
  });

  it('A_ELECCION: mira los productos de sus categorías', () => {
    const parte: ParteDisp = { tipo: 'A_ELECCION', cantidad: 2, categorias: ['1'], productos: [], alternativas: [] };
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
      const parte: ParteDisp = { tipo: 'UNA_DE', cantidad: 1, categorias: [], productos: ['1'], alternativas: [] };
      const r = calcularDisponibilidadCombo([parte], [prod('1', { controlaStock: true, saldo: 0 })]);
      expect(r.disponible).toBe(false);
      expect(r.motivoAgotado).toBe('Falta una de las opciones');
    });

    it('FIJO con principal sin stock usa el reemplazo con saldo', () => {
      const r = calcularDisponibilidadCombo([fijo(['11'])], [prod('10', { controlaStock: true, saldo: 0 }), prod('11', { controlaStock: true, saldo: 4 })]);
      expect(r.partes[0].opcionesDisponibles).toEqual(['11']);
    });
  });
  describe('alternativas de una parte (si no hay stock, elige)', () => {
    const gal = (saldo: number) => prod('50', { controlaStock: true, saldo });
    // «2 donas»: A_ELECCION de la categoría 7 con donas sin saldo; alternativa: 2 galletas (categoría 8)
    const parteDonas = (alternativas = alts(['50'], 2)): ParteDisp => ({ tipo: 'A_ELECCION', cantidad: 2, categorias: ['7'], productos: [], alternativas });
    const donas = (saldo: number) => [prod('40', { categoriaId: '7', controlaStock: true, saldo }), prod('41', { categoriaId: '7', controlaStock: true, saldo: 0 })];

    it('original sin stock y alternativa con stock: parte disponible y alternativas activas', () => {
      const r = calcularDisponibilidadCombo([parteDonas()], [...donas(0), gal(4)]);
      expect(r.disponible).toBe(true);
      expect(r.partes[0].armable).toBe(false);
      expect(r.partes[0].alternativasActivas).toBe(true);
      expect(r.partes[0].alternativas).toEqual([{ id: '50', cantidad: 2, disponible: true }]);
    });

    it('original alcanza: no se activan las alternativas aunque tengan stock', () => {
      const r = calcularDisponibilidadCombo([parteDonas()], [prod('40', { categoriaId: '7', controlaStock: true, saldo: 3 }), gal(4)]);
      expect(r.partes[0].armable).toBe(true);
      expect(r.partes[0].alternativasActivas).toBe(false);
      expect(r.partes[0].alternativas[0].disponible).toBe(true);
    });

    it('la alternativa necesita su cantidad: 2 galletas con 1 sola no está disponible y el combo sale agotado', () => {
      const r = calcularDisponibilidadCombo([parteDonas()], [...donas(0), gal(1)]);
      expect(r.partes[0].alternativas).toEqual([{ id: '50', cantidad: 2, disponible: false }]);
      expect(r.disponible).toBe(false);
      expect(r.partes[0].alternativasActivas).toBe(false);
    });

    it('con varias alternativas, el combo sigue disponible mientras una tenga stock', () => {
      const parte = parteDonas([{ id: '50', cantidad: 2 }, { id: '51', cantidad: 1 }, { id: '52', cantidad: 1 }]);
      const r = calcularDisponibilidadCombo([parte], [...donas(0), gal(0), prod('51', { controlaStock: true, saldo: 0 }), prod('52', { controlaStock: true, saldo: 2 })]);
      expect(r.disponible).toBe(true);
      expect(r.partes[0].alternativas.map((a) => a.disponible)).toEqual([false, false, true]);
    });

    it('UNA_DE de donas: 2 unidades con 1 sola en stock no alcanza y usa la alternativa', () => {
      const parte: ParteDisp = { tipo: 'UNA_DE', cantidad: 2, categorias: [], productos: ['40'], alternativas: alts(['50']) };
      const r = calcularDisponibilidadCombo([parte], [prod('40', { controlaStock: true, saldo: 1 }), gal(3)]);
      expect(r.partes[0].armable).toBe(false);
      expect(r.partes[0].alternativasActivas).toBe(true);
      expect(r.disponible).toBe(true);
    });

    it('FIJO con principal agotado: la alternativa con stock es la opción disponible', () => {
      const parte: ParteDisp = { tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['10'], alternativas: alts(['11']) };
      const r = calcularDisponibilidadCombo([parte], [prod('10', { controlaStock: true, saldo: 0 }), prod('11', { controlaStock: true, saldo: 1 })]);
      expect(r.partes[0].opcionesDisponibles).toEqual(['11']);
      expect(r.partes[0].alternativasActivas).toBe(true);
    });
  });

  it('unidadesDisponibles: sin control de stock es ilimitado; por sabor suma los sabores activos', () => {
    expect(unidadesDisponibles(prod('1'))).toBe(Infinity);
    expect(unidadesDisponibles(prod('1', { controlaStock: true, sabores: [{ id: 'a', nombre: 'A', activo: true, agotadoHasta: null, saldo: 2 }, { id: 'b', nombre: 'B', activo: false, agotadoHasta: null, saldo: 5 }] }))).toBe(2);
  });
});
