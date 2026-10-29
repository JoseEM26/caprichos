/**
 * Geometría de zonas de reparto (sin dependencias). Coordenadas [lat, lng]; los cálculos se hacen en una
 * proyección plana local en metros. Compartida por la API (fuente de verdad) y la web (vista previa).
 */
export type Punto = [number, number];

export const SNAP_M_DEFECTO = 15;
/** Distancia bajo la cual un desplazamiento se considera ruido numérico, no un ajuste. */
const RUIDO_M = 0.02;
/** Solape menor a esto (m²) se ignora al recortar. */
const AREA_MIN_RECORTE_M2 = 0.05;
const KY = 110574;

type V = [number, number];

export interface ResumenAjuste {
  verticesAjustados: number;
  verticesInsertados: number;
  huecosCerrados: number;
  huecoMaxM: number;
  areaRecortadaM2: number;
}

export interface ResultadoAjuste {
  poligono: Punto[];
  resumen: ResumenAjuste;
  cambio: boolean;
}

// ---------------------------------------------------------------- utilidades básicas
export function sinCierre(p: Punto[]): Punto[] {
  return p.length > 3 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1] ? p.slice(0, -1) : p;
}

function proyector(lat0: number, lng0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    aM: (p: Punto): V => [(p[1] - lng0) * kx, (p[0] - lat0) * KY],
    aLL: (v: V): Punto => [Math.round((lat0 + v[1] / KY) * 1e8) / 1e8, Math.round((lng0 + v[0] / kx) * 1e8) / 1e8],
  };
}

const cruz = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const resta = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const largo = (a: V) => Math.hypot(a[0], a[1]);

function areaFirmada(p: V[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += cruz(p[i], p[(i + 1) % p.length]);
  return s / 2;
}

function distSeg(p: V, a: V, b: V): { d: number; t: number; q: V } {
  const ab = resta(b, a);
  const l2 = ab[0] * ab[0] + ab[1] * ab[1];
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  const q: V = [a[0] + t * ab[0], a[1] + t * ab[1]];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), t, q };
}

function dentroDe(p: V, poli: V[]): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function cruzan(a: V, b: V, c: V, d: V): boolean {
  const d1 = cruz(resta(d, c), resta(a, c));
  const d2 = cruz(resta(d, c), resta(b, c));
  const d3 = cruz(resta(b, a), resta(c, a));
  const d4 = cruz(resta(b, a), resta(d, a));
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** true si el polígono (>=3 vértices) tiene aristas no adyacentes que se cruzan. */
export function autoIntersecta(poligono: Punto[]): boolean {
  const p = sinCierre(poligono);
  const n = p.length;
  if (n < 4) return false;
  const { aM } = proyector(p[0][0], p[0][1]);
  const m = p.map(aM);
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (cruzan(m[i], m[(i + 1) % n], m[j], m[(j + 1) % n])) return true;
    }
  return false;
}

// ---------------------------------------------------------------- recorte (intersección / diferencia)
type Tipo = 'dentro' | 'fuera' | 'mismo' | 'opuesto';
interface Sub {
  a: V;
  b: V;
  tipo: Tipo;
}

const EPS_M = 1e-4;

