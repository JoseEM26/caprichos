import { calcularEtaEntrega, CONFIG_ETA_DEFECTO, formatearEta, ConfigEta } from './eta-entrega';

const cfg: ConfigEta = { ...CONFIG_ETA_DEFECTO, respaldoMin: 30 };
const LOCAL = CONFIG_ETA_DEFECTO.local;
/** Punto a `km` al norte del local (1 grado de latitud ~ 111 km). */
const alNorte = (km: number) => ({ lat: LOCAL.lat + km / 111, lng: LOCAL.lng });

describe('calcularEtaEntrega', () => {
  it('usa la base de la zona y redondea a 5 con margen de 5', () => {
    expect(calcularEtaEntrega({ zonaMin: 10, zonaMax: 15, unidades: 1 }, cfg)).toEqual({ min: 10, max: 15 });
    expect(calcularEtaEntrega({ zonaMin: 30, zonaMax: 40, unidades: 1 }, cfg)).toEqual({ min: 30, max: 40 });
  });

  it('el máximo nunca es menor que min + margen', () => {
    expect(calcularEtaEntrega({ zonaMin: 10, zonaMax: 10 }, cfg)).toEqual({ min: 10, max: 15 });
  });

  it('suma empaque a partir de la cantidad configurada', () => {
    const sin = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 2 }, cfg);
    const con = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 5 }, cfg);
    expect(sin).toEqual({ min: 15, max: 20 });
    // 5 unidades con desde=3 y 1 min por unidad: +3 min -> 18 redondea a 20
    expect(con!.min).toBe(20);
  });

  it('sin zona usa la distancia en línea recta con factor urbano', () => {
    const r = calcularEtaEntrega({ ...alNorte(2), unidades: 1 }, cfg);
    // 2 km * 1.3 * 60/25 = 6.24 min + 5 de puerta = 11.24 -> 10
    expect(r).toEqual({ min: 10, max: 15 });
  });

  it('sin zona ni coordenadas devuelve null y el texto cae al respaldo', () => {
    expect(calcularEtaEntrega({ unidades: 1 }, cfg)).toBeNull();
    expect(formatearEta(null, cfg.respaldoMin)).toBe('30');
  });

  it('en una misma ruta el primer pedido queda antes que el último', () => {
    const cerca = { id: 'A', ...alNorte(0.5) };
    const lejos = { id: 'B', ...alNorte(3) };
    const primero = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 1, id: 'A', ruta: [cerca, lejos], lat: cerca.lat, lng: cerca.lng }, cfg)!;
    const ultimo = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 1, id: 'B', ruta: [cerca, lejos], lat: lejos.lat, lng: lejos.lng }, cfg)!;
    expect(ultimo.min).toBeGreaterThan(primero.min);
    expect(ultimo.max).toBeGreaterThanOrEqual(primero.max);
  });

  it('dos pedidos de la misma zona reciben estimados distintos cuando el repartidor lleva dos', () => {
    const a = { id: 'A', ...alNorte(0.4) };
    const b = { id: 'B', ...alNorte(0.4) };
    const ruta = [a, b];
    const e1 = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 1, id: 'A', ruta, lat: a.lat, lng: a.lng }, cfg)!;
    const e2 = calcularEtaEntrega({ zonaMin: 15, zonaMax: 20, unidades: 1, id: 'B', ruta, lat: b.lat, lng: b.lng }, cfg)!;
    expect(e2.min).not.toBe(e1.min);
  });

  it('el redondeo va a múltiplos del paso configurado', () => {
    const r = calcularEtaEntrega({ zonaMin: 12, zonaMax: 17, unidades: 1 }, { ...cfg, pasoMin: 5 })!;
    expect(r.min % 5).toBe(0);
    expect(r.max % 5).toBe(0);
  });

  it('formatea rango como «min a max»', () => {
    expect(formatearEta({ min: 25, max: 30 }, 30)).toBe('25 a 30');
  });
});
