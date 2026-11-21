/*
 * Utilidades de cabello del avatar: geometría reutilizable para peinados con mechones de verdad.
 *
 *  - geoCasquete: volumen base sobre el cráneo (elipsoide de la cabeza), con línea de nacimiento libre, ruido suave y
 *    surcos radiales desde el remolino para que no sea una esfera lisa.
 *  - geoCortina: pelo que cae por los lados y la nuca (cuerpo del bob, de la melena, del mullet) con corte, vuelo y ondas.
 *  - trazar / caer: recorridos de un mechón sobre el casco (siguen el cráneo y luego cuelgan por gravedad).
 *  - geoMechon: mechón en forma de hoja (aplanado, se afina hasta la punta) con color por vértice raíz -> punta.
 *  - crearPelo: acumula todo en UNA malla fusionada (+ mechones sueltos que se balancean).
 * Los colores salen siempre de ctx.col; el degradado raíz/punta es un factor gris por vértice (el color lo pone el material).
 */
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V3 = T.Vector3;
export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

/** Semiejes del cráneo (cabezaR .27 escalada 1, .97, .95 en nucleo.ts). */
export const RX = 0.27, RY = 0.2619, RZ = 0.2565;
/** Borde inferior permitido del cabello en la frente (MED.frenteY + holgura). */
export const FRENTE = 0.168;

/* ------------------------------ azar y ruido ------------------------------ */
export function rng(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
/** Ruido suave determinista en [-1, 1] (suma de senos desfasados, sin tablas). */
export function ruido(x: number, y: number, z: number): number {
  return (Math.sin(x * 1.7 + Math.sin(y * 2.3 + z)) + Math.sin(y * 2.9 + Math.sin(z * 1.9 + x * .7)) * .8 + Math.sin(z * 2.1 + Math.sin(x * 3.1 - y))) / 2.8;
}
export const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };
export const mezcla = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------ superficie del casco ------------------------------ */
/** Punto del casco: el = ángulo vertical (0 ojos, π/2 coronilla), az = 0 frente, + hacia +x. off = separación de la piel. */
export function sup(el: number, az: number, off = 0, o: V3 = V()): V3 {
  const c = Math.cos(el);
  return o.set(Math.sin(az) * c * (RX + off), Math.sin(el) * (RY + off), Math.cos(az) * c * (RZ + off));
}
/** Punto del casco a una altura y (por encima del ecuador sigue el elipsoide, por debajo cae recto con vuelo). */
export function casco(y: number, az: number, off = 0, vuelo = 0, o: V3 = V()): V3 {
  const f = y < 0 ? vuelo * -y : 0;
  const sc = y >= 0 ? Math.sqrt(Math.max(0, 1 - Math.pow(y / (RY + off), 2))) : 1;
  return o.set(Math.sin(az) * (RX + off + f) * sc, y, Math.cos(az) * (RZ + off + f) * sc);
}
/** Elevación (el) cuyo punto del casco queda a la altura y. */
export const elDeY = (y: number, off = 0) => Math.asin(Math.min(.995, Math.max(-.995, y / (RY + off))));

function proyectar(p: V3, off: number, vuelo: number, nrm: V3): void {
  if (p.y >= 0) {
    const rx = RX + off, ry = RY + off, rz = RZ + off;
    const s = Math.sqrt((p.x / rx) ** 2 + (p.y / ry) ** 2 + (p.z / rz) ** 2) || 1;
    p.multiplyScalar(1 / s);
    nrm.set(p.x / (rx * rx), p.y / (ry * ry), p.z / (rz * rz)).normalize();
  } else {
    const f = vuelo * -p.y, rx = RX + off + f, rz = RZ + off + f;
    const s = Math.sqrt((p.x / rx) ** 2 + (p.z / rz) ** 2) || 1;
    p.x /= s; p.z /= s;
    nrm.set(p.x / (rx * rx), 0, p.z / (rz * rz)).normalize();
  }
}