/** Parte las aristas de P en los cruces con Q y clasifica cada trozo respecto de Q. */
function dividir(P: V[], Q: V[]): Sub[] {
  const out: Sub[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const r = resta(b, a);
    const lr = largo(r);
    if (lr === 0) continue;
    const ts = [0, 1];
    for (let j = 0; j < Q.length; j++) {
      const c = Q[j];
      const d = Q[(j + 1) % Q.length];
      const s = resta(d, c);
      const ls = largo(s);
      if (ls === 0) continue;
      const qp = resta(c, a);
      const den = cruz(r, s);
      if (Math.abs(den) > 1e-9 * lr * ls) {
        const t = cruz(qp, s) / den;
        const u = cruz(qp, r) / den;
        if (t >= -EPS_M / lr && t <= 1 + EPS_M / lr && u >= -EPS_M / ls && u <= 1 + EPS_M / ls) ts.push(Math.max(0, Math.min(1, t)));
      } else if (Math.abs(cruz(qp, r)) / lr < EPS_M) {
        for (const e of [c, d]) {
          const t = ((e[0] - a[0]) * r[0] + (e[1] - a[1]) * r[1]) / (lr * lr);
          if (t > 0 && t < 1) ts.push(t);
        }
      }
    }
    ts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      if ((ts[k + 1] - ts[k]) * lr < 1e-6) continue;
      const pa: V = [a[0] + r[0] * ts[k], a[1] + r[1] * ts[k]];
      const pb: V = [a[0] + r[0] * ts[k + 1], a[1] + r[1] * ts[k + 1]];
      const mid: V = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      let tipo: Tipo | null = null;
      for (let j = 0; j < Q.length && !tipo; j++) {
        const c = Q[j];
        const d = Q[(j + 1) % Q.length];
        if (distSeg(mid, c, d).d < 1e-3) {
          const dir = r[0] * (d[0] - c[0]) + r[1] * (d[1] - c[1]);
          tipo = dir >= 0 ? 'mismo' : 'opuesto';
        }
      }
      if (!tipo) tipo = dentroDe(mid, Q) ? 'dentro' : 'fuera';
      out.push({ a: pa, b: pb, tipo });
    }
  }
  return out;
}

const ccw = (p: V[]): V[] => (areaFirmada(p) < 0 ? [...p].reverse() : p);

/** Área de la intersección de dos polígonos simples (m²). */
function areaInterseccion(A: V[], B: V[]): number {
  let s = 0;
  for (const e of dividir(A, B)) if (e.tipo === 'dentro' || e.tipo === 'mismo') s += cruz(e.a, e.b);
  for (const e of dividir(B, A)) if (e.tipo === 'dentro') s += cruz(e.a, e.b);
  return Math.max(0, s / 2);
}

/** Une aristas dirigidas en anillos cerrados (recorrido por vértice; las aristas usadas no se repiten). */
function anillosDe(aristas: [V, V][]): V[][] {
  const clave = (v: V) => `${Math.round(v[0] * 1000)},${Math.round(v[1] * 1000)}`;
  const salen = new Map<string, number[]>();
  aristas.forEach((e, i) => {
    const k = clave(e[0]);
    salen.set(k, [...(salen.get(k) ?? []), i]);
  });
  const usada = new Set<number>();
  const anillos: V[][] = [];
  for (let i = 0; i < aristas.length; i++) {
    if (usada.has(i)) continue;
    usada.add(i);
    const ring: V[] = [aristas[i][0]];
    const inicio = clave(aristas[i][0]);
    let fin = aristas[i][1];
    let cerrado = false;
    for (let paso = 0; paso <= aristas.length; paso++) {
      if (clave(fin) === inicio) {
        cerrado = true;
        break;
      }
      ring.push(fin);
      const sig = (salen.get(clave(fin)) ?? []).find((k) => !usada.has(k));
      if (sig === undefined) break;
      usada.add(sig);
      fin = aristas[sig][1];
    }
    if (cerrado && ring.length >= 3) anillos.push(ring);
  }
  return anillos;
}

/** A menos B como un solo anillo; null si el resultado no se puede expresar como un polígono simple. */
function diferencia(A: V[], B: V[]): V[] | null {
  const aristas: [V, V][] = [];
  for (const e of dividir(A, B)) if (e.tipo === 'fuera' || e.tipo === 'opuesto') aristas.push([e.a, e.b]);
  for (const e of dividir(B, A)) if (e.tipo === 'dentro') aristas.push([e.b, e.a]);
  const grandes = anillosDe(aristas).filter((r) => Math.abs(areaFirmada(r)) > 1);
  if (grandes.length !== 1 || areaFirmada(grandes[0]) < 0) return null;
  return grandes[0];
}

