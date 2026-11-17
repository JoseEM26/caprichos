jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { lineasDeArea } from './comandas.service';
import { construirEtiquetasArea } from '../impresion/constructor-etiquetas';

// Para llevar por línea: cocina (comanda y despacho) y el sticker de área lo ven; sin marca, nada cambia.
describe('para llevar por línea en cocina y stickers', () => {
  const linea = (id: bigint, extra: Record<string, unknown> = {}) => ({
    id, nombre: 'Frappé', cantidad: 1, area_id: 1n, tamano: null, nota: null, nombres_persona: [],
    opcionesElegidas: [], sabores: [], producto_id: 7n, area: { nombre: 'BARRA' }, ...extra,
  });

  it('lineasDeArea devuelve paraLlevar por línea (false si no hay marca)', () => {
    const out = lineasDeArea([linea(1n, { para_llevar: true }), linea(2n, { para_llevar: false }), linea(3n)], 1n);
    expect(out.map((l) => l.paraLlevar)).toEqual([true, false, false]);
  });

  it('el sticker de área marca «PARA LLEVAR» solo en la línea marcada', () => {
    const pedido: any = {
      id: 1n, codigo: 'CP-9', modalidad: 'MESA', mesa_nombre: '6', cliente_nombre: 'Diana', creado_en: new Date(),
      lineas: [linea(1n, { para_llevar: true }), linea(2n, { para_llevar: false, nombre: 'Latte' })],
    };
    const [barra] = construirEtiquetasArea(pedido);
    expect(barra.lineas[0].opciones).toContain('PARA LLEVAR');
    expect(barra.lineas[1].opciones).not.toContain('PARA LLEVAR');
  });
});