/** Línea de nacimiento: y del borde del pelo según el azimut (simétrica). Todos los valores son alturas locales de la cabeza. */
export function linea(o: { frente?: number; sien?: number; oreja?: number; nuca?: number } = {}): (az: number) => number {
  const { frente = .178, sien = .1, oreja = .07, nuca = -.06 } = o;
  const K: [number, number][] = [[0, frente], [1.0, frente - .004], [1.22, sien], [1.5, oreja], [2.2, mezcla(oreja, nuca, .7)], [Math.PI, nuca]];
  return (az: number) => {
    let a = Math.abs(((az + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    a = Math.min(a, Math.PI);
    for (let i = 0; i < K.length - 1; i++) if (a <= K[i + 1][0]) return mezcla(K[i][1], K[i + 1][1], suave(K[i][0], K[i + 1][0], a));
    return nuca;
  };
}

/* ------------------------------ recorridos de mechones ------------------------------ */
export interface TrazoOpc {
  el: number; az: number; largo: number;
  /** Ángulo de salida: 0 = hacia abajo por el meridiano, + hacia +x (izquierda del avatar), π = hacia arriba. */
  psi?: number;
  curva?: number;       // giro por unidad de largo (rad)
  ondas?: number;       // amplitud (rad) de una onda a lo largo del mechón
  fase?: number;
  frec?: number;
  grav?: number;        // 0..1: cuánto se inclina hacia abajo
  off0?: number; off1?: number; vuelo?: number;
  pasos?: number;
}
const _n = V();
/** Camina sobre el casco desde (el, az); cuando se sale por debajo del ecuador cuelga siguiendo la gravedad. */
export function trazar(o: TrazoOpc): V3[] {
  const { el, az, largo, psi = 0, curva = 0, ondas = 0, fase = 0, frec = 6, grav = 0, off0 = .014, off1 = off0, vuelo = 0, pasos = 8 } = o;
  const e = .02;
  const p = sup(el, az, off0);
  const m = sup(el - e, az, off0).sub(sup(el + e, az, off0)).normalize();
  const es = sup(el, az + e / Math.max(.25, Math.cos(el)), off0).sub(sup(el, az - e / Math.max(.25, Math.cos(el)), off0)).normalize();
  const v = m.clone().multiplyScalar(Math.cos(psi)).addScaledVector(es, Math.sin(psi)).normalize();
  const pts: V3[] = [p.clone()];
  const ds = largo / pasos;
  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos;
    p.addScaledVector(v, ds);
    proyectar(p, mezcla(off0, off1, t), vuelo, _n);
    if (p.z > .115 && p.y < FRENTE) break;   // la hebra se corta antes de bajar por la cara
    v.y -= grav * ds * 3;
    v.addScaledVector(_n, -v.dot(_n)).normalize();
    v.applyAxisAngle(_n, curva * ds + ondas * Math.cos(fase + t * frec) * ds * frec * .5);
    pts.push(p.clone());
  }
  return pts;
}
/** Dirección ψ del flujo del pelo en (el, az) alejándose de un remolino (w) con un giro en espiral. */
export function psiDesde(el: number, az: number, w: { el: number; az: number }, giro = .5): number {
  const p = sup(el, az, 0), q = sup(w.el, w.az, 0);
  const d = p.sub(q);
  const e = .02;
  const m = sup(el - e, az, 0).sub(sup(el + e, az, 0)).normalize();
  const es = sup(el, az + e / Math.max(.25, Math.cos(el)), 0).sub(sup(el, az - e / Math.max(.25, Math.cos(el)), 0)).normalize();
  return Math.atan2(d.dot(es), d.dot(m)) + giro;
}

/* ------------------------------ geometrías ------------------------------ */
export interface MechonOpc {
  ancho?: number; grosor?: number; lados?: number; seg?: number;
  roma?: boolean;            // punta redondeada en vez de afilada
  tono0?: number; tono1?: number; vari?: number; r?: number;
  base?: number;             // ancho relativo en la raíz (0..1)
}
const _a = V(), _b = V(), _c = V(), _d = V();
/** Mechón en forma de hoja: aplanado contra la cabeza, se ensancha un poco y se afina hasta la punta. */
export function geoMechon(pts: V3[], o: MechonOpc = {}): T.BufferGeometry {
  const { ancho = .02, grosor = .009, lados = 5, seg: segO, roma = false, tono0 = .7, tono1 = 1.06, vari = .12, r = .5, base = .8 } = o;
  const cur = new T.CatmullRomCurve3(pts, false, 'centripetal');
  const seg = segO ?? Math.max(4, Math.min(9, Math.round(cur.getLength() / .016)));
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    cur.getPointAt(t, _a); cur.getTangentAt(t, _b).normalize();
    _c.copy(_a).normalize();
    _c.addScaledVector(_b, -_c.dot(_b));
    if (_c.lengthSq() < 1e-6) _c.set(0, 1, 0);
    _c.normalize();                         // N: hacia afuera del casco
    _d.crossVectors(_b, _c).normalize();    // B: ancho del mechón
    const prof = t < .22 ? mezcla(base, 1, t / .22) : roma ? Math.sqrt(Math.max(0, 1 - Math.pow((t - .22) / .78, 3))) : Math.pow(Math.max(0, 1 - (t - .22) / .78), .62);
    const w = ancho * prof, th = grosor * Math.pow(prof, .8);
    const g0 = mezcla(tono0, tono1, Math.pow(t, .8)) * (1 + vari * (r - .5) * 2);
    for (let j = 0; j < lados; j++) {
      const ang = (j / lados) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      pos.push(_a.x + _d.x * ca * w + _c.x * sa * th, _a.y + _d.y * ca * w + _c.y * sa * th, _a.z + _d.z * ca * w + _c.z * sa * th);
      const g = g0 * (.86 + .14 * (sa * .5 + .5));
      col.push(g, g, g);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < lados; j++) {
    const a = i * lados + j, b = i * lados + (j + 1) % lados, c = (i + 1) * lados + j, d = (i + 1) * lados + (j + 1) % lados;
    idx.push(a, c, b, b, c, d);
  }
  return armar(pos, col, idx);
}
function armar(pos: number[], col: number[], idx: number[]): T.BufferGeometry {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export interface CasqueteOpc {
  rim: (az: number) => number;      // línea de nacimiento (y local)
  off?: number;                     // separación base de la piel
  espesor?: (el: number, az: number) => number; // volumen extra (copete, tupé...)
  ruido?: number; surcos?: number;  // amplitud del ruido y de los surcos radiales
  remolino?: { el: number; az: number };
  tono0?: number; tono1?: number;
  nAz?: number; nEl?: number;
  /** Degradado real: fracción (0..1) de piel que asoma en cada punto (y local, azimut, avance rim->coronilla). */
  piel?: (y: number, az: number, k: number) => number;
  ratio?: [number, number, number];  // color de la piel / color del pelo (se calcula con ratioPiel)
  techo?: number;                    // corta la cima en un plano (corte plano / militar)
  hastaEl?: number;                  // elevación final (por defecto la coronilla); < π/2 deja un hueco arriba
}
/** Color de la piel dividido por el del pelo (en el espacio lineal del material) para mezclar por vértice. */
export function ratioPiel(piel: string, pelo: string): [number, number, number] {
  const b = new T.Color(pelo), a = new T.Color(piel).lerp(b, .6).multiplyScalar(.92);   // cuero cabelludo con la sombra del pelo corto
  return [a.r / Math.max(.02, b.r), a.g / Math.max(.02, b.g), a.b / Math.max(.02, b.b)];
}
/** Volumen base del pelo sobre el cráneo: casquete deformado con surcos de mechón y degradado raíz -> punta. */
export function geoCasquete(o: CasqueteOpc): T.BufferGeometry {
  const { rim, off = .013, espesor, ruido: ru = .0035, surcos = .0035, remolino = { el: 1.38, az: 3.0 }, tono0 = .55, tono1 = .98, nAz = 96, nEl = 20, piel, ratio, techo, hastaEl = Math.PI / 2 } = o;
  const W = sup(remolino.el, remolino.az, 0);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const p = V();
  for (let k = 0; k <= nEl; k++) for (let j = 0; j < nAz; j++) {
    const az = (j / nAz) * Math.PI * 2 - Math.PI;
    const kk = k / nEl;
    const el0 = elDeY(rim(az), off);
    const el = mezcla(el0, hastaEl, Math.pow(kk, .9));
    let of = off + (espesor ? espesor(el, az) * Math.sin(Math.min(1, kk * 1.3) * Math.PI / 2) : 0);
    sup(el, az, 0, p);
    const ang = Math.atan2(p.x - W.x, p.z - W.z);
    const gr = Math.sin(ang * 23 + ruido(p.x * 9, p.y * 9, p.z * 9) * 2.2);
    of += (ruido(p.x * 14, p.y * 14, p.z * 14) * ru + gr * surcos) * Math.sin(Math.min(1, kk * 4) * Math.PI / 2);
    of = Math.max(.003, of);
    sup(el, az, of, p);
    if (techo !== undefined && p.y > techo) p.y = techo;
    pos.push(p.x, p.y, p.z);
    const g = mezcla(tono0, tono1, suave(0, .7, kk)) * (1 + .1 * gr + .05 * ruido(p.x * 60, p.y * 60, p.z * 60));
    const f = piel && ratio ? piel(p.y, az, kk) : 0;
    if (f > 0) col.push(g * mezcla(1, ratio![0], f), g * mezcla(1, ratio![1], f), g * mezcla(1, ratio![2], f));
    else col.push(g, g, g);
  }
  for (let k = 0; k < nEl; k++) for (let j = 0; j < nAz; j++) {
    const a = k * nAz + j, b = k * nAz + (j + 1) % nAz, c = (k + 1) * nAz + j, d = (k + 1) * nAz + (j + 1) % nAz;
    idx.push(a, b, c, b, d, c);
  }
  return orientar(armar(pos, col, idx), idx.length);
}
/** Voltea las caras si quedaron mirando hacia adentro (la prueba es el primer triángulo contra el centro de la cabeza). */
function orientar(g: T.BufferGeometry, nIdx: number): T.BufferGeometry {
  const n = g.attributes.normal, p = g.attributes.position;
  let s = 0;
  for (let i = 0; i < p.count; i += 7) s += n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i) + n.getZ(i) * p.getZ(i);
  if (s < 0) {
    const ix = g.index!;
    for (let i = 0; i < nIdx; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); }
    g.computeVertexNormals();
  }
  return g;
}

export interface CortinaOpc {
  desde: number; hasta: number;               // azimut inicial y final (rad); se recorre de menor a mayor
  arriba: (az: number) => number;             // y donde empieza
  abajo: (az: number) => number;              // y del corte
  off?: number; offArriba?: number; vuelo?: number; meter?: number; // meter: cuánto se mete el pelo hacia adentro en el corte
  ondas?: number; ondaAmp?: number;           // ondas en el contorno
  ruido?: number; surcos?: number; nSurcos?: number;
  tono0?: number; tono1?: number; nAz?: number; nY?: number;
}
/** Pelo que cuelga por los lados y la nuca (hoja doblada alrededor del cráneo) con corte, vuelo y surcos. */
export function geoCortina(o: CortinaOpc): T.BufferGeometry {
  const { desde, hasta, arriba, abajo, off = .02, offArriba = off, vuelo = 0, meter = 0, ondas = 0, ondaAmp = 0, ruido: ru = .003, surcos = .004, nSurcos = 26, tono0 = .6, tono1 = 1.0, nAz = 90, nY = 18 } = o;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const p = V();
  for (let k = 0; k <= nY; k++) for (let j = 0; j <= nAz; j++) {
    const az = mezcla(desde, hasta, j / nAz), kk = k / nY;
    const y0 = arriba(az), y1 = abajo(az);
    const y = mezcla(y0, y1, kk);
    const borde = Math.min(1, Math.min(j, nAz - j) / 4);
    const gr = Math.sin(az * nSurcos + ruido(az * 3, kk * 2, 1.3) * 2.4);
    let of = mezcla(offArriba, off, suave(0, .55, kk)) + vuelo * (y0 - y) - meter * suave(.72, 1, kk) + (ruido(az * 7, kk * 5, 2) * ru + gr * surcos) * Math.sin(Math.min(1, kk * 5) * Math.PI / 2);
    of += ondaAmp * Math.sin(az * ondas + kk * 3.5) * suave(0, .5, kk);
    of = Math.max(.004, of) * mezcla(.65, 1, borde);
    casco(y, az, of, 0, p);
    pos.push(p.x, p.y, p.z);
    const g = mezcla(tono0, tono1, suave(0, 1, kk)) * (1 + .11 * gr);
    col.push(g, g, g);
  }
  const w = nAz + 1;
  for (let k = 0; k < nY; k++) for (let j = 0; j < nAz; j++) {
    const a = k * w + j, b = a + 1, c = a + w, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  return orientar(armar(pos, col, idx), idx.length);
}

/* ------------------------------ ensamblado ------------------------------ */
export interface PeloCtx {
  col: (slot: string) => string;
  partes: { cabeza: T.Object3D };
  conGorro: boolean;
  c?: { piel?: string };
}
export interface Pelo {
  readonly gorro: boolean;
  readonly r: () => number;
  /** Agrega una geometría a la malla fusionada del color principal (o del secundario). */
  add(g: T.BufferGeometry, secundario?: boolean): void;
  casquete(o: CasqueteOpc, secundario?: boolean): void;
  cortina(o: CortinaOpc, secundario?: boolean): void;
  mechon(pts: V3[], o?: MechonOpc, secundario?: boolean): void;
  /** Mechón suelto que se balancea (sale de la malla fusionada; úsalo con poco). */
  suelto(pts: V3[], o?: MechonOpc, amp?: number): void;
  /** Cociente piel/pelo del color elegido (para el degradado con piel). */
  ratio(slot?: string): [number, number, number];
  fin(): { animar: (t: number, dt: number) => void } | undefined;
}

function matPelo(color: string, sheen = true): T.MeshPhysicalMaterial {
  const c = new T.Color(color);
  const brillo = c.clone().lerp(new T.Color('#ffffff'), .45);
  return new T.MeshPhysicalMaterial({
    color: c, vertexColors: true, roughness: .5, metalness: 0, side: T.DoubleSide,
    sheen: sheen ? 1 : 0, sheenColor: brillo, sheenRoughness: .42,
    clearcoat: .12, clearcoatRoughness: .45,
  });
}

/** Crea el acumulador de un peinado. Llamar a fin() una sola vez al terminar. */
export function crearPelo(ctx: PeloCtx, semilla = 7): Pelo {
  const cab = ctx.partes.cabeza;
  const r = rng(semilla);
  const listas: [T.BufferGeometry[], T.BufferGeometry[]] = [[], []];
  const sueltos: { gr: T.Group; amp: number; fase: number }[] = [];
  let matP: T.MeshPhysicalMaterial | null = null, matS: T.MeshPhysicalMaterial | null = null;
  const mp = () => matP || (matP = matPelo(ctx.col('principal')));
  const ms = () => matS || (matS = matPelo(ctx.col('secundario')));
  const U: Pelo = {
    gorro: ctx.conGorro, r,
    ratio: (slot = 'principal') => ratioPiel((ctx.c && ctx.c.piel) || '#F2C9A0', ctx.col(slot)),
    add: (g, sec) => { listas[sec ? 1 : 0].push(g); },
    casquete: (o, sec) => U.add(geoCasquete(o), sec),
    cortina: (o, sec) => U.add(geoCortina(o), sec),
    mechon: (pts, o = {}, sec) => { if (pts.length >= 2) U.add(geoMechon(pts, { r: r(), ...o }), sec); },
    suelto(pts, o = {}, amp = .06) {
      const piv = pts[0].clone();
      const g = geoMechon(pts.map((p) => p.clone().sub(piv)), { r: r(), ...o });
      const gr = new T.Group(); gr.position.copy(piv);
      const m = new T.Mesh(g, mp()); m.castShadow = true;
      gr.add(m); cab.add(gr);
      sueltos.push({ gr, amp, fase: r() * 6.28 });
    },
    fin() {
      [[listas[0], mp], [listas[1], ms]].forEach(([ls, mat]) => {
        const gs = ls as T.BufferGeometry[];
        if (!gs.length) return;
        const m = new T.Mesh(mergeGeometries(gs, false)!, (mat as () => T.Material)());
        m.castShadow = true; m.receiveShadow = true;
        cab.add(m);
        gs.forEach((g) => g.dispose());
      });
      if (!sueltos.length) return undefined;
      return {
        animar: (t: number) => sueltos.forEach((s) => {
          s.gr.rotation.z = Math.sin(t * 1.6 + s.fase) * s.amp;
          s.gr.rotation.x = Math.sin(t * 1.1 + s.fase * 1.7) * s.amp * .6;
        }),
      };
    },
  };
  return U;
}

/* ------------------------------ composiciones comunes ------------------------------ */
/** Mechón que va de una raíz a una punta sobre el casco (control total de dónde termina: flequillos, mechones largos). */
export function entre(a: { el: number; az: number }, b: { el: number; az: number }, o: { off0?: number; off1?: number; bulto?: number; curl?: number; pasos?: number } = {}): V3[] {
  const { off0 = .016, off1 = .016, bulto = .01, curl = 0, pasos = 7 } = o;
  const pts: V3[] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos, s = Math.sin(Math.PI * t);
    pts.push(sup(mezcla(a.el, b.el, t), mezcla(a.az, b.az, t) + curl * s, mezcla(off0, off1, t) + bulto * s));
  }
  return pts;
}

export interface RocioOpc {
  n: number; rim: (az: number) => number;
  u?: [number, number];            // franja entre la línea (0) y la coronilla (1)
  az?: [number, number];
  largo: [number, number];
  ancho?: number; grosor?: number; off?: number; sube?: number;
  giro?: number; jitter?: number; grav?: number; curva?: number; ondas?: number;
  psi?: number;                    // fija el ángulo (si no, fluye desde el remolino)
  remolino?: { el: number; az: number };
  sec?: boolean; roma?: boolean; tono0?: number; tono1?: number;
  pasos?: number; vuelo?: number;
}
const frac = (x: number) => x - Math.floor(x);
/** Reparte mechones por la cabeza (secuencia de baja discrepancia) siguiendo el flujo del remolino. */
export function rociar(U: Pelo, o: RocioOpc): void {
  const { n, rim, u = [0, 1], az = [-Math.PI, Math.PI], largo, ancho = .022, grosor = .009, off = .016, sube = .012, giro = .5, jitter = .5, grav = 0, curva = 0, ondas = 0, psi, remolino = { el: 1.38, az: 3.0 }, sec, roma, tono0, tono1, pasos = 7, vuelo = 0 } = o;
  const r = U.r;
  for (let i = 0; i < n; i++) {
    const a = mezcla(az[0], az[1], frac(i * .6180339 + .13));
    const k = mezcla(u[0], u[1], frac(i * .7548777 + .31));
    const el = mezcla(elDeY(rim(a) + .012, off), 1.5, k);
    const p = psi !== undefined ? psi + (r() - .5) * jitter : psiDesde(el, a, remolino, giro) + (r() - .5) * jitter;
    const l = mezcla(largo[0], largo[1], r());
    const o0 = off + r() * .007;
    const pts = trazar({ el, az: a, largo: l, psi: p, grav, curva: curva * (r() < .5 ? -1 : 1), ondas, fase: r() * 6, off0: o0, off1: o0 + sube, pasos, vuelo });
    U.mechon(pts, { ancho: ancho * mezcla(.8, 1.25, r()), grosor, roma, tono0, tono1 }, sec);
  }
}

export interface FlecoOpc {
  tipo: 'recto' | 'lado' | 'cortina' | 'largo_lado';
  n?: number; yTip?: number; ancho?: number; grosor?: number; lado?: number; // lado: +1 barre hacia +x
  sec?: boolean; off?: number;
}
/** Flequillo: siempre termina sobre MED.frenteY; lo largo se va hacia los lados (ojos y cejas quedan libres). */
export function fleco(U: Pelo, o: FlecoOpc): void {
  const { tipo, n = 10, yTip = .182, ancho = .034, grosor = .014, lado = 1, sec, off = .022 } = o;
  const r = U.r;
  const f = (y: number) => elDeY(y, off);
  for (let fila = 0; fila < 2; fila++) for (let i = 0; i < n; i++) {
    const k = (i + (fila ? .5 : 0)) / (n - 1), x = k * 2 - 1;
    const jit = (r() - .5) * .012;
    let a: { el: number; az: number }, b: { el: number; az: number }, m: { el: number; az: number } | null = null, curl = 0, bulto = .026;
    if (tipo === 'recto') {
      const az = x * .78;
      a = { el: 1.16 - fila * .1, az: az * .95 };
      b = { el: f(yTip + jit + Math.abs(x) * .004 + fila * .004), az };
    } else if (tipo === 'lado' || tipo === 'largo_lado') {
      const largo = tipo === 'largo_lado';
      const azT = lado * (-.35 + k * (largo ? 1.6 : 1.4));
      const baja = largo ? suave(1.26, 1.45, azT * lado) : 0;
      a = { el: 1.28 - fila * .1, az: lado * (-.45 + k * .4) };
      b = { el: f(mezcla(yTip + k * .025 + jit, .09, baja)), az: azT };
      if (baja > 0) m = { el: f(.178), az: lado * 1.22 };
      curl = lado * (largo ? .16 : .1); bulto = largo ? .03 : .026;
    } else {
      const s = x < 0 ? -1 : 1, ax = Math.abs(x);
      if (ax < .07) continue;
      a = { el: 1.24 - fila * .08, az: s * .06 };
      const azT = .12 + ax * 1.28;
      b = { el: f(azT > 1.26 ? mezcla(.172, .02, suave(1.26, 1.45, azT)) + jit : .182 + ax * .006 + jit * .5), az: s * azT };
      if (azT > 1.26) m = { el: f(.178), az: s * 1.22 };   // primero cruza la frente por arriba y recién en la sien baja
      curl = -s * .05; bulto = .024;
    }
    const o1 = off + .004 + fila * .004;
    const pts = m ? entre(a, m, { off0: off - .004, off1: o1, bulto, curl, pasos: 5 }).concat(entre(m, b, { off0: o1, off1: o1, bulto: .006, pasos: 3 }).slice(1)) : entre(a, b, { off0: off - .004, off1: o1, bulto, curl, pasos: 7 });
    U.mechon(pts, { ancho: ancho * mezcla(.85, 1.2, r()), grosor, roma: tipo === 'recto', tono0: .82, tono1: 1.08 }, sec);
  }
}

/** Patillas: mechones cortos delante de las orejas, nacen de la línea de nacimiento y caen pegados (|x| > .23, fuera de la cara). */
export function patillas(U: Pelo, rim: (az: number) => number, o: { largo?: number; ancho?: number; n?: number; sec?: boolean; az?: number; off?: number } = {}): void {
  const { largo = .08, ancho = .014, n = 4, sec, az = 1.36, off = .016 } = o;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const a = s * (az + (i - (n - 1) / 2) * .07);
    const l = largo * (1 - Math.abs(i - (n - 1) / 2) * .12) * (.9 + U.r() * .2);
    const pts = trazar({ el: elDeY(rim(a) + .014, off), az: a, largo: l, psi: 0, grav: .2, off0: off, off1: off, pasos: 5 });
    U.mechon(pts, { ancho, grosor: .007, tono0: .8, tono1: 1.02 }, sec);
  }
}

