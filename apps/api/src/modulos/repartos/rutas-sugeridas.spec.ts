import { ConfigSugerencias, PedidoParaSugerir, sugerirRutas, idOpcion } from './rutas-sugeridas';

const sede = { lat: -12.0, lng: -77.0 };
const ahora = new Date('2026-10-29T15:00:00Z');
const cfg = (o: Partial<ConfigSugerencias> = {}): ConfigSugerencias => ({
  sede, velocidadKmh: 25, factorUrbano: 1.3, paradaMin: 3, maxPorRuta: 3, maxOpciones: 3, ahora, ...o,
});
// ~1,1 km por 0,01 grado
const ped = (id: number, dLat: number, dLng: number, haceMin = 5, prometidoMin = 40): PedidoParaSugerir => ({
  id: String(id), codigo: `CP-${id}`, cliente: `Cliente ${id}`,
  lat: sede.lat + dLat, lng: sede.lng + dLng,
  creadoEn: new Date(ahora.getTime() - haceMin * 60000), prometidoMin,
});

describe('sugerirRutas', () => {
  it('separa norte y sur y nunca mezcla sentidos opuestos', () => {
    const r = sugerirRutas(
      [ped(1, 0.02, 0), ped(2, 0.03, 0.002), ped(3, -0.02, 0), ped(4, -0.03, -0.002)],
      cfg(),
    );
    expect(r.opciones).toHaveLength(2);
    for (const o of r.opciones) {
      const norte = o.pedidos.filter((p) => p.lat > sede.lat).length;
      expect(norte === 0 || norte === o.pedidos.length).toBe(true);
    }
    expect(r.opciones.map((o) => o.sector).sort()).toEqual(['Norte', 'Sur']);
  });

  it('prioriza la ruta con pedidos que ya van tarde y lo explica', () => {
    const r = sugerirRutas(
      [ped(1, 0.02, 0, 50, 40), ped(2, 0.03, 0, 45, 40), ped(3, -0.02, 0, 2), ped(4, 0, 0.02, 2)],
      cfg(),
    );
    expect(r.opciones[0].sector).toBe('Norte');
    expect(r.opciones[0].yaTarde).toBe(2);
    expect(r.opciones[0].urgente).toBe(true);
    expect(r.opciones[0].razon).toBe('La más urgente: 2 pedidos ya van tarde');
  });

  it('el pedido más urgente va en la primera ruta del sector al partirlo por el máximo', () => {
    const r = sugerirRutas(
      [ped(1, 0.02, 0), ped(2, 0.021, 0), ped(3, 0.022, 0), ped(4, 0.023, 0), ped(5, 0.05, 0, 60, 40)],
      cfg({ maxPorRuta: 2, maxOpciones: 5 }),
    );
    for (const o of r.opciones) expect(o.pedidos.length).toBeLessThanOrEqual(2);
    expect(r.opciones.find((o) => o.pedidos.some((p) => p.id === '5'))!.yaTarde).toBe(1);
  });

  it('las opciones no comparten pedidos y respetan el máximo de opciones', () => {
    const r = sugerirRutas(
      [ped(1, 0.02, 0), ped(2, -0.02, 0), ped(3, 0, 0.02), ped(4, 0, -0.02)],
      cfg({ maxOpciones: 3 }),
    );
    expect(r.opciones).toHaveLength(3);
    const todos = r.opciones.flatMap((o) => o.pedidos.map((p) => p.id));
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('el id es estable, no depende del orden y cambia si cambian los pedidos', () => {
    const a = sugerirRutas([ped(1, 0.02, 0), ped(2, 0.03, 0)], cfg());
    const b = sugerirRutas([ped(2, 0.03, 0), ped(1, 0.02, 0)], cfg());
    expect(a.opciones[0].id).toBe(b.opciones[0].id);
    expect(a.opciones[0].id).toBe(idOpcion(['2', '1']));
    expect(sugerirRutas([ped(1, 0.02, 0)], cfg()).opciones[0].id).not.toBe(a.opciones[0].id);
  });

  it('los pedidos sin ubicación van aparte y no se sugieren', () => {
    const sin: PedidoParaSugerir = { ...ped(9, 0, 0), lat: null, lng: null };
    const r = sugerirRutas([ped(1, 0.02, 0), sin], cfg());
    expect(r.sinUbicacion).toEqual([{ id: '9', codigo: 'CP-9', cliente: 'Cliente 9' }]);
    expect(r.opciones.flatMap((o) => o.pedidos.map((p) => p.id))).toEqual(['1']);
  });

  it('ordena las paradas por cercanía y calcula llegadas crecientes', () => {
    const r = sugerirRutas([ped(1, 0.06, 0), ped(2, 0.02, 0), ped(3, 0.04, 0)], cfg());
    const o = r.opciones[0];
    expect(o.pedidos.map((p) => p.id)).toEqual(['2', '3', '1']);
    expect(o.pedidos[0].llegadaMin).toBeLessThan(o.pedidos[2].llegadaMin);
    expect(o.distanciaKm).toBeGreaterThan(6);
  });

  it('sin pedidos no hay opciones', () => {
    expect(sugerirRutas([], cfg())).toEqual({ opciones: [], sinUbicacion: [] });
  });
});
