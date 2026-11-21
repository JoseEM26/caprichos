/*
 * Utilidades de los peinados largos, recogidos y rizados: mechones aplanados que se afinan, casquete con volumen,
 * trenzas de tres tubos, hélices (rizos), masas esponjosas (afro, moños) y colisión con el cuerpo para que el pelo
 * no atraviese cuello, hombros ni torso. Todo se acumula en una sola malla por grupo (colores por vértice).
 */
import * as T from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

export function crearRng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Punto sobre la cabeza (elipsoide del cráneo): az 0 = frente, + hacia la izquierda del avatar; el 0 = altura de los ojos. */
export const sup = (az: number, el: number, r: number) =>
  V(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r * 0.985, Math.cos(az) * Math.cos(el) * r * 0.97);

/* ---------------------------- ruido ---------------------------- */
function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function ruido3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = suave(0, 1, x - xi), fy = suave(0, 1, y - yi), fz = suave(0, 1, z - zi);
  const c = (a: number, b: number, d: number) => hash3(xi + a, yi + b, zi + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx), x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx), x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

/* ------------------------ colisión con el cuerpo ------------------------ */
export interface Colision { fuera(p: T.Vector3, margen?: number): T.Vector3 }

/** Empuja un punto (coordenadas de la cabeza) fuera del torso, el cuello y los hombros/brazos. */
export function crearColision(partes: any, cabezaY: number): Colision {
  const perfil: number[][] = partes.perfil;
  const ancho: number = partes.ancho;
  const radioEn = (y: number) => {
    for (let i = 0; i < perfil.length - 1; i++) {
      const [r0, y0] = perfil[i], [r1, y1] = perfil[i + 1];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0 || 1));
    }
    return 0;
  };
  const x0 = 0.205 * ancho + 0.02;
  const empujaSeg = (p: T.Vector3, ax: number, ay: number, bx: number, by: number, r: number) => {
    const by_ = p.y + cabezaY;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = Math.min(1, Math.max(0, ((p.x - ax) * dx + (by_ - ay) * dy) / l2));
    const cx = ax + dx * t, cy = ay + dy * t;
    const vx = p.x - cx, vy = by_ - cy, vz = p.z;
    const d = Math.hypot(vx, vy, vz);
    if (d < r) {
      const k = d < 1e-5 ? 1 : r / d;
      if (d < 1e-5) { p.z = -r; return; }
      p.x = cx + vx * k; p.y = cy + vy * k - cabezaY; p.z = vz * k;
    }
  };
  return {
    fuera(p, m = 0.03) {
      for (let it = 0; it < 2; it++) {
        const by = p.y + cabezaY;
        if (by > 0.47 && by < 1.125) {
          const r = radioEn(by);
          const rx = r * ancho + m, rz = r * 0.8 + m;
          const q = Math.hypot(p.x / rx, p.z / rz);
          if (q < 1) {
            if (q < 1e-4) p.z = -rz; else { p.x /= q; p.z /= q; }
          }
        }
        if (by > 1.04 && by < 1.28) {
          const rn = 0.066 + m, d = Math.hypot(p.x, p.z);
          if (d < rn) { if (d < 1e-4) p.z = -rn; else { p.x *= rn / d; p.z *= rn / d; } }
        }
        for (const s of [-1, 1]) {
          empujaSeg(p, s * x0, 1.02, s * x0, 1.02, 0.105 + m * 0.5);
          empujaSeg(p, s * x0, 1.02, s * (x0 + 0.045), 0.6, 0.086 + m * 0.5);
        }
      }
      return p;
    },
  };
}

/* ------------------------------ acumulador ------------------------------ */
export class Acum {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  pivote = V();
  amp = 0;
  fase = 0;
  vel = 1;
  get n() { return this.pos.length / 3; }
  /** Agrega una malla ya hecha (posiciones indexadas) con color por vértice. */
  geo(g: T.BufferGeometry, color: (x: number, y: number, z: number, i: number) => T.Color) {
    const p = g.attributes.position, base = this.n;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), c = color(x, y, z, i);
      this.pos.push(x, y, z); this.col.push(c.r, c.g, c.b);
    }
    const ix = g.index;
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
  }
  construir(): T.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new T.BufferGeometry();
    const pos = new Float32Array(this.pos);
    if (this.pivote.lengthSq()) for (let i = 0; i < pos.length; i += 3) { pos[i] -= this.pivote.x; pos[i + 1] -= this.pivote.y; pos[i + 2] -= this.pivote.z; }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(this.col), 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