/** Trozos de la intersección de A y B como anillos (en metros). */
function anillosInterseccion(A: V[], B: V[]): V[][] {
  const aristas: [V, V][] = [];
  for (const e of dividir(A, B)) if (e.tipo === 'dentro' || e.tipo === 'mismo') aristas.push([e.a, e.b]);
  for (const e of dividir(B, A)) if (e.tipo === 'dentro') aristas.push([e.a, e.b]);
  return anillosDe(aristas);
}

// ---------------------------------------------------------------- API pública
export function areaM2(poligono: Punto[]): number {
  const p = sinCierre(poligono);
  if (p.length < 3) return 0;
  const { aM } = proyector(p[0][0], p[0][1]);
  return Math.abs(areaFirmada(p.map(aM)));
}

/** Área solapada (m²) entre dos polígonos; bordes que solo se tocan dan 0. */
export function areaSolapeM2(a: Punto[], b: Punto[]): number {
  const pa = sinCierre(a);
  const pb = sinCierre(b);
  if (pa.length < 3 || pb.length < 3) return 0;
  const { aM } = proyector(pa[0][0], pa[0][1]);
  return areaInterseccion(ccw(pa.map(aM)), ccw(pb.map(aM)));
}

export interface SolapeZonas {
  areaM2: number;
  /** Área compartida como anillos [lat, lng] (un polígono por anillo; vacío si no hay solape). */
  anillos: Punto[][];
}

/** Solape entre dos polígonos: área (m², igual que areaSolapeM2) y el polígono de la parte compartida. */
export function solapeEntre(a: Punto[], b: Punto[]): SolapeZonas {
  const pa = sinCierre(a);
  const pb = sinCierre(b);
  if (pa.length < 3 || pb.length < 3) return { areaM2: 0, anillos: [] };
  const { aM, aLL } = proyector(pa[0][0], pa[0][1]);
  const A = ccw(pa.map(aM));
  const B = ccw(pb.map(aM));
  const anillos = anillosInterseccion(A, B)
    .filter((r) => Math.abs(areaFirmada(r)) > 1)
    .map((r) => ccw(r).map((v) => aLL(v)));
  return { areaM2: areaInterseccion(A, B), anillos };
}

/**
 * `poligono` sin la parte que comparte con `otro` (la que se queda con `otro`). Sin solape devuelve el original;
 * null si el resultado no es un polígono simple (p. ej. `otro` queda totalmente dentro y deja un hueco).
 */
export function recortarSolape(poligono: Punto[], otro: Punto[]): Punto[] | null {
  const p = sinCierre(poligono);
  const q = sinCierre(otro);
  if (p.length < 3 || q.length < 3) return poligono;
  const { aM, aLL } = proyector(p[0][0], p[0][1]);
  const A = ccw(p.map(aM));
  const B = ccw(q.map(aM));
  if (areaInterseccion(A, B) <= AREA_MIN_RECORTE_M2) return poligono;
  const r = diferencia(A, B);
  return r ? r.map((v) => aLL(v)) : null;
}

/** Distancia mínima (m) entre los bordes de dos polígonos; 0 si se tocan o se solapan. */
export function separacionM(a: Punto[], b: Punto[]): number {
  const pa = sinCierre(a);
  const pb = sinCierre(b);
  if (pa.length < 3 || pb.length < 3) return Infinity;
  const { aM } = proyector(pa[0][0], pa[0][1]);
  const A = pa.map(aM);
  const B = pb.map(aM);
  if (A.some((p) => dentroDe(p, B)) || B.some((p) => dentroDe(p, A))) return 0;
  let min = Infinity;
  for (const [X, Y] of [[A, B], [B, A]] as [V[], V[]][])
    for (const p of X) for (let j = 0; j < Y.length; j++) min = Math.min(min, distSeg(p, Y[j], Y[(j + 1) % Y.length]).d);
  return min;
}

/**
 * Pega un polígono a sus vecinas: (a) vértice -> vértice vecino más cercano, (b) vértice -> proyección sobre
 * un lado ajeno y vértices vecinos cercanos a un lado propio se insertan en él, (c) recorta lo que quede
 * solapado. Es idempotente. Solo se cambia la geometría; ver `resumen`.
 */