/** Orla: mechoncitos cortos sobre la línea de nacimiento (rompe el corte recto de la nuca y las sienes). */
export function orla(U: Pelo, rim: (az: number) => number, o: { n?: number; az?: [number, number]; largo?: [number, number]; ancho?: number; off?: number; sec?: boolean } = {}): void {
  const { n = 56, az = [1.45, 2 * Math.PI - 1.45], largo = [.025, .045], ancho = .012, off = .015, sec } = o;
  for (let i = 0; i < n; i++) {
    const a = mezcla(az[0], az[1], (i + U.r() * .8) / n);
    const aa = a > Math.PI ? a - 2 * Math.PI : a;
    const pts = trazar({ el: elDeY(rim(aa) + .018, off), az: aa, largo: mezcla(largo[0], largo[1], U.r()), psi: (U.r() - .5) * .5, grav: .3, off0: off, off1: off + .002, pasos: 4 });
    U.mechon(pts, { ancho: ancho * mezcla(.8, 1.2, U.r()), grosor: .007, tono0: .85, tono1: 1 }, sec);
  }
}

/** Normaliza un azimut a [-π, π]. */
export const azN = (a: number) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

/** Mechones largos que bajan por los lados y la nuca desde la coronilla, pegados a la cortina (vista de capas y puntas). */
export function caer(U: Pelo, o: { n: number; az: [number, number]; el?: [number, number]; largo: [number, number]; ancho?: number; grosor?: number; off0?: number; off1?: number; vuelo?: number; grav?: number; ondas?: number; curva?: number; sec?: boolean; roma?: boolean; pasos?: number; hasta?: (az: number) => number }): void {
  const { n, az, el = [.1, .9], largo, ancho = .024, grosor = .009, off0 = .018, off1 = .05, vuelo = 0, grav = .5, ondas = 0, curva = 0, sec, roma, pasos = 9, hasta } = o;
  for (let i = 0; i < n; i++) {
    const a = mezcla(az[0], az[1], frac(i * .6180339 + .21));
    const e = mezcla(el[0], el[1], frac(i * .7548777 + .4));
    const l = mezcla(largo[0], largo[1], U.r());
    let pts = trazar({ el: e, az: a, largo: l, psi: (U.r() - .5) * .3, grav, ondas, curva: curva * (U.r() < .5 ? -1 : 1), fase: U.r() * 6, off0, off1: off1 + U.r() * .006, vuelo, pasos: hasta ? pasos * 2 : pasos });
    if (hasta) {
      // corte: la hebra termina en el borde de la melena (con un poco de desorden), no se pasa de largo
      const yh = hasta(a) - .01 + U.r() * .03;
      const k = pts.findIndex((p) => p.y < yh);
      if (k > 1) { const p0 = pts[k - 1], p1 = pts[k], f = (p0.y - yh) / ((p0.y - p1.y) || 1); pts = pts.slice(0, k); pts.push(p0.clone().lerp(p1, f)); }
    }
    if (pts.length < 3) continue;
    U.mechon(pts, { ancho: ancho * mezcla(.8, 1.25, U.r()), grosor, roma: roma ?? !!hasta, tono0: .75, tono1: 1.06 }, sec);
  }
}

