/*
 * Peinados largos, recogidos y rizados del avatar (rehechos con detalle): mechones aplanados que se afinan, casquete con
 * volumen y brillo, trenzas de tres tubos, hélices para los rizos y masas esponjosas. Todo con colores por vértice
 * derivados de ctx.col('principal'). Reglas: nada baja de MED.frenteY en la cara, se respeta el gorro y el cuerpo.
 */
import * as T from 'three';
import { AVATAR } from './nucleo';
import { Pelo, V, sup, perfilCuerda } from './cabello-largo-util';

type Receta = (P: Pelo, g: boolean, alto: boolean) => void;

const PI = Math.PI;
const rango = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));

export function registrarCabelloLargo() {
  const reg = (id: string, nombre: string, grupo: string, receta: Receta, semilla = 11) => {
    AVATAR.registrar('cabello', {
      id, nombre, grupo,
      colores: ['principal'],
      porDefecto: { principal: '#4A2C1D' },
      construir(ctx: any) {
        const P = new Pelo(ctx, semilla);
        receta(P, ctx.conGorro, !ctx.gorroOcultaCabello);
        return P.terminar();
      },
    });
  };

  /* ---------------- piezas compartidas ---------------- */

  /** Flequillo de lado / cortina / recto: listones que nacen de la raya y terminan sobre la frente o las sienes. */
  const flequillo = (P: Pelo, tipo: 'lado' | 'cortina' | 'recto', partAz = 0.35) => {
    const r = P.rng;
    const luz = () => (r() < 0.2 ? P.col.luz : P.col.punta);
    if (tipo === 'lado') {
      const s = Math.sign(partAz) || 1;
      for (let i = 0; i < 10; i++) {
        const k = i / 9;
        const pts = P.ruta(partAz + (r() - 0.5) * 0.12, 1.32 - k * 0.1, partAz - s * (1.3 + k * 0.12) + (r() - 0.5) * 0.1, 0.62 - k * 0.12, 0.298 + k * 0.004, 0.292, 0.012 + k * 0.004, 7);
        P.tubo(pts, { w: 0.04, th: 0.022, tinte: 0.9 + r() * 0.2, c1: luz() });
      }
    } else if (tipo === 'cortina') {
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
        const k = i / 5;
        const pts = P.ruta(s * 0.1, 1.38 - k * 0.1, s * (1.3 + k * 0.12), 0.5 - k * 0.1, 0.298 + k * 0.004, 0.292, 0.012 + k * 0.005, 7);
        P.tubo(pts, { w: 0.038, th: 0.022, tinte: 0.9 + r() * 0.2, c1: luz() });
      }
    } else {
      for (let i = 0; i < 11; i++) {
        const az = (i / 10 - 0.5) * 1.9;
        const pts = P.ruta(az * 0.5, 1.35, az * 1.05, 0.72, 0.298, 0.296, 0.012, 6);
        P.tubo(pts, { w: 0.04, th: 0.022, tinte: 0.9 + r() * 0.2, c1: luz() });
      }
    }
  };

  /** Melena que cae por la espalda: relleno oscuro + mechones exteriores con puntas más claras. */
  const melena = (P: Pelo, o: { largo: number; onda?: number; frec?: number; capas?: boolean; n?: number; vuelo?: number; part?: number; dest?: any; frentes?: boolean; ancho?: number }) => {
    const r = P.rng, n = o.n ?? 40, part = o.part ?? 0.35;
    for (const psi of rango(1.55, 2 * PI - 1.55, 9)) {
      P.caida({ az: psi * 0.7, el: 1.15, psi, largo: o.largo * 0.92, w: 0.085, th: 0.06, r: 0.296, onda: (o.onda ?? 0) * 0.6, frec: o.frec, fase: psi, vuelo: -0.01, c0: P.col.hondo, c1: P.col.raiz, tinte: 0.9, dest: o.dest });
    }
    for (let i = 0; i < n; i++) {
      const psi = 1.45 + (i / (n - 1)) * (2 * PI - 2.9) + (r() - 0.5) * 0.07;
      const centro = 1 - Math.abs(psi - PI) / (PI - 1.45);
      const largo = o.capas ? o.largo * (0.62 + 0.4 * centro + (r() - 0.5) * 0.1) : o.largo * (0.9 + r() * 0.12);
      P.caida({ az: part + (psi - part) * 0.5, el: 1.5 - r() * 0.5, psi, largo, onda: o.onda, frec: o.frec, fase: i * 0.6 + r(), w: 0.058 + r() * 0.018, th: 0.038, vuelo: o.vuelo, dest: o.dest });
    }
    if (o.frentes !== false) for (const s of [-1, 1]) {
      P.frente(s, o.largo * 0.85, { onda: o.onda ? 0.012 : 0, dest: o.dest });
      P.frente(s, o.largo * 0.7, { x: 0.256, z: 0.0, abre: 0.9, w: 0.04, fase: 2, dest: o.dest });
    }
  };

  /** Posición (az, el, radio) de un punto del nudo en coordenadas esféricas de la cabeza. */
  const aEsf = (p: T.Vector3) => ({ az: Math.atan2(p.x, p.z), el: Math.asin(Math.max(-1, Math.min(1, p.y / p.length()))), r: p.length() });

  /** Mechones peinados que nacen en el contorno del pelo y se recogen en un nudo (cola, moño). */
  const converge = (P: Pelo, nudo: T.Vector3, o: { lado?: number; filas?: [number, number][]; fuera?: number } = {}) => {
    const { az: azN, el: elN, r: rN } = aEsf(nudo), r = P.rng;
    const filas = o.filas ?? [[0.05, 40], [0.3, 34], [0.55, 30], [0.8, 26], [1.05, 20], [1.3, 12]];
    for (const [off, cuantos] of filas) {
      for (let i = 0; i < cuantos; i++) {
        const az = -PI + ((i + r() * 0.6) / cuantos) * 2 * PI;
        if (o.lado && Math.sign(Math.sin(az)) !== o.lado) continue;
        if (Math.hypot(Math.atan2(Math.sin(az - azN), Math.cos(az - azN)), (P.linea(az) + off - elN) * 0.9) < 0.3) continue;
        const el = Math.min(1.35, P.linea(az) + off + 0.03);
        const pts = P.ruta(az, el, azN, elN, 0.306 - off * 0.004, rN * 0.97, 0.01 + off * 0.004, 7);
        P.tubo(pts, { w: 0.038, th: 0.024, tinte: 0.9 + r() * 0.2, c1: r() < 0.2 ? P.col.luz : P.col.punta, fuera: o.fuera });
      }
    }
  };

  /** Pelo peinado desde las sienes y la nuca hacia una línea central trasera (trenza francesa, boxeadoras). */
  const haciaLinea = (P: Pelo, s: number, azFin: number, o: { cols?: number; filas?: number[]; elFin?: number } = {}) => {
    const cols = o.cols ?? 11, r = P.rng;
    for (const off of o.filas ?? [0.0, 0.4, 0.8, 1.15]) {
      for (let i = 0; i < cols; i++) {
        const az = s * (0.4 + ((PI - 0.45) * (i + r() * 0.5)) / cols);
        const el = Math.min(1.45, P.linea(az, 0.24, -0.3) + off + 0.03);
        const fin = Math.min(el, 0.6) * 0.5 - 0.1 + (o.elFin ?? 0);
        const pts = P.ruta(az, el, s * azFin, fin, 0.306 - off * 0.004, 0.302, 0.008, 7);
        P.tubo(pts, { w: 0.04, th: 0.024, tinte: 0.9 + r() * 0.2, c1: r() < 0.2 ? P.col.luz : P.col.punta });
      }
    }
  };

  /** Moño: masa esponjosa con vueltas de mechón enrolladas y una liga. */
  const mono = (P: Pelo, c: T.Vector3, rad: number, o: { vueltas?: number; suelto?: number; liga?: boolean; eje?: T.Vector3; ancho?: number } = {}) => {
    const r = P.rng, eje = (o.eje || V(0, 1, 0)).clone().normalize();
    P.masa({ c, rx: rad * 1.0, ry: rad * 0.9, rz: rad * 1.0, lobulos: 3, alto: 0.12, recorte: false, res: 26, semilla: 4 + c.x * 7 });
    const n = o.vueltas ?? 6;
    for (let k = 0; k < n; k++) {
      const a = k / n * PI * 2 + r() * 0.5;
      const norm = V(Math.cos(a) * 0.7 + (r() - 0.5) * 0.4, 0.55 + r() * 0.4, Math.sin(a) * 0.7 + (r() - 0.5) * 0.4).normalize();
      const u = V().crossVectors(norm, V(0, 0, 1)).normalize(); if (u.lengthSq() < 0.1) u.set(1, 0, 0);
      const w = V().crossVectors(norm, u).normalize();
      const pts: T.Vector3[] = [];
      const rr = rad * (0.88 + r() * 0.1), off = (r() - 0.5) * rad * 0.6, ini = r() * PI * 2, giro = 1.35 * PI * 2 * 0.62;
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, th = ini + t * giro;
        const rs = Math.sqrt(Math.max(0.05, 1 - (off / rad) ** 2)) * rr;
        pts.push(c.clone().addScaledVector(norm, off * 1.05).addScaledVector(u, Math.cos(th) * rs * (o.ancho ?? 1)).addScaledVector(w, Math.sin(th) * rs));
      }
      P.tubo(pts, { w: rad * 0.27, th: rad * 0.24, hint: false, perfil: perfilCuerda, c0: P.col.base, c1: P.col.punta, tinte: 0.88 + r() * 0.25, sombra: 0.32, m: 7, n: 18 });
    }
    void eje;
    for (let k = 0; k < (o.suelto ?? 0); k++) {
      const a = r() * PI * 2, d = V(Math.cos(a), 0.2 + r() * 0.8, Math.sin(a)).normalize();
      const pts = [c.clone().addScaledVector(d, rad * 0.5), c.clone().addScaledVector(d, rad * 1.1), c.clone().addScaledVector(d, rad * 1.45).add(V(0, -0.03 - r() * 0.04, 0)), c.clone().addScaledVector(d, rad * 1.55).add(V(0, -0.1 - r() * 0.05, 0))];
      P.tubo(pts, { w: 0.02, th: 0.018, hint: false, tinte: 0.95 });
    }
    if (o.liga !== false) {
      const base = c.clone().addScaledVector(eje, -rad * 0.78);
      const q = new T.Quaternion().setFromUnitVectors(V(0, 0, 1), eje);
      P.liga(base, rad * 0.62, rad * 0.16, new T.Euler().setFromQuaternion(q));
    }
  };

  /** Cola o penacho que nace de un nudo y se balancea (grupo con pivote en el nudo). */
  const cola = (P: Pelo, nudo: T.Vector3, rel: T.Vector3[], o: { radio?: number; n?: number; amp?: number; fase?: number; largos?: number[]; ondas?: number; w?: number; liga?: boolean; ligaRot?: [number, number, number] } = {}) => {
    const S = P.sub(nudo, o.amp ?? 0.06, o.fase ?? 0);
    P.haz(rel.map((p) => p.clone().add(nudo)), { radio: (o.radio ?? 0.08) * 1.3, n: o.n ?? 26, dest: S, largos: o.largos ?? [1, 0.9, 0.96, 0.84, 1], ondas: o.ondas, w: o.w });
    if (o.liga !== false) P.liga(nudo, (o.radio ?? 0.08) * 0.8, 0.018, o.ligaRot ?? [-0.4, PI / 2 - 0.2, 0]);
    return S;
  };

  /** Base de cabeza común (casquete + flequillo opcional). */
  const base = (P: Pelo, g: boolean, o: { raya?: number | null; fleq?: 'lado' | 'cortina' | 'recto' | null; part?: number; lado?: number; nuca?: number } = {}) => {
    P.casquete({ raya: o.raya === undefined ? 0.35 : o.raya, lado: o.lado, nuca: o.nuca });
    if (!g && o.fleq !== null) flequillo(P, o.fleq || 'lado', o.part ?? 0.35);
  };

  /* ============================== LARGO ============================== */
  reg('largo_lacio', 'Largo lacio', 'Largo', (P, g, alto) => {
    if (alto) base(P, g);
    melena(P, { largo: 0.6 });
  });
  reg('largo_ondulado', 'Largo ondulado', 'Largo', (P, g, alto) => {
    if (alto) base(P, g);
    melena(P, { largo: 0.58, onda: 0.04, frec: 6, vuelo: 0.02 });
  }, 12);
  reg('largo_raya_medio', 'Largo con raya al medio', 'Largo', (P, g, alto) => {
    if (alto) base(P, g, { raya: 0, fleq: 'cortina' });
    melena(P, { largo: 0.62, part: 0 });
  }, 13);
  reg('ondas_playa', 'Ondas de playa', 'Largo', (P, g, alto) => {
    if (alto) base(P, g);
    melena(P, { largo: 0.5, onda: 0.055, frec: 4.2, vuelo: 0.04 });
  }, 14);
  reg('largo_capas', 'Largo con capas', 'Largo', (P, g, alto) => {
    if (alto) base(P, g, { raya: 0.1, fleq: 'cortina' });
    melena(P, { largo: 0.68, capas: true, onda: 0.012, frec: 5, part: 0.1 });
  }, 15);

  reg('media_cola', 'Media cola', 'Largo', (P, g, alto) => {
    const nudo = V(0, 0.13, -0.28);
    if (alto) {
      base(P, g);
      if (!g) converge(P, nudo, { filas: [[0.55, 20], [0.95, 14]] });
    }
    melena(P, { largo: 0.52, onda: 0.02, frec: 5 });
    if (alto && !g) cola(P, nudo, [V(0, 0, 0), V(0, -0.07, -0.07), V(0, -0.22, -0.09), V(0, -0.42, -0.06)], { radio: 0.085, n: 20, largos: [1, 0.85, 0.95] });
  }, 16);

  /* ============================== RECOGIDO ============================== */
  reg('cola_alta', 'Cola alta', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { lado: 0.24, nuca: -0.3 });
    if (g) return;
    const nudo = V(0, 0.2, -0.265);
    converge(P, nudo);
    cola(P, nudo, [V(0, 0, 0), V(0, 0.07, -0.09), V(0, 0.05, -0.19), V(0, -0.08, -0.25), V(0, -0.3, -0.26), V(0, -0.52, -0.2)], { radio: 0.1, n: 28, amp: 0.07 });
  }, 21);
  reg('cola_baja', 'Cola baja', 'Recogido', (P, g, alto) => {
    const nudo = V(0, -0.07, -0.285);
    if (alto) { base(P, g, { fleq: 'cortina', raya: 0, nuca: -0.3, lado: 0.2 }); if (!g) converge(P, nudo); }
    cola(P, nudo, [V(0, 0, 0), V(0, -0.1, -0.04), V(0, -0.28, -0.05), V(0, -0.5, -0.03), V(0, -0.64, 0.0)], { radio: 0.085, n: 24, amp: 0.05, ligaRot: [0.2, PI / 2, 0] });
  }, 22);
  reg('dos_colitas', 'Dos colitas', 'Recogido', (P, g, alto) => {
    if (alto) base(P, g, { fleq: 'cortina', raya: 0, lado: 0.24, nuca: -0.3 });
    if (!alto) return;
    for (const s of [-1, 1]) {
      const nudo = V(s * 0.205, 0.1, -0.2);
      if (!g) converge(P, nudo, { lado: s, filas: [[0.05, 32], [0.3, 26], [0.55, 22], [0.8, 18], [1.05, 14], [1.3, 8]] });
      cola(P, nudo, [V(0, 0, 0), V(s * 0.07, -0.01, -0.05), V(s * 0.13, -0.1, -0.06), V(s * 0.15, -0.26, -0.04), V(s * 0.13, -0.4, -0.01)], { radio: 0.075, n: 20, amp: 0.1, fase: s, ligaRot: [0, PI / 2 - s * 0.6, 0] });
    }
  }, 23);
  reg('mono_alto', 'Moño alto', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { lado: 0.24, nuca: -0.3 });
    if (g) return;
    const c = V(0, 0.37, -0.07);
    converge(P, V(0, 0.3, -0.1));
    mono(P, c, 0.12, { vueltas: 7, suelto: 3 });
  }, 24);
  reg('mono_bajo', 'Moño bajo (tomate)', 'Recogido', (P, g, alto) => {
    if (alto) { base(P, g, { fleq: 'cortina', raya: 0, nuca: -0.3, lado: 0.2 }); if (!g) converge(P, V(0, -0.08, -0.29)); }
    mono(P, V(0, -0.1, -0.33), 0.1, { vueltas: 6, eje: V(0, 0, -1) });
  }, 25);
  reg('dos_monos', 'Dos moños (space buns)', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { fleq: 'cortina', raya: 0, lado: 0.24, nuca: -0.3 });
    if (g) return;
    for (const s of [-1, 1]) {
      converge(P, V(s * 0.17, 0.26, -0.07), { lado: s, filas: [[0.05, 14], [0.5, 12], [0.95, 8]] });
      mono(P, V(s * 0.17, 0.33, -0.05), 0.09, { vueltas: 5, suelto: 1, eje: V(s * 0.2, 1, 0) });
    }
  }, 26);
  reg('mono_despeinado', 'Moño despeinado', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { raya: 0.6, fleq: 'lado', part: 0.6, lado: 0.24, nuca: -0.3 });
    if (g) return;
    converge(P, V(0, 0.3, -0.1), { filas: [[0.4, 16], [0.95, 12]] });
    mono(P, V(0.02, 0.37, -0.08), 0.13, { vueltas: 9, suelto: 7, ancho: 1.1 });
    for (const s of [-1, 1]) P.frente(s, 0.08, { x: 0.258, z: 0.0, w: 0.05, th: 0.03, fase: s });
  }, 27);
  reg('coletas_altas', 'Coletas altas', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { fleq: 'cortina', raya: 0, lado: 0.24, nuca: -0.3 });
    if (g) return;
    for (const s of [-1, 1]) {
      const nudo = V(s * 0.15, 0.22, -0.17);
      converge(P, nudo, { lado: s, filas: [[0.05, 32], [0.3, 26], [0.55, 22], [0.8, 18], [1.05, 14], [1.3, 8]] });
      cola(P, nudo, [V(0, 0, 0), V(s * 0.05, 0.07, -0.05), V(s * 0.13, 0.04, -0.09), V(s * 0.2, -0.1, -0.11), V(s * 0.22, -0.3, -0.09), V(s * 0.18, -0.5, -0.06)], { radio: 0.075, n: 22, amp: 0.1, fase: s * 1.3, ligaRot: [0, PI / 2 - s * 0.6, 0] });
    }
  }, 28);
  reg('cola_flequillo', 'Cola con flequillo', 'Recogido', (P, g, alto) => {
    if (!alto) return;
    base(P, g, { fleq: 'recto', raya: null, lado: 0.24, nuca: -0.3 });
    if (g) return;
    const nudo = V(0, 0.2, -0.265);
    converge(P, nudo, { filas: [[0.12, 26], [0.55, 20], [0.95, 14]] });
    for (const s of [-1, 1]) P.frente(s, 0.1, { x: 0.258, z: 0.0, w: 0.056, th: 0.032, fase: s });
    cola(P, nudo, [V(0, 0, 0), V(0, 0.07, -0.09), V(0, 0.05, -0.19), V(0, -0.08, -0.25), V(0, -0.3, -0.26), V(0, -0.52, -0.2)], { radio: 0.1, n: 28, amp: 0.07, fase: 1 });
  }, 29);

  /** Trenza colgante con balanceo (pivote en el nudo). */
  const trenzaColgante = (P: Pelo, nudo: T.Vector3, rel: T.Vector3[], radio: number, amp = 0.05, fase = 0) => {
    const S = P.sub(nudo, amp, fase);
    P.trenza(rel.map((p) => p.clone().add(nudo)), { radio, dest: S, fuera: 0.05 });
    // mechón suelto de la punta
    const fin = rel[rel.length - 1].clone().add(nudo);
    P.liga(fin.clone().add(V(0, 0.02, 0)), radio * 0.78, 0.017, [PI / 2, 0, 0], undefined);
    P.haz([fin.clone().add(V(0, 0.01, 0)), fin.clone().add(V(0, -0.05, 0)), fin.clone().add(V(0, -0.11, 0.005))], { radio: radio * 1.5, n: 7, dest: S, w: 0.02, th: 0.018, abre: 1.3 });
    return S;
  };
  reg('trenza', 'Trenza', 'Recogido', (P, g, alto) => {
    const nudo = V(0, -0.1, -0.285);
    if (alto) { base(P, g, { fleq: 'cortina', raya: 0, nuca: -0.3, lado: 0.2 }); if (!g) converge(P, nudo); }
    trenzaColgante(P, nudo, [V(0, 0, 0), V(0, -0.1, -0.03), V(0, -0.26, -0.03), V(0, -0.44, -0.0), V(0, -0.6, 0.02)], 0.052);
  }, 31);
  reg('dos_trenzas', 'Dos trenzas', 'Recogido', (P, g, alto) => {
    if (alto) base(P, g, { fleq: 'cortina', raya: 0, nuca: -0.3, lado: 0.2 });
    for (const s of [-1, 1]) {
      const nudo = V(s * 0.2, -0.07, -0.19);
      if (alto && !g) converge(P, nudo, { lado: s, filas: [[0.05, 28], [0.3, 24], [0.55, 20], [0.8, 16], [1.05, 12], [1.3, 6]] });
      trenzaColgante(P, nudo, [V(0, 0, 0), V(s * 0.03, -0.12, -0.04), V(s * 0.05, -0.28, -0.05), V(s * 0.05, -0.44, -0.04), V(s * 0.04, -0.58, -0.02)], 0.046, 0.06, s);
    }
  }, 32);
  reg('trenza_espiga', 'Trenza francesa', 'Recogido', (P, g, alto) => {
    if (alto) {
      base(P, g, { fleq: 'lado', raya: null });
      if (!g) {
        for (const s of [-1, 1]) haciaLinea(P, s, PI - 0.15, { cols: 12 });
        const guia = P.ruta(0.02, 1.12, PI, 0.05, 0.31, 0.307, 0.0, 9);
        guia.push(V(0, -0.15, -0.3), V(0, -0.3, -0.26));
        P.trenza(guia, { radio: 0.036 });
      }
    }
    const nudo = V(0, -0.3, -0.26);
    trenzaColgante(P, nudo, [V(0, 0, 0), V(0, -0.14, 0.0), V(0, -0.3, 0.02), V(0, -0.46, 0.02)], 0.045);
  }, 33);
  reg('trenzas_boxeadoras', 'Trenzas boxeadoras', 'Recogido', (P, g, alto) => {
    if (alto) {
      base(P, g, { fleq: null, raya: 0 });
      if (!g) for (const s of [-1, 1]) {
        haciaLinea(P, s, PI - 0.5, { cols: 10 });
        const guia = P.ruta(s * 0.3, 1.12, s * (PI - 0.42), 0.12, 0.308, 0.305, 0.0, 9);
        guia.push(V(s * 0.1, -0.12, -0.28), V(s * 0.1, -0.26, -0.25));
        P.trenza(guia, { radio: 0.032 });
      }
    }
    for (const s of [-1, 1]) {
      const nudo = V(s * 0.1, -0.26, -0.25);
      trenzaColgante(P, nudo, [V(0, 0, 0), V(0, -0.14, 0.0), V(0, -0.3, 0.02), V(0, -0.44, 0.03)], 0.04, 0.04, s);
    }
  }, 34);
  reg('media_cola_trenza', 'Media cola con trenza', 'Recogido', (P, g, alto) => {
    const nudo = V(0, 0.13, -0.28);
    if (alto) {
      base(P, g);
      if (!g) converge(P, nudo, { filas: [[0.55, 20], [0.95, 14]] });
    }
    melena(P, { largo: 0.5, onda: 0.015, frec: 5 });
    if (alto && !g) trenzaColgante(P, nudo, [V(0, 0, 0), V(0, -0.06, -0.07), V(0, -0.2, -0.09), V(0, -0.38, -0.08), V(0, -0.55, -0.05)], 0.05);
  }, 35);

  /* ============================ RIZADO / AFRO ============================ */
  /** Rizo corto en hélice nacido del cuero cabelludo. */
  const rizoCabeza = (P: Pelo, az: number, el: number, o: { largo?: number; radio?: number; grosor?: number; vueltas?: number; r?: number; arriba?: number } = {}) => {
    const r0 = o.r ?? 0.29, p = sup(az, el, r0), nrm = p.clone().normalize();
    const tg = V().crossVectors(nrm, V(0, 1, 0)).normalize().multiplyScalar(P.rng() - 0.5).addScaledVector(V(0, 1, 0).addScaledVector(nrm, -nrm.y), 0.6 * (P.rng() - 0.3));
    const dir = nrm.clone().multiplyScalar(0.7).add(tg).add(V(0, o.arriba ?? 0.15, 0)).normalize();
    const l = o.largo ?? 0.07;
    const guia = [p.clone().multiplyScalar(0.96), p.clone().addScaledVector(dir, l * 0.5), p.clone().addScaledVector(dir, l)];
    P.helice(guia, { radio: o.radio ?? 0.03, vueltas: o.vueltas ?? 2.2, grosor: o.grosor ?? 0.016, fase: P.rng() * 6, m: 5, c0: P.col.raiz, c1: P.rng() < 0.2 ? P.col.luz : P.col.punta, tinte: 0.9 + P.rng() * 0.2 });
  };
  const anillosRizos = (P: Pelo, g: boolean, filas: [number, number][], o: Parameters<typeof rizoCabeza>[3] = {}) => {
    for (const [el, n] of filas) {
      if (g && el > 0.2) continue;
      for (let i = 0; i < n; i++) {
        const az = -PI + ((i + P.rng() * 0.6) / n) * 2 * PI;
        if (el < P.linea(az) + 0.1) continue;
        rizoCabeza(P, az, el + (P.rng() - 0.5) * 0.08, o);
      }
    }
  };
  reg('rizado_corto', 'Rizado corto', 'Rizado', (P, g, alto) => {
    if (!alto) return;
    P.casquete({ vol: 0.02 });
    if (g) return;
    anillosRizos(P, g, [[1.45, 3], [1.22, 8], [0.98, 13], [0.74, 15], [0.45, 17], [0.12, 15], [-0.2, 14]], { largo: 0.085, radio: 0.03, grosor: 0.017 });
  }, 41);
  reg('afro', 'Afro', 'Rizado', (P, g, alto) => {
    if (!alto) return;
    if (g) { P.casquete(); return; }
    P.casquete({ r: 0.288 });
    P.nube({ c: V(0, 0.15, -0.1), rx: 0.4, ry: 0.36, rz: 0.38, n: 300, r: 0.072 });
    anillosRizos(P, g, [[0.78, 12]], { largo: 0.05, radio: 0.024, grosor: 0.014, arriba: 0.6 });
  }, 42);
  reg('afro_puff', 'Afro puff', 'Rizado', (P, g, alto) => {
    if (!alto) return;
    P.casquete({ vol: 0.018 });
    if (g) return;
    anillosRizos(P, g, [[1.05, 12], [0.75, 16], [0.45, 16], [0.15, 14], [-0.15, 12]], { largo: 0.07, radio: 0.026, grosor: 0.015 });
    P.nube({ c: V(0, 0.42, -0.13), rx: 0.2, ry: 0.18, rz: 0.19, n: 110, r: 0.07, recorte: false });
    P.liga(V(0, 0.27, -0.1), 0.12, 0.022, [-0.3 + PI / 2, 0, 0]);
  }, 43);
  /** Rizos largos en tirabuzón que cuelgan por la espalda con la silueta de una melena. */
  const tirabuzones = (P: Pelo, o: { largo: number; n: number; radio?: number; grosor?: number; part?: number; amp?: number; vueltasPorM?: number; frentes?: boolean }) => {
    const r = P.rng, S = P.sub(V(0, -0.05, -0.15), o.amp ?? 0.025, 0.4);
    for (const psi of rango(1.55, 2 * PI - 1.55, 9)) P.caida({ az: psi * 0.7, el: 1.15, psi, largo: o.largo * 0.85, w: 0.09, th: 0.065, r: 0.288, vuelo: -0.01, c0: P.col.hondo, c1: P.col.raiz, tinte: 0.9, dest: S });
    for (let i = 0; i < o.n; i++) {
      const psi = 1.4 + ((i + r() * 0.5) / o.n) * (2 * PI - 2.8);
      const largo = o.largo * (0.8 + r() * 0.25);
      const pts = P.caidaPts({ az: (o.part ?? 0.3) + (psi - (o.part ?? 0.3)) * 0.5, el: 1.3 - r() * 0.3, psi, largo, r: 0.31 });
      const guia = pts.slice(2);
      P.helice(guia, { radio: o.radio ?? 0.036, vueltas: largo * (o.vueltasPorM ?? 13), grosor: o.grosor ?? 0.021, fase: r() * 6, dest: S, fuera: 0.04, c0: P.col.raiz, c1: r() < 0.2 ? P.col.luz : P.col.punta, tinte: 0.9 + r() * 0.2 });
    }
    if (o.frentes !== false) for (const s of [-1, 1]) for (const [l, x] of [[0.8, 0.262], [0.55, 0.255]] as const) {
      const guia = P.frentePts(s, o.largo * l, { x, z: x > 0.258 ? 0.02 : 0.0 });
      P.helice(guia, { radio: 0.032, vueltas: o.largo * l * 14, grosor: 0.02, fase: r() * 6, fuera: 0.04, c0: P.col.raiz, c1: P.col.punta });
    }
  };
  reg('rizos_largos', 'Rizos largos', 'Rizado', (P, g, alto) => {
    if (alto) {
      P.casquete({ vol: 0.02, raya: 0.3 });
      if (!g) anillosRizos(P, g, [[1.4, 3], [1.18, 8], [0.95, 12], [0.72, 12]], { largo: 0.06, radio: 0.026, grosor: 0.015 });
    }
    tirabuzones(P, { largo: 0.5, n: 30 });
  }, 44);
  reg('rizos_raya_costado', 'Rizos con raya al costado', 'Rizado', (P, g, alto) => {
    if (alto) {
      P.casquete({ vol: 0.02, raya: 0.55 });
      if (!g) {
        flequillo(P, 'lado', 0.55);
        anillosRizos(P, g, [[1.3, 4], [1.05, 9]], { largo: 0.05, radio: 0.024, grosor: 0.014 });
      }
    }
    tirabuzones(P, { largo: 0.36, n: 28, part: 0.55, radio: 0.034, grosor: 0.02 });
  }, 45);
  reg('rastas', 'Rastas', 'Rizado', (P, g, alto) => {
    if (alto) P.casquete({ vol: 0.012 });
    const subs = [P.sub(V(0, -0.1, -0.1), 0.03, 0), P.sub(V(0, -0.1, -0.1), 0.03, 2), P.sub(V(0, -0.1, -0.1), 0.03, 4)];
    const filas: [number, number, number][] = [[0.45, 22, 0.55], [0.1, 20, 0.7], [-0.2, 18, 0.8], [0.85, 20, 0.45], [1.2, 11, 0.35], [1.45, 5, 0.3]];
    for (const [el, n, alt] of filas) {
      if (g && el > 0.2) continue;
      for (let i = 0; i < n; i++) {
        const az = -PI + ((i + P.rng() * 0.5) / n) * 2 * PI;
        if (el < P.linea(az) + 0.08) continue;
        if (!alto && el > 0.3) continue;
        const p = sup(az, el, 0.288), nr = p.clone().normalize();
        const largo = (0.28 + P.rng() * 0.2) * (0.6 + alt) * 0.85, ph = P.rng() * 6;
        const out = nr.clone().multiplyScalar(0.07);
        const pts = [p.clone().multiplyScalar(0.97), p.clone().add(out.clone().multiplyScalar(0.6)).add(V(0, 0.01, 0)), p.clone().add(out).add(V(0, -0.06, 0)), p.clone().add(out.clone().multiplyScalar(1.5)).add(V(0, -largo * 0.45, 0)), p.clone().add(out.clone().multiplyScalar(1.5)).add(V(0, -largo, 0))];
        const dest = subs[Math.floor(((az + PI) / (2 * PI)) * 3) % 3];
        P.tubo(pts, { w: 0.026, th: 0.026, hint: false, perfil: perfilCuerda, fuera: 0.032, dest, m: 7, c0: P.col.raiz, c1: P.col.punta, tinte: 0.85 + P.rng() * 0.25, mod: (t) => 1 + 0.12 * Math.sin(t * 38 + ph), sombra: 0.3 });
      }
    }
  }, 46);
  reg('bantu_knots', 'Nudos bantú', 'Rizado', (P, g, alto) => {
    if (!alto) return;
    P.casquete({ vol: 0.01 });
    if (g) return;
    const nudos: [number, number][] = [[PI / 2, 1.5]];
    for (const [el, n] of [[1.12, 6], [0.82, 9], [0.42, 9], [0.0, 8]] as [number, number][]) {
      for (let i = 0; i < n; i++) {
        const az = -PI + ((i + (el === 0.82 ? 0.5 : 0)) / n) * 2 * PI;
        if (el < P.linea(az) + 0.16) continue;
        nudos.push([az, el]);
      }
    }
    for (const [az, el] of nudos) {
      const p = sup(az, el, 0.288), nr = p.clone().normalize();
      nr.y += 0.15; nr.normalize();
      const u = V().crossVectors(nr, V(0, 1, 0)).normalize(); if (u.lengthSq() < 0.1) u.set(1, 0, 0);
      const w = V().crossVectors(nr, u).normalize();
      const pts: T.Vector3[] = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26, a = t * PI * 2 * 3.1;
        const rr = 0.058 * (1 - 0.82 * t) + 0.004;
        pts.push(p.clone().addScaledVector(nr, 0.012 + t * 0.075).addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr));
      }
      P.tubo(pts, { w: 0.022, th: 0.022, hint: false, perfil: perfilCuerda, m: 6, n: 40, c0: P.col.raiz, c1: P.col.punta, tinte: 0.9 + P.rng() * 0.2, sombra: 0.35 });
    }
  }, 47);
}