/* ------------------------------ opciones ------------------------------ */
export interface OpTubo {
  w: number;
  th: number;
  n?: number;
  m?: number;
  perfil?: (t: number) => number;
  c0?: T.Color;
  c1?: T.Color;
  tinte?: number;
  /** Eje del espesor (hacia fuera) en cada punto; sin él el tubo usa transporte paralelo. */
  hint?: boolean | ((p: T.Vector3) => T.Vector3);
  sombra?: number;
  fuera?: number;
  mod?: (t: number) => number;
  dest?: Acum;
  aplana?: number;
}

/** Perfil de mechón: nace algo más fino, se ensancha y termina en punta redondeada. */
export const perfilMechon = (t: number) => {
  const nace = 0.18 + 0.82 * suave(0, 0.2, t);
  const punta = t < 0.5 ? 1 : Math.pow(Math.max(0, 1 - Math.pow((t - 0.5) / 0.5, 1.7)), 0.62);
  return nace * punta;
};
export const perfilCuerda = (t: number) => {
  const punta = t < 0.9 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.9) / 0.1, 2)));
  return (0.8 + 0.2 * suave(0, 0.1, t)) * punta;
};

/** Dirección hacia afuera usada para orientar los mechones: esférica en la cabeza, cilíndrica más abajo. */
const hintRadial = (p: T.Vector3) => {
  const c = V(0, Math.min(p.y, 0), 0);
  return p.clone().sub(c).normalize();
};

export class Pelo {
  readonly ctx: any;
  readonly rng: () => number;
  readonly col: { raiz: T.Color; base: T.Color; punta: T.Color; luz: T.Color; hondo: T.Color };
  readonly main = new Acum();
  readonly subs: Acum[] = [];
  readonly colision: Colision;
  readonly ligero: boolean;

