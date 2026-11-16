jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { lineasDeArea } from './comandas.service';
import { construirEtiquetasArea, construirEtiquetasBebida, construirTicketComandaArea } from '../impresion/constructor-etiquetas';

/** Pedido de mesa por WhatsApp: 2 × Dúo (Club Sandwich + Papas + bebida) con la nota del cliente en la línea madre. */
const NOTA = 'Sin lactosa y sin azúcar';
const COCINA = 1n;
const BARRA = 2n;
const hija = (id: bigint, nombre: string, area: bigint, areaNombre: string, extra = {}) => ({
  id, nombre, cantidad: 2, producto_id: id, area_id: area, area: { nombre: areaNombre }, producto: { categoria: { area_id: area } },
  linea_combo_id: 1n, nota: 'Combo: Dúo Irresistible', opcionesElegidas: [], sabores: [], nombres_persona: [], ...extra,
});
const pedido = {
  codigo: 'CP-W1', canal: 'WHATSAPP', modalidad: 'MESA', mesa_nombre: '4', cliente_nombre: 'Ana', nota: null,
  creado_en: new Date('2026-11-16T15:00:00Z'),
  lineas: [
    { id: 1n, nombre: 'Dúo Irresistible', cantidad: 2, producto_id: null, area_id: null, area: null, producto: null, linea_combo_id: null, nota: NOTA, opcionesElegidas: [], sabores: [], nombres_persona: [] },
    hija(2n, 'Club Sandwich', COCINA, 'Cocina'),
    hija(3n, 'Papas nativas', COCINA, 'Cocina'),
    hija(4n, 'Limonada', BARRA, 'Barra', { nombres_persona: ['Ana', 'Luis'] }),
    { id: 5n, nombre: 'Brownie', cantidad: 1, producto_id: 9n, area_id: COCINA, area: { nombre: 'Cocina' }, producto: { categoria: { area_id: COCINA } }, linea_combo_id: null, nota: 'Sin nueces', opcionesElegidas: [], sabores: [], nombres_persona: [] },
  ],
};

describe('la nota del cliente en un combo llega a cada área', () => {
  it('comanda de cocina y de barra (y despacho, que usa lineasDeArea)', () => {
    for (const area of [COCINA, BARRA]) {
      for (const l of lineasDeArea(pedido.lineas, area).filter((x) => x.combo)) expect(l.nota).toContain(NOTA);
    }
    expect(lineasDeArea(pedido.lineas, COCINA).find((l) => l.nombre === 'Brownie')?.nota).toBe('Sin nueces');
  });

  it('etiqueta de área, comanda impresa del área y sticker de la bebida', () => {
    const lineasEtiqueta = construirEtiquetasArea(pedido).flatMap((e) => e.lineas).filter((l) => l.nombre !== 'Brownie');
    expect(lineasEtiqueta.length).toBeGreaterThan(0);
    expect(lineasEtiqueta.every((l) => l.nota?.includes(NOTA))).toBe(true);
    expect(construirTicketComandaArea(pedido, BARRA).lineas[0].nota).toContain(NOTA);
    expect(construirTicketComandaArea(pedido, COCINA).lineas.find((l) => l.nombre === 'Club Sandwich')?.nota).toContain(NOTA);
    const stickers = construirEtiquetasBebida(pedido);
    expect(stickers.length).toBeGreaterThan(0);
    expect(stickers.every((b) => (b as any).nota?.includes(NOTA))).toBe(true);
  });
});