export function ajustarAVecinas(
  poligono: Punto[],
  vecinas: Punto[][],
  toleranciaM: number = SNAP_M_DEFECTO,
  opc: { recortar?: boolean } = {},
): ResultadoAjuste {
  const resumen: ResumenAjuste = { verticesAjustados: 0, verticesInsertados: 0, huecosCerrados: 0, huecoMaxM: 0, areaRecortadaM2: 0 };
  const sinCambio = (): ResultadoAjuste => ({ poligono, resumen, cambio: false });
  const orig = sinCierre(poligono);
  const vec = vecinas.map(sinCierre).filter((v) => v.length >= 3);
  if (orig.length < 3 || vec.length === 0 || !(toleranciaM > 0)) return sinCambio();

  const { aM, aLL } = proyector(orig[0][0], orig[0][1]);
  const VM = vec.map((v) => v.map(aM));
  const tocadas = new Set<number>();
  const marcar = (vi: number, d: number) => {
    tocadas.add(vi);
    resumen.huecoMaxM = Math.max(resumen.huecoMaxM, Math.round(d * 10) / 10);
  };

  // (a) y (b): cada vértice al vértice vecino más cercano o, si no, a su proyección sobre un lado vecino
  let pts: Punto[] = orig.map((p, i) => {
    const m = aM(p);
    let dV = Infinity, vV = -1, pV: Punto = p;
    let dE = Infinity, vE = -1, pE: V = m;
    VM.forEach((poli, vi) => {
      poli.forEach((q, k) => {
        const d = Math.hypot(q[0] - m[0], q[1] - m[1]);
        if (d < dV) { dV = d; vV = vi; pV = vec[vi][k]; }
        const s = distSeg(m, q, poli[(k + 1) % poli.length]);
        if (s.d < dE) { dE = s.d; vE = vi; pE = s.q; }
      });
    });
    if (dV <= toleranciaM && dV - dE <= toleranciaM / 3) {
      if (dV >= RUIDO_M) { resumen.verticesAjustados++; marcar(vV, dV); return pV; }
      return dV === 0 ? p : pV;
    }
    if (dE <= toleranciaM && dE >= RUIDO_M) { resumen.verticesAjustados++; marcar(vE, dE); return aLL(pE); }
    void i;
    return p;
  });
  pts = pts.filter((p, i) => !(p[0] === pts[(i + 1) % pts.length][0] && p[1] === pts[(i + 1) % pts.length][1]));
  if (pts.length < 3 || autoIntersecta(pts)) {
    resumen.verticesAjustados = 0;
    tocadas.clear();
    resumen.huecoMaxM = 0;
    pts = orig;
  }

  // (b'): vértices vecinos pegados a un lado propio se insertan en él
  const insertos: { lado: number; t: number; p: Punto }[] = [];
  const M = pts.map(aM);
  VM.forEach((poli, vi) =>
    poli.forEach((q, k) => {
      if (M.some((m) => Math.hypot(m[0] - q[0], m[1] - q[1]) < RUIDO_M)) return;
      let mejor: { lado: number; t: number; d: number } | null = null;
      for (let e = 0; e < M.length; e++) {
        const s = distSeg(q, M[e], M[(e + 1) % M.length]);
        if (s.t > 0.001 && s.t < 0.999 && s.d <= toleranciaM && (!mejor || s.d < mejor.d)) mejor = { lado: e, t: s.t, d: s.d };
      }
      if (mejor && mejor.d >= RUIDO_M) {
        insertos.push({ lado: mejor.lado, t: mejor.t, p: vec[vi][k] });
        marcar(vi, mejor.d);
      }
    }),
  );
  if (insertos.length) {
    insertos.sort((x, y) => x.lado - y.lado || x.t - y.t);
    const nuevo: Punto[] = [];
    pts.forEach((p, e) => {
      nuevo.push(p);
      insertos.filter((x) => x.lado === e).forEach((x) => nuevo.push(x.p));
    });
    if (autoIntersecta(nuevo)) {
      insertos.length = 0;
    } else {
      pts = nuevo;
      resumen.verticesInsertados = insertos.length;
    }
  }
  resumen.huecosCerrados = tocadas.size;

  // (c): recorte de solapes residuales
  if (opc.recortar !== false) {
    const conocidos = [...orig, ...vec.flat()];
    for (const poli of VM) {
      const A = ccw(pts.map(aM));
      const B = ccw(poli);
      const sol = areaInterseccion(A, B);
      if (sol <= AREA_MIN_RECORTE_M2) continue;
      const r = diferencia(A, B);
      if (!r) continue;
      const llr = r.map((v, i) => {
        const cerca = conocidos.find((c) => {
          const m = aM(c);
          return Math.hypot(m[0] - v[0], m[1] - v[1]) < 1e-3;
        });
        return { p: cerca ?? aLL(v), conocido: !!cerca, i };
      });
      // quita vértices colineales que no son del usuario ni de una vecina
      const limpio = llr.filter((x, k) => {
        if (x.conocido) return true;
        const a = r[(k + r.length - 1) % r.length];
        const b = r[(k + 1) % r.length];
        const l = largo(resta(b, a));
        return l === 0 || Math.abs(cruz(resta(b, a), resta(r[k], a))) / l > 1e-3;
      }).map((x) => x.p);
      if (limpio.length < 3 || autoIntersecta(limpio)) continue;
      pts = limpio;
      resumen.areaRecortadaM2 += sol;
    }
    resumen.areaRecortadaM2 = Math.round(resumen.areaRecortadaM2 * 10) / 10;
  }

  const cambio = resumen.verticesAjustados > 0 || resumen.verticesInsertados > 0 || resumen.areaRecortadaM2 > 0;
  return cambio ? { poligono: pts, resumen, cambio } : sinCambio();
}

