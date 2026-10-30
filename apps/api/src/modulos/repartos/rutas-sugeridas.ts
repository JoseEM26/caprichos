import { createHash } from 'crypto';

/**
 * Rutas sugeridas de reparto: función pura (sin base de datos) para que el servidor
 * calcule una sola vez y todas las pantallas vean lo mismo.
 *
 * Cómo agrupa: rumbo de cada pedido desde la sede, cortes por «huecos» angulares (> GAP_GRADOS)
 * y sectores de como mucho SPAN_MAX_GRADOS de ancho. Cada ruta sale de UN sector: nunca
 * va al norte y luego al sur. Dentro de un sector, cada ruta arranca con el pedido más urgente
 * y se llena con sus vecinos más cercanos hasta el máximo por repartidor.
 * Cómo puntúa: tiempo primero (pedidos que ya van tarde, retraso previsto), luego km y
 * «concurrida» (pedidos por km).
 */

export interface Punto {
  lat: number;
  lng: number;
}

export interface PedidoParaSugerir {
  id: string;
  codigo: string;
  cliente: string;
  lat: number | null;
  lng: number | null;
  creadoEn: Date;
  /** Minutos prometidos desde que se creó el pedido (eta_max o respaldo). */
  prometidoMin: number;
}

export interface ConfigSugerencias {
  sede: Punto;
  /** Posición del repartidor; si falta se parte de la sede. */
  origen?: Punto | null;
  velocidadKmh: number;
  factorUrbano: number;
  paradaMin: number;
  maxPorRuta: number;
  maxOpciones: number;
  ahora: Date;
}

export interface ParadaSugerida {
  id: string;
  codigo: string;
  cliente: string;
  orden: number;
  lat: number;
  lng: number;
  llegadaMin: number;
  llegadaEstimada: string;
  retrasoMin: number;
  yaTarde: boolean;
}

export interface RutaSugerida {
  id: string;
  sector: string;
  rumbo: number;
  pedidos: ParadaSugerida[];
  distanciaKm: number;
  tiempoMin: number;
  retrasoTotalMin: number;
  yaTarde: number;
  urgente: boolean;
  razon: string;
  puntaje: number;
  ruta: Array<[number, number]>;
}

export interface ResultadoSugerencias {
  opciones: RutaSugerida[];
  sinUbicacion: Array<{ id: string; codigo: string; cliente: string }>;
}

export const GAP_GRADOS = 35;
export const SPAN_MAX_GRADOS = 90;

const SECTORES = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];