/** Puntas sueltas bajo un corte (rompen la línea recta del borde). */
export function puntas(U: Pelo, o: { n: number; az: [number, number]; abajo: (az: number) => number; off: number; vuelo?: number; largo?: [number, number]; ancho?: number; sec?: boolean }): void {
  const { n, az, abajo, off, vuelo = 0, largo = [.03, .07], ancho = .016, sec } = o;
  for (let i = 0; i < n; i++) {
    const a = mezcla(az[0], az[1], (i + U.r() * .7) / n);
    const y = abajo(a) + .035;
    const p = casco(y, a, off, vuelo);
    const pts: V3[] = [p];
    const l = mezcla(largo[0], largo[1], U.r()), d = (U.r() - .5) * .3;
    for (let k = 1; k <= 4; k++) pts.push(casco(y - (l + .035) * k / 4, a + d * k / 4, off + .003 + k * .001, vuelo));
    U.mechon(pts, { ancho: ancho * mezcla(.8, 1.3, U.r()), grosor: .008, tono0: .85, tono1: 1.05 }, sec);
  }
}

/** Bolita (rizos cortos, copetes): elipsoide con color por vértice. */
export function geoBola(rx: number, ry: number, rz: number, p: V3, tono = 1, q?: T.Quaternion): T.BufferGeometry {
  const g = new T.SphereGeometry(1, 8, 5);
  g.deleteAttribute('uv');
  g.scale(rx, ry, rz);
  if (q) g.applyQuaternion(q);
  g.translate(p.x, p.y, p.z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const yy = g.attributes.position.getY(i) - p.y, f = tono * (.82 + .18 * Math.max(-1, Math.min(1, yy / (ry || 1))) * .5 + .09);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f;
  }
  g.setAttribute('color', new T.BufferAttribute(c, 3));
  return g;
}