/** Texto para mostrar al dueño, p. ej. «Se pegaron 2 vértices, se cerró un hueco de 6 m, se recortaron 14 m² de solape». */
export function resumenAjusteTexto(r: ResumenAjuste): string {
  const partes: string[] = [];
  const n = r.verticesAjustados + r.verticesInsertados;
  if (n) partes.push(`se pegaron ${n} ${n === 1 ? 'vértice' : 'vértices'}`);
  if (r.huecosCerrados) {
    const m = Math.round(r.huecoMaxM);
    partes.push(r.huecosCerrados === 1 ? `se cerró un hueco de ${m} m` : `se cerraron ${r.huecosCerrados} huecos de hasta ${m} m`);
  }
  if (r.areaRecortadaM2 > 0) partes.push(`se recortaron ${Math.round(r.areaRecortadaM2)} m² de solape`);
  if (!partes.length) return 'No hace falta ajustar nada.';
  const t = partes.join(', ');
  return t.charAt(0).toUpperCase() + t.slice(1) + '.';
}

// ---------------------------------------------------------------- edición de vértices
/** Inserta un vértice después del vértice `lado` (en el punto dado o en el medio del lado). */
export function insertarVertice(poligono: Punto[], lado: number, punto?: Punto): Punto[] {
  const p = sinCierre(poligono);
  const a = p[lado];
  const b = p[(lado + 1) % p.length];
  if (!a || !b) return p;
  const nuevo: Punto = punto ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return [...p.slice(0, lado + 1), nuevo, ...p.slice(lado + 1)];
}

/** Índice del lado más largo (el que parte del vértice i hacia el siguiente). */
export function ladoMasLargo(poligono: Punto[]): number {
  const p = sinCierre(poligono);
  const { aM } = proyector(p[0][0], p[0][1]);
  const m = p.map(aM);
  let mejor = 0, lm = -1;
  m.forEach((v, i) => {
    const l = largo(resta(m[(i + 1) % m.length], v));
    if (l > lm) { lm = l; mejor = i; }
  });
  return mejor;
}

/** Quita el vértice i; con 3 vértices o menos no hace nada (mínimo de un polígono). */
export function quitarVerticeDe(poligono: Punto[], i: number): Punto[] {
  const p = sinCierre(poligono);
  return p.length <= 3 ? p : p.filter((_, j) => j !== i);
}