export function haversineKm(a: Punto, b: Punto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Rumbo en grados [0, 360): 0 = norte, 90 = este. */
export function rumboGrados(desde: Punto, hasta: Punto): number {
  const rad = Math.PI / 180;
  const dLng = (hasta.lng - desde.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(hasta.lat * rad);
  const x =
    Math.cos(desde.lat * rad) * Math.sin(hasta.lat * rad) -
    Math.sin(desde.lat * rad) * Math.cos(hasta.lat * rad) * Math.cos(dLng);
  return (((Math.atan2(y, x) / rad) % 360) + 360) % 360;
}

export function nombreSector(rumbo: number): string {
  return SECTORES[Math.round((((rumbo % 360) + 360) % 360) / 45) % 8];
}

interface Item {
  p: PedidoParaSugerir;
  pt: Punto;
  rumbo: number;
  /** Minutos que faltan para vencer lo prometido (negativo = ya vencido). */
  margen: number;
}

/** Corta los ítems (ya ordenados en un círculo abierto por rumbo desplegado) en sectores. */
function partirSectores(items: Item[], ang: Map<Item, number>): Item[][] {
  const grupos: Item[][] = [];
  let actual: Item[] = [];
  for (const it of items) {
    const prev = actual[actual.length - 1];
    if (prev && ang.get(it)! - ang.get(prev)! > GAP_GRADOS) {
      grupos.push(actual);
      actual = [];
    }
    actual.push(it);
  }
  if (actual.length) grupos.push(actual);

  // Un sector demasiado ancho se parte por su mayor hueco interno
  const salida: Item[][] = [];
  const pila = [...grupos];
  while (pila.length) {
    const g = pila.shift()!;
    const ancho = ang.get(g[g.length - 1])! - ang.get(g[0])!;
    if (ancho <= SPAN_MAX_GRADOS || g.length < 2) {
      salida.push(g);
      continue;
    }
    let mejor = 1;
    let huecoMax = -1;
    for (let i = 1; i < g.length; i++) {
      const h = ang.get(g[i])! - ang.get(g[i - 1])!;
      if (h > huecoMax) {
        huecoMax = h;
        mejor = i;
      }
    }
    pila.unshift(g.slice(0, mejor), g.slice(mejor));
  }
  return salida;
}

function agruparPorRumbo(items: Item[]): Item[][] {
  if (items.length === 0) return [];
  const orden = [...items].sort((a, b) => a.rumbo - b.rumbo || a.p.id.localeCompare(b.p.id));
  // Se abre el círculo en el mayor hueco para que un sector no quede cortado en el norte
  let inicio = 0;
  let huecoMax = -1;
  for (let i = 0; i < orden.length; i++) {
    const sig = orden[(i + 1) % orden.length];
    const h = (sig.rumbo - orden[i].rumbo + 360) % 360 || (orden.length === 1 ? 360 : 0);
    if (h > huecoMax) {
      huecoMax = h;
      inicio = (i + 1) % orden.length;
    }
  }
  const rotado = [...orden.slice(inicio), ...orden.slice(0, inicio)];
  const ang = new Map<Item, number>();
  rotado.forEach((it) => ang.set(it, (it.rumbo - rotado[0].rumbo + 360) % 360));
  return partirSectores(rotado, ang);
}

function longitudRecorrido(origen: Punto, orden: Item[]): number {
  let km = 0;
  let prev = origen;
  for (const it of orden) {
    km += haversineKm(prev, it.pt);
    prev = it.pt;
  }
  return km;
}

/** Vecino más cercano desde el origen y mejora 2-opt (camino abierto; grupos de pocos pedidos). */
function ordenarParadas(origen: Punto, items: Item[]): Item[] {
  const rest = [...items];
  let orden: Item[] = [];
  let prev = origen;
  while (rest.length) {
    let k = 0;
    let dMin = Infinity;
    rest.forEach((it, i) => {
      const d = haversineKm(prev, it.pt);
      if (d < dMin - 1e-9) {
        dMin = d;
        k = i;
      }
    });
    const [it] = rest.splice(k, 1);
    orden.push(it);
    prev = it.pt;
  }
  let mejora = orden.length > 2;
  while (mejora) {
    mejora = false;
    const base = longitudRecorrido(origen, orden);
    for (let i = 0; i < orden.length - 1 && !mejora; i++) {
      for (let j = i + 1; j < orden.length && !mejora; j++) {
        const cand = [...orden.slice(0, i), ...orden.slice(i, j + 1).reverse(), ...orden.slice(j + 1)];
        if (longitudRecorrido(origen, cand) < base - 1e-6) {
          orden = cand;
          mejora = true;
        }
      }
    }
  }
  return orden;
}

/** Un sector se reparte en rutas: cada una arranca con el más urgente y suma sus vecinos. */
function trocear(sector: Item[], max: number): Item[][] {
  const rest = [...sector].sort((a, b) => a.margen - b.margen || a.p.id.localeCompare(b.p.id));
  const rutas: Item[][] = [];
  while (rest.length) {
    const [semilla] = rest.splice(0, 1);
    const cercanos = rest
      .map((it) => ({ it, d: haversineKm(semilla.pt, it.pt) }))
      .sort((a, b) => a.d - b.d || a.it.p.id.localeCompare(b.it.p.id))
      .slice(0, max - 1)
      .map((x) => x.it);
    for (const c of cercanos) rest.splice(rest.indexOf(c), 1);
    rutas.push([semilla, ...cercanos]);
  }
  return rutas;
}

export function idOpcion(pedidoIds: string[]): string {
  const orden = [...pedidoIds].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  return 'ruta-' + createHash('sha1').update(orden.join(',')).digest('hex').slice(0, 12);
}

function evaluar(origen: Punto, orden: Item[], cfg: ConfigSugerencias): Omit<RutaSugerida, 'razon' | 'puntaje' | 'urgente' | 'id' | 'sector' | 'rumbo'> {
  const minPorKm = (60 / cfg.velocidadKmh) * cfg.factorUrbano;
  let t = 0;
  let km = 0;
  let prev = origen;
  let retrasoTotal = 0;
  let yaTarde = 0;
  const pedidos: ParadaSugerida[] = orden.map((it, i) => {
    const tramo = haversineKm(prev, it.pt);
    km += tramo;
    t += tramo * minPorKm;
    prev = it.pt;
    const retraso = Math.max(0, Math.round(t - it.margen));
    retrasoTotal += retraso;
    const tarde = it.margen < 0;
    if (tarde) yaTarde++;
    const parada: ParadaSugerida = {
      id: it.p.id,
      codigo: it.p.codigo,
      cliente: it.p.cliente,
      orden: i + 1,
      lat: it.pt.lat,
      lng: it.pt.lng,
      llegadaMin: Math.round(t),
      llegadaEstimada: new Date(cfg.ahora.getTime() + t * 60000).toISOString(),
      retrasoMin: retraso,
      yaTarde: tarde,
    };
    t += cfg.paradaMin;
    return parada;
  });
  return {
    pedidos,
    distanciaKm: Math.round(km * 10) / 10,
    tiempoMin: pedidos.length ? pedidos[pedidos.length - 1].llegadaMin : 0,
    retrasoTotalMin: retrasoTotal,
    yaTarde,
    ruta: [[origen.lat, origen.lng], ...orden.map((it) => [it.pt.lat, it.pt.lng] as [number, number])],
  };
}

/** Mayor es mejor. Tiempo primero; después concurrida (pedidos por km) y distancia. */
function puntuar(r: { pedidos: unknown[]; distanciaKm: number; retrasoTotalMin: number; yaTarde: number }, items: Item[]): number {
  const presion = items.reduce((s, it) => s + Math.max(0, 1 - it.margen / Math.max(1, it.p.prometidoMin)), 0);
  const densidad = r.pedidos.length / Math.max(0.5, r.distanciaKm);
  return Math.round(
    (60 * r.yaTarde + 25 * presion + 6 * densidad - 3 * r.retrasoTotalMin - 0.5 * r.distanciaKm) * 10,
  ) / 10;
}

export function sugerirRutas(pedidos: PedidoParaSugerir[], cfg: ConfigSugerencias): ResultadoSugerencias {
  const sinUbicacion = pedidos
    .filter((p) => p.lat == null || p.lng == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng))
    .map((p) => ({ id: p.id, codigo: p.codigo, cliente: p.cliente }));
  const origen = cfg.origen ?? cfg.sede;

  const items: Item[] = pedidos
    .filter((p) => !sinUbicacion.some((s) => s.id === p.id))
    .map((p) => {
      const pt = { lat: p.lat as number, lng: p.lng as number };
      const vence = p.creadoEn.getTime() + p.prometidoMin * 60000;
      return { p, pt, rumbo: rumboGrados(cfg.sede, pt), margen: (vence - cfg.ahora.getTime()) / 60000 };
    });

  const candidatas = agruparPorRumbo(items)
    .flatMap((sector) => trocear(sector, Math.max(1, cfg.maxPorRuta)))
    .map((grupo) => {
      const orden = ordenarParadas(origen, grupo);
      const ev = evaluar(origen, orden, cfg);
      const x = grupo.reduce((s, it) => s + Math.sin((it.rumbo * Math.PI) / 180), 0);
      const y = grupo.reduce((s, it) => s + Math.cos((it.rumbo * Math.PI) / 180), 0);
      const rumbo = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
      return {
        ...ev,
        id: idOpcion(grupo.map((it) => it.p.id)),
        sector: nombreSector(rumbo),
        rumbo: Math.round(rumbo),
        urgente: ev.yaTarde > 0 || ev.retrasoTotalMin > 0,
        puntaje: puntuar(ev, grupo),
        razon: '',
      } as RutaSugerida;
    })
    .sort((a, b) => b.puntaje - a.puntaje || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, cfg.maxOpciones));

  const masDensa = [...candidatas].sort(
    (a, b) => b.pedidos.length / Math.max(0.5, b.distanciaKm) - a.pedidos.length / Math.max(0.5, a.distanciaKm),
  )[0];
  candidatas.forEach((r, i) => {
    const n = r.pedidos.length;
    if (r.yaTarde > 0) {
      const t = r.yaTarde === 1 ? '1 pedido ya va tarde' : `${r.yaTarde} pedidos ya van tarde`;
      r.razon = i === 0 ? `La más urgente: ${t}` : `Urgente: ${t}`;
    } else if (r.retrasoTotalMin > 0) {
      r.razon = `Llegaría con ${r.retrasoTotalMin} min de retraso en total: conviene salir ya`;
    } else if (r === masDensa && candidatas.length > 1) {
      r.razon = 'Más pedidos en menos km';
    } else {
      r.razon = `Todo hacia el ${r.sector.toLowerCase()}: ${n} ${n === 1 ? 'pedido' : 'pedidos'} a tiempo`;
    }
  });

  return { opciones: candidatas, sinUbicacion };
}