  constructor(ctx: any, semilla = 11) {
    this.ctx = ctx;
    this.rng = crearRng(semilla);
    this.ligero = ctx.conGorro;
    const base = new T.Color(ctx.col('principal'));
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    this.col = {
      base,
      raiz: new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * 0.62),
      hondo: new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * 0.42),
      punta: new T.Color().setHSL(hsl.h + 0.005, hsl.s, hsl.l + (1 - hsl.l) * 0.09),
      luz: new T.Color().setHSL(hsl.h + 0.012, Math.min(1, hsl.s * 0.9), hsl.l + (1 - hsl.l) * 0.26),
    };
    this.colision = crearColision(ctx.partes, ctx.MED.cabezaY);
  }

  /** Acumulador con pivote propio (se balancea). */
  sub(pivote: T.Vector3, amp = 0.05, fase = 0, vel = 1): Acum {
    const a = new Acum();
    a.pivote.copy(pivote); a.amp = amp; a.fase = fase; a.vel = vel;
    this.subs.push(a);
    return a;
  }

  /** Mechón aplanado (listón con punta) a lo largo de una curva. */
  tubo(pts: T.Vector3[], o: OpTubo) {
    const A = o.dest || this.main;
    const curva = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const largo = curva.getLength();
    const n = o.n || Math.max(5, Math.min(64, Math.round(largo / 0.042)));
    const m = o.m || 6;
    const muestras = curva.getSpacedPoints(n);
    const margen = o.fuera ?? 0;
    // regla del dueño: en la cara nada baja de la frente
    for (const p of muestras) if (p.z > 0.105 && p.y < 0.2 && p.y > -0.2 && Math.abs(p.x) < 0.24) p.y = 0.2;
    if (margen) {
      for (const p of muestras) this.colision.fuera(p, margen);
      for (let it = 0; it < 2; it++) for (let i = 1; i < n; i++) {
        const a = muestras[i - 1], b = muestras[i], c = muestras[i + 1];
        b.set(a.x * 0.25 + b.x * 0.5 + c.x * 0.25, a.y * 0.25 + b.y * 0.5 + c.y * 0.25, a.z * 0.25 + b.z * 0.5 + c.z * 0.25);
      }
    }
    const perfil = o.perfil || perfilMechon;
    const c0 = o.c0 || this.col.raiz, c1 = o.c1 || this.col.punta;
    const tinte = o.tinte ?? 1, sombra = o.sombra ?? 0.28;
    const hintF = typeof o.hint === 'function' ? o.hint : o.hint === false ? null : hintRadial;
    const base = A.n;
    const Tg = new T.Vector3(), B = new T.Vector3(), Wv = new T.Vector3(), prevB = new T.Vector3(0, 0, 1);
    const color = new T.Color();
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = muestras[i];
      const a = muestras[Math.max(0, i - 1)], b = muestras[Math.min(n, i + 1)];
      Tg.subVectors(b, a).normalize();
      if (hintF) {
        const h = hintF(p);
        B.copy(h).addScaledVector(Tg, -h.dot(Tg));
        if (B.lengthSq() < 1e-6) B.copy(prevB);
      } else {
        B.copy(prevB).addScaledVector(Tg, -prevB.dot(Tg));
        if (B.lengthSq() < 1e-6) B.set(1, 0, 0).addScaledVector(Tg, -Tg.x);
      }
      B.normalize(); prevB.copy(B);
      Wv.crossVectors(Tg, B);
      const f = perfil(t) * (o.mod ? o.mod(t) : 1);
      const th = o.th * f, w = o.w * f;
      const gt = Math.pow(t, 0.85);
      for (let j = 0; j < m; j++) {
        const ang = (j / m) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        A.pos.push(p.x + B.x * ca * th + Wv.x * sa * w, p.y + B.y * ca * th + Wv.y * sa * w, p.z + B.z * ca * th + Wv.z * sa * w);
        const sh = (1 - sombra * (0.5 - 0.5 * ca)) * tinte;
        color.copy(c0).lerp(c1, gt).multiplyScalar(sh);
        A.col.push(color.r, color.g, color.b);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = base + i * m + j, b = base + i * m + (j + 1) % m, c = base + (i + 1) * m + j, d = base + (i + 1) * m + (j + 1) % m;
      A.idx.push(a, c, b, b, c, d);
    }
  }

  /** Superficie de la cabeza entre dos puntos (esférica), con abultamiento opcional. */
  ruta(az0: number, el0: number, az1: number, el1: number, r0 = 0.294, r1 = r0, bulto = 0.006, k = 6): T.Vector3[] {
    const a = sup(az0, el0, 1).normalize(), b = sup(az1, el1, 1).normalize();
    const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
    const pts: T.Vector3[] = [];
    for (let i = 0; i <= k; i++) {
      const u = i / k;
      const d = ang < 1e-4 ? a.clone() : a.clone().multiplyScalar(Math.sin((1 - u) * ang) / Math.sin(ang)).addScaledVector(b, Math.sin(u * ang) / Math.sin(ang));
      pts.push(d.multiplyScalar(lerp(r0, r1, u) + bulto * Math.sin(Math.PI * u)));
    }
    return pts;
  }

  /** Línea del nacimiento del pelo según el ángulo (siempre sobre MED.frenteY en la cara). */
  linea(az: number, lado = 0.02, nuca = -0.62): number {
    const a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az)));
    let el = 0.66;
    el = lerp(el, lado, suave(0.9, 1.45, a));
    el = lerp(el, nuca, suave(1.45, 2.7, a));
    return el;
  }

  /** Casquete con volumen, raya y brillo; reemplaza a H.casquete. */
  casquete(o: { r?: number; vol?: number; raya?: number | null; lado?: number; nuca?: number; dest?: Acum; ancho?: number; plano?: number } = {}) {
    const A = o.dest || this.main;
    const R = o.r ?? (this.ligero ? 0.274 : 0.286), vol = this.ligero ? 0 : (o.vol ?? 0.009);
    const nAz = 56, nEl = 20, base = A.n;
    const { raiz, base: cb, punta, luz } = this.col;
    const c = new T.Color();
    for (let j = 0; j <= nEl; j++) {
      for (let i = 0; i < nAz; i++) {
        const az = (i / nAz) * Math.PI * 2 - Math.PI;
        let el0 = this.linea(az, o.lado ?? 0.02, o.nuca ?? -0.62);
        const rr = R * 0.99;
        const z0 = rr * Math.cos(az) * Math.cos(el0) * 0.97;
        if (z0 > 0.112 && rr * Math.sin(el0) * 0.985 < 0.172) el0 = Math.asin(0.172 / (rr * 0.985));
        const u = j / nEl, el = lerp(el0, Math.PI / 2, Math.pow(u, 0.9));
        let r = R + vol * suave(0.2, 1.4, el) * (1 + 0.3 * Math.cos(az - Math.PI)) + 0.003 * Math.sin(az * 6 + el * 4);
        if (j === 0) r -= 0.013; else if (j === 1) r -= 0.005;
        let dip = 0;
        if (o.raya != null) {
          const d = Math.atan2(Math.sin(az - o.raya), Math.cos(az - o.raya));
          dip = Math.exp(-Math.pow(d / 0.045, 2)) * suave(0.55, 1.1, el) * suave(2.4, 1.5, Math.abs(az - o.raya));
          r -= dip * 0.012;
        }
        const p = sup(az, el, r);
        if (o.ancho) p.x *= o.ancho;
        if (o.plano) p.y = Math.min(p.y, o.plano);
        const banda = Math.exp(-Math.pow((el - 1.02) / 0.24, 2)) * (0.55 + 0.45 * Math.cos(az - 0.5));
        c.copy(raiz).lerp(cb, suave(el0, el0 + 0.5, el) * 0.7 + 0.3).lerp(punta, 0.35 + suave(0.5, 1.5, el) * 0.3);
        c.lerp(luz, banda * 0.5).multiplyScalar((1 - dip * 0.55) * (0.9 + 0.16 * Math.sin(az * 46 + el * 2.5 + Math.sin(az * 7) * 2) * suave(0.2, 1.4, 1.57 - el + 0.2)));
        A.pos.push(p.x, p.y, p.z); A.col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < nEl; j++) for (let i = 0; i < nAz; i++) {
      const a = base + j * nAz + i, b = base + j * nAz + (i + 1) % nAz, c2 = base + (j + 1) * nAz + i, d = base + (j + 1) * nAz + (i + 1) % nAz;
      A.idx.push(a, b, c2, b, d, c2);
    }
  }

  /** Masa esponjosa (afro, moño, penacho): elipsoide con lóbulos de ruido y color más oscuro en los huecos. */
  masa(o: { c: T.Vector3; rx: number; ry: number; rz: number; lobulos?: number; alto?: number; recorte?: boolean; dest?: Acum; semilla?: number; res?: number }) {
    const A = o.dest || this.main;
    const res = o.res ?? 44;
    let g: T.BufferGeometry = new T.SphereGeometry(1, res, Math.round(res * 0.72));
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    const p = g.attributes.position;
    const f = o.lobulos ?? 5, s = (o.semilla ?? 3) * 7.31;
    const hu: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i);
      const n1 = ruido3(dx * f + s, dy * f, dz * f), n2 = ruido3(dx * f * 2.3, dy * f * 2.3 + s, dz * f * 2.3);
      const h = n1 * 0.7 + n2 * 0.3;
      hu.push(h);
      const k = 1 + (h - 0.5) * (o.alto ?? 0.28);
      const x = o.c.x + dx * o.rx * k, z = o.c.z + dz * o.rz * k;
      let y = o.c.y + dy * o.ry * k;
      if (o.recorte !== false) {
        // el borde delantero no baja de la frente; los lados y la nuca sí
        const tope = lerp(-0.6, 0.2, suave(-0.02, 0.12, z));
        if (y < tope) y = tope + (tope - y) * 0.0;
      }
      p.setXYZ(i, x, y, z);
    }
    const cc = new T.Color();
    A.geo(g, (_x, y, _z, i) => {
      const h = hu[i];
      cc.copy(this.col.hondo).lerp(this.col.base, suave(0.12, 0.5, h)).lerp(this.col.luz, suave(0.5, 0.85, h) * 0.6);
      const arriba = suave(-0.1, 0.5, y - o.c.y + o.ry * 0.4);
      cc.multiplyScalar(0.8 + 0.3 * arriba);
      return cc;
    });
  }

  /** Nube de bolas (rizos apretados: afro, penachos): bolitas sobre un elipsoide, con sombreado de huecos y brillo arriba. */
  nube(o: { c: T.Vector3; rx: number; ry: number; rz: number; n: number; r: number; dest?: Acum; recorte?: boolean; fondo?: boolean; capas?: number; res?: number }) {
    const A = o.dest || this.main, rng = this.rng;
    let g0: T.BufferGeometry = new T.SphereGeometry(1, o.res ?? 9, 7);
    g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
    g0 = mergeVertices(g0, 1e-4);
    const cc = new T.Color(), dir = V();
    const capas = o.capas ?? 2;
    for (let k = 0; k < o.n; k++) {
      const u = (k + 0.5) / o.n, fi = Math.acos(1 - 2 * u), th = Math.PI * (1 + Math.sqrt(5)) * k;
      dir.set(Math.sin(fi) * Math.cos(th), Math.cos(fi), Math.sin(fi) * Math.sin(th));
      const capa = k % capas, esc = 0.78 + capa * 0.2 + (rng() - 0.5) * 0.06;
      const r = o.r * (0.85 + rng() * 0.35) * (1 - capa * 0.15);
      const px = o.c.x + dir.x * o.rx * esc, py = o.c.y + dir.y * o.ry * esc, pz = o.c.z + dir.z * o.rz * esc;
      if (o.recorte !== false) {
        const tope = lerp(-0.6, 0.2, suave(-0.02, 0.12, pz + r));
        if (py - r * 0.95 < tope) continue;
      }
      const g = g0.clone();
      g.scale(r, r * 0.92, r); g.translate(px, py, pz);
      const arriba = suave(-0.4, 1, dir.y), fuera = 0.35 + 0.65 * (esc - 0.75) / 0.25;
      A.geo(g, (x, y, z) => {
        const nx = (x - px), ny = (y - py), nz = (z - pz), l = Math.hypot(nx, ny, nz) || 1;
        const f = suave(-0.7, 1, (nx * dir.x + ny * dir.y + nz * dir.z) / l);
        cc.copy(this.col.hondo).lerp(this.col.base, 0.5 + 0.5 * f * fuera).lerp(this.col.luz, suave(0.5, 1, f) * (0.25 + arriba * 0.6) * fuera);
        return cc;
      });
    }
    if (o.fondo !== false) this.masa({ c: o.c, rx: o.rx * 0.8, ry: o.ry * 0.8, rz: o.rz * 0.8, lobulos: 2, alto: 0.1, res: 24, dest: A, recorte: o.recorte });
  }

  /** Rizo en hélice alrededor de una curva guía. */
  helice(guia: T.Vector3[], o: { radio: number; vueltas: number; grosor: number; fase?: number; dest?: Acum; fuera?: number; c0?: T.Color; c1?: T.Color; tinte?: number; perfil?: (t: number) => number; m?: number; paso?: number; sombra?: number }) {
    const curva = new T.CatmullRomCurve3(guia, false, 'centripetal');
    const nn = Math.max(10, Math.min(90, Math.round(o.vueltas * 11)));
    const centros = curva.getSpacedPoints(nn);
    const pts: T.Vector3[] = [];
    const prevB = V(0, 0, 1), Tg = V(), Bv = V(), Wv = V();
    const fase = o.fase ?? 0;
    for (let i = 0; i <= nn; i++) {
      const t = i / nn;
      Tg.subVectors(centros[Math.min(nn, i + 1)], centros[Math.max(0, i - 1)]).normalize();
      Bv.copy(prevB).addScaledVector(Tg, -prevB.dot(Tg));
      if (Bv.lengthSq() < 1e-6) Bv.set(1, 0, 0).addScaledVector(Tg, -Tg.x);
      Bv.normalize(); prevB.copy(Bv);
      Wv.crossVectors(Tg, Bv);
      const a = fase + t * o.vueltas * Math.PI * 2;
      const r = o.radio * (0.45 + 0.55 * suave(0, 0.2, t)) * (1 - 0.35 * suave(0.7, 1, t));
      pts.push(centros[i].clone().addScaledVector(Bv, Math.cos(a) * r).addScaledVector(Wv, Math.sin(a) * r));
    }
    this.tubo(pts, {
      w: o.grosor, th: o.grosor, n: Math.round(o.vueltas * 12), m: o.m ?? 6, hint: false, perfil: o.perfil || perfilCuerda,
      dest: o.dest, fuera: o.fuera, c0: o.c0, c1: o.c1, tinte: o.tinte, sombra: o.sombra ?? 0.3,
    });
  }

  /** Trenza de tres tubos entrelazados (fases a 120°) que se estrecha hacia la punta. */
  trenza(guia: T.Vector3[], o: { radio: number; cruces?: number; dest?: Acum; fuera?: number; punta?: number; hint?: boolean }) {
    const curva = new T.CatmullRomCurve3(guia, false, 'centripetal');
    const largo = curva.getLength();
    const nn = Math.max(24, Math.round(largo / 0.011));
    const centros = curva.getSpacedPoints(nn);
    const cruces = o.cruces ?? Math.max(3, Math.round(largo / (o.radio * 2.9)));
    const A = o.dest || this.main;
    const prevB = V(0, 0, 1), Tg = V(), Bv = V(), Wv = V();
    const frames: { p: T.Vector3; B: T.Vector3; W: T.Vector3 }[] = [];
    const colisionados = centros.map((p) => (o.fuera ? this.colision.fuera(p.clone(), o.fuera) : p.clone()));
    for (let i = 0; i <= nn; i++) {
      Tg.subVectors(colisionados[Math.min(nn, i + 1)], colisionados[Math.max(0, i - 1)]).normalize();
      Bv.copy(prevB).addScaledVector(Tg, -prevB.dot(Tg));
      if (Bv.lengthSq() < 1e-6) Bv.set(1, 0, 0).addScaledVector(Tg, -Tg.x);
      Bv.normalize(); prevB.copy(Bv);
      Wv.crossVectors(Tg, Bv);
      frames.push({ p: colisionados[i], B: Bv.clone(), W: Wv.clone() });
    }
    const tonos = [this.col.base, this.col.punta, this.col.raiz];
    for (let k = 0; k < 3; k++) {
      const pts: T.Vector3[] = [];
      for (let i = 0; i <= nn; i++) {
        const t = i / nn, fr = frames[i];
        const e = t > (o.punta ?? 0.55) ? Math.max(0.3, 1 - 0.7 * suave(o.punta ?? 0.55, 1, t)) : 1;
        const a = (k / 3) * Math.PI * 2 + t * cruces * Math.PI;
        const ro = o.radio * 0.58 * e;
        pts.push(fr.p.clone().addScaledVector(fr.B, Math.cos(a) * ro).addScaledVector(fr.W, Math.sin(a) * ro * 0.95));
      }
      this.tubo(pts, {
        w: o.radio * 0.62, th: o.radio * 0.62, n: nn, m: 6, hint: false, perfil: perfilCuerda, dest: A,
        c0: k === 0 ? this.col.raiz : this.col.base, c1: tonos[k], sombra: 0.35, tinte: 0.94 + k * 0.05,
        mod: (t) => (t > (o.punta ?? 0.55) ? Math.max(0.35, 1 - 0.65 * suave(o.punta ?? 0.55, 1, t)) : 1),
      });
    }
  }

  /** Haz de mechones (cola, moño colgante): todos nacen del mismo nudo y se abren un poco hacia el medio. */
  haz(guia: T.Vector3[], o: { radio: number; n: number; w?: number; th?: number; abre?: number; dest?: Acum; fuera?: number; largos?: number[]; ondas?: number; hint?: boolean }) {
    const curva = new T.CatmullRomCurve3(guia, false, 'centripetal');
    const N = 28;
    const centros = curva.getSpacedPoints(N);
    const prevB = V(0, 0, 1), Tg = V(), Bv = V();
    const frames: { B: T.Vector3; W: T.Vector3 }[] = [];
    for (let i = 0; i <= N; i++) {
      Tg.subVectors(centros[Math.min(N, i + 1)], centros[Math.max(0, i - 1)]).normalize();
      Bv.copy(prevB).addScaledVector(Tg, -prevB.dot(Tg));
      if (Bv.lengthSq() < 1e-6) Bv.set(1, 0, 0).addScaledVector(Tg, -Tg.x);
      Bv.normalize(); prevB.copy(Bv);
      frames.push({ B: Bv.clone(), W: V().crossVectors(Tg, Bv) });
    }
    const abre = o.abre ?? 1;
    for (let k = 0; k < o.n; k++) {
      const a = (k / o.n) * Math.PI * 2 + this.rng() * 0.4, rad = o.radio * (0.35 + 0.65 * Math.sqrt(this.rng()));
      const frac = o.largos ? o.largos[k % o.largos.length] : 1;
      const fase = this.rng() * 6.28;
      const pts: T.Vector3[] = [];
      const cuantos = Math.max(4, Math.round(N * frac));
      for (let i = 0; i <= cuantos; i++) {
        const t = (i / cuantos) * frac;
        const idx = Math.min(N, Math.round(t * N));
        const f = frames[idx];
        const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.6 + 0.4 * Math.min(1, t * 6);
        const r = rad * (0.15 + abre * env) * (1 - 0.55 * suave(0.6, 1, t)), ang = a + Math.sin(t * 5 + fase) * 0.25;
        const ond = (o.ondas ?? 0) * Math.sin(t * 9 + fase) * suave(0.05, 0.4, t);
        pts.push(centros[idx].clone().addScaledVector(f.B, Math.cos(ang) * r + ond).addScaledVector(f.W, Math.sin(ang) * r));
      }
      this.tubo(pts, {
        w: o.w ?? 0.034, th: o.th ?? 0.03, hint: o.hint ?? false, dest: o.dest, fuera: o.fuera,
        tinte: 0.9 + this.rng() * 0.22, c1: this.rng() < 0.18 ? this.col.luz : this.col.punta,
      });
    }
  }

  /** Mechones de superficie que nacen de puntos del cuero cabelludo y avanzan hasta otro punto (peinado hacia atrás, raya). */
  peinar(o: { desde: [number, number][]; hasta: (az: number, el: number, i: number) => [number, number]; r?: number; w?: number; th?: number; bulto?: number; dest?: Acum; prolonga?: (fin: T.Vector3, i: number) => T.Vector3[]; extra?: (i: number) => Partial<OpTubo> }) {
    o.desde.forEach(([az, el], i) => {
      const [az1, el1] = o.hasta(az, el, i);
      const r = (o.r ?? 0.296) + (this.rng() - 0.5) * 0.006;
      let pts = this.ruta(az, el, az1, el1, r, r - 0.004, o.bulto ?? 0.008, 6);
      if (o.prolonga) pts = pts.concat(o.prolonga(pts[pts.length - 1].clone(), i));
      this.tubo(pts, {
        w: o.w ?? 0.036, th: o.th ?? 0.026, dest: o.dest, tinte: 0.9 + this.rng() * 0.2,
        c1: this.rng() < 0.16 ? this.col.luz : this.col.punta, ...(o.extra ? o.extra(i) : {}),
      });
    });
  }

  /** Puntos de un mechón que cae por la espalda y los hombros desde un punto del cuero cabelludo. */
  caidaPts(o: { az: number; el: number; psi?: number; elFin?: number; largo: number; onda?: number; frec?: number; fase?: number; r?: number; vuelo?: number }): T.Vector3[] {
    const psi = o.psi ?? o.az;
    const elFin = o.elFin ?? this.linea(psi, -0.05, -0.62) - 0.04;
    const r0 = this.ligero ? 0.284 : (o.r ?? 0.304);
    const S = this.ruta(o.az, this.ligero ? Math.min(o.el, 0.35) : o.el, psi, elFin, r0, r0 + 0.004, 0.007, 5);
    const E = S[S.length - 1];
    const pts = S.slice();
    const sp = Math.sin(psi), cp = Math.cos(psi);
    const frec = o.frec ?? 7, onda = o.onda ?? 0, fase = o.fase ?? 0;
    const pasos = Math.max(3, Math.round(o.largo / 0.07));
    for (let i = 1; i <= pasos; i++) {
      const s = i / pasos, caeY = o.largo * s;
      const y = E.y - caeY;
      const abre = suave(0, 0.5, caeY / 0.5);
      const rx = 0.27 + 0.07 * suave(-0.1, -0.5, y) + (o.vuelo ?? 0) * s;
      const rz = 0.245 - 0.02 * suave(-0.1, -0.5, y) + (o.vuelo ?? 0) * 0.4 * s;
      const x0 = lerp(E.x, sp * rx, abre), z0 = lerp(E.z, cp * rz, abre);
      const ond = onda * Math.sin(s * frec * Math.PI + fase) * suave(0, 0.25, s);
      pts.push(V(x0 + cp * ond, y, z0 - sp * ond));
    }
    return pts;
  }

  caida(o: { az: number; el: number; psi?: number; elFin?: number; largo: number; onda?: number; frec?: number; fase?: number; w?: number; th?: number; r?: number; tinte?: number; dest?: Acum; vuelo?: number; fuera?: number; c0?: T.Color; c1?: T.Color }) {
    const pts = this.caidaPts(o);
    this.tubo(pts, {
      w: o.w ?? 0.05, th: o.th ?? 0.034, dest: o.dest, fuera: o.fuera ?? 0.032, tinte: o.tinte ?? 0.9 + this.rng() * 0.22,
      c0: o.c0, c1: o.c1 ?? (this.rng() < 0.2 ? this.col.luz : this.col.punta),
    });
    return pts;
  }

  /** Puntos de un mechón delantero que cae por delante del hombro (enmarca la cara sin tocarla). */
  frentePts(s: number, largo: number, o: { onda?: number; x?: number; z?: number; fase?: number; abre?: number } = {}) {
    const x = o.x ?? 0.262, z = o.z ?? 0.02, ab = o.abre ?? 1;
    const f = (y: number, dx: number, dz: number) => V(s * (x + dx * ab), y, z + dz);
    const on = o.onda ?? 0, fa = o.fase ?? 0;
    const w1 = on * Math.sin(fa), w2 = on * Math.sin(fa + 1.6), w3 = on * Math.sin(fa + 3.1);
    const fin = -0.2 - largo * 0.96;
    const todos = [f(0.04, -0.002, -0.03), f(-0.06, 0.01, 0.0), f(-0.18, 0.012 + w1, 0.045), f(-0.3, -0.004 + w2, 0.055), f(-0.42, -0.04 + w3, 0.125), f(Math.min(fin, -0.5), -0.07, 0.185)];
    if (fin <= -0.5) { todos[5].y = fin; return todos; }
    // mechón corto: se corta sobre el trazado completo
    const pts: T.Vector3[] = [];
    for (let i = 0; i < todos.length - 1; i++) {
      const a = todos[i], b = todos[i + 1];
      if (a.y <= fin) break;
      pts.push(a);
      if (b.y <= fin) pts.push(a.clone().lerp(b, (a.y - fin) / (a.y - b.y)));
    }
    return pts;
  }

  frente(s: number, largo: number, o: { onda?: number; w?: number; th?: number; x?: number; z?: number; dest?: Acum; fase?: number; abre?: number } = {}) {
    this.tubo(this.frentePts(s, largo, o), { w: o.w ?? 0.046, th: o.th ?? 0.03, dest: o.dest, fuera: 0.032, tinte: 0.95 + this.rng() * 0.15 });
  }

  /** Liga / lazo: toro del color oscuro del cabello. */
  liga(c: T.Vector3, r: number, grosor: number, rot: T.Euler | [number, number, number] = [0, 0, 0], padre?: T.Object3D, color?: string) {
    const ctx = this.ctx;
    const m = ctx.malla(new T.TorusGeometry(r, grosor, 8, 22), ctx.M(color || ctx.tono(ctx.col('principal'), 0.42), { roughness: 0.5 }), c.x, c.y, c.z, padre || ctx.partes.cabeza);
    if (Array.isArray(rot)) m.rotation.set(rot[0], rot[1], rot[2]); else m.rotation.copy(rot);
    return m;
  }

  /** Crea las mallas y devuelve el animador de balanceo. */
  terminar(): { animar: (t: number, dt: number) => void } | undefined {
    const ctx = this.ctx;
    const cab = ctx.partes.cabeza;
    const mat = matPelo();
    const anim: ((t: number) => void)[] = [];
    const gM = this.main.construir();
    if (gM) { const m = new T.Mesh(gM, mat); m.castShadow = true; m.receiveShadow = true; cab.add(m); }
    for (const s of this.subs) {
      const g = s.construir();
      if (!g) continue;
      const m = new T.Mesh(g, mat);
      m.position.copy(s.pivote); m.castShadow = true; m.receiveShadow = true;
      cab.add(m);
      if (s.amp) anim.push((t) => { m.rotation.z = Math.sin(t * 1.7 * s.vel + s.fase) * s.amp; m.rotation.x = Math.sin(t * 1.15 * s.vel + s.fase) * s.amp * 0.6; });
    }
    if (anim.length) return { animar: (t: number) => anim.forEach((f) => f(t)) };
    return undefined;
  }
}

let _mat: T.MeshPhysicalMaterial | null = null;
/** Material compartido: el color viene de los vértices (derivados de ctx.col('principal')); brillo suave de cabello. */
function matPelo() {
  if (!_mat) {
    _mat = new T.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.48, metalness: 0,
      sheen: 0.7, sheenRoughness: 0.4, sheenColor: new T.Color(0xffe6c8), side: T.FrontSide,
    });
  }
  return _mat;
}
