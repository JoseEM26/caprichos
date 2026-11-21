/*
 * Peinados de los grupos Corto, Con cerquillo y Mediano. Cada uno es una receta corta sobre cabello-util.ts:
 * volumen base (casquete / cortina) + mechones en forma de hoja + flequillo + patillas.
 * Reglas fijas: nada baja de la frente en la cara (el flequillo termina en FRENTE), ctx.conGorro baja el volumen de arriba
 * y con un gorro que oculta el cabello solo se construye lo que asoma (la parte baja).
 */
import {
  azN, caer, elDeY, fleco, geoBola, linea, mezcla, orla, patillas, puntas, rociar, sup, suave, trazar, V,
  type Pelo, type PeloCtx,
} from './cabello-util';

type Ctx = PeloCtx & { gorroOcultaCabello?: boolean };
type Receta = (U: Pelo, ctx: Ctx, arriba: boolean) => void;
type Reg = (id: string, nombre: string, grupo: string, construir: (U: Pelo, ctx: Ctx) => void, secundario?: string) => void;

const PI = Math.PI;

/** Corte de la melena: y del borde según el azimut (más largo al frente que atrás si dif > 0). */
const corte = (frente: number, atras: number, desde: number, onda = 0) => (az: number) => {
  const a = Math.abs(azN(az));
  return mezcla(frente, atras, suave(desde, PI - .35, a)) + onda * Math.sin(a * 9);
};

interface MelenaOpc {
  rim: (az: number) => number; frente: number; atras: number; desde?: number; off?: number; vuelo?: number; meter?: number;
  ondas?: number; ondaAmp?: number; caen?: number; ondasMech?: number; curvaMech?: number; puntasN?: number; sec?: boolean;
  onda?: number; roma?: boolean; ancho?: number;
}
/** Pelo que cae por los lados y la nuca: cortina con corte + mechones largos + puntas sueltas. */
function melena(U: Pelo, arriba: boolean, o: MelenaOpc): (az: number) => number {
  const { rim, frente, atras, desde = 1.22, off = .04, vuelo = .05, meter = .012, ondas = 0, ondaAmp = 0, caen = 70, ondasMech = 0, curvaMech = 0, puntasN = 40, sec, onda = 0, roma = false, ancho = .026 } = o;
  const abajo = corte(frente, atras, desde, onda);
  U.cortina({
    desde, hasta: 2 * PI - desde, off, offArriba: .017, vuelo, meter, ondas, ondaAmp,
    arriba: (az) => Math.max(rim(az), 0) + (U.gorro ? .17 : .06), abajo,
  }, sec);
  const largoMax = Math.abs(.1 - atras) + .1;
  if (arriba || !U.gorro) {
    caer(U, {
      n: caen, az: [desde + .02, 2 * PI - desde - .02], el: arriba ? [.05, .95] : [.05, .3], largo: [largoMax * 1.4, largoMax * 1.7],
      ancho, off0: .019, off1: off + .006, vuelo, grav: .55, ondas: ondasMech, curva: curvaMech, sec, roma, hasta: abajo,
    });
  }
  puntas(U, { n: puntasN, az: [desde + .03, 2 * PI - desde - .03], abajo, off: off - meter * .5, vuelo, sec, largo: [.012, .03], ancho: .02 });
  return abajo;
}

/** Mechones que enmarcan la cara: caen por delante de la oreja hasta la altura que se pida (siempre |x| > .23). */
function enmarcar(U: Pelo, largo: number, n = 3, az = 1.3, ancho = .02, off = .028): void {
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const a = s * (az + i * .075);
    const pts = trazar({ el: .26 - i * .03, az: a, largo: largo * (1 - i * .08), psi: 0, grav: .45, curva: s * .1 * (i % 2 ? 1 : -1), off0: off, off1: off + .012, vuelo: .05, pasos: 8 });
    U.suelto(pts, { ancho, grosor: .009, tono0: .78, tono1: 1.06 }, .035);   // mechón suelto: se balancea apenas
  }
}

export function registrarNuevos(reg: Reg): void {
  /** Registra con la lógica común de gorro: la receta recibe `arriba` (false si el gorro oculta el cabello). */
  const def = (id: string, nombre: string, grupo: string, r: Receta, sec?: string) =>
    reg(id, nombre, grupo, (U, ctx) => r(U, ctx, !ctx.gorroOcultaCabello), sec);

  /* ============================ CORTO ============================ */
  def('corto', 'Corto clásico', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .178, sien: .11, oreja: .085, nuca: -.1 });
    const g = U.gorro;
    U.casquete({ rim, off: g ? .008 : .013, espesor: () => (g ? 0 : .012) });
    if (!g) {
      rociar(U, { n: 190, rim, u: [.1, 1], largo: [.07, .12], ancho: .018, grosor: .008, off: .017, sube: .005, giro: .6 });
      fleco(U, { tipo: 'recto', n: 8, yTip: .186, ancho: .03 });
    }
    patillas(U, rim);
    orla(U, rim);
  });

  def('degradado', 'Degradado (fade)', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const g = U.gorro;
    const rimF = linea({ frente: .178, sien: .07, oreja: -.01, nuca: -.17 });
    const rimT = linea({ frente: .178, sien: .14, oreja: .12, nuca: .02 });
    U.casquete({
      rim: rimF, off: .006, tono0: .7, tono1: .95, nAz: 120,
      piel: (y) => .78 * (1 - suave(-.14, .06, y)), ratio: U.ratio('secundario'),
    }, true);
    U.casquete({ rim: rimT, off: g ? .01 : .016, espesor: () => (g ? 0 : .016), nAz: 110 });
    if (!g) {
      rociar(U, { n: 170, rim: rimT, u: [.05, 1], largo: [.07, .12], ancho: .018, off: .021, sube: .006, giro: .6 });
      fleco(U, { tipo: 'recto', n: 8, yTip: .186, ancho: .03, off: .024 });
    }
  }, '#2B170E');

  def('rapado', 'Rapado', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .17, sien: .1, oreja: .02, nuca: -.14 });
    U.casquete({
      rim, off: .0075, ruido: .0015, surcos: .0018, tono0: .8, tono1: 1, nAz: 110,
      piel: (y) => .42 * (1 - suave(-.1, .1, y)), ratio: U.ratio(),
    });
  });

  def('mohicano', 'Mohicano', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .17, sien: .1, oreja: .03, nuca: -.14 });
    U.casquete({
      rim, off: .007, ruido: .0015, surcos: .002, tono0: .8, tono1: 1, nAz: 110,
      piel: (y, az) => {
        const lado = suave(.38, .6, Math.abs(azN(az)));
        return (.35 * (1 - suave(-.1, .1, y)) + .25) * lado;
      },
      ratio: U.ratio(),
    });
    if (U.gorro) return;
    // cresta: tres filas de hojas paradas, de la línea de la frente hasta la nuca, más altas al centro y echadas hacia atrás
    for (let fila = 0; fila < 3; fila++) for (let i = 0; i < 18; i++) {
      const k = i / 17, th = mezcla(1.12, 2.85, k);
      const el = th < PI / 2 ? th : PI - th, az = th < PI / 2 ? 0 : PI;
      const alto = mezcla(.1, .18, Math.sin(k * PI)) * (1 - fila * .08) + U.r() * .012;
      const base = sup(el, az, .014);
      base.x += (fila - 1) * .02;
      const n = base.clone().normalize();
      const dir = V(0, 1, 0).multiplyScalar(.85).addScaledVector(n, .3).addScaledVector(V(0, 0, -1), .25 + k * .6).normalize();
      const tip = base.clone().addScaledVector(dir, alto);
      const mid = base.clone().lerp(tip, .5).addScaledVector(n, .004);
      U.mechon([base, mid, tip], { ancho: .05, grosor: .022, tono0: .75, tono1: 1.1 });
    }
  });

  def('erizado', 'Erizado con gel', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .178, sien: .11, oreja: .085, nuca: -.1 });
    const g = U.gorro;
    U.casquete({ rim, off: g ? .008 : .013, espesor: () => (g ? 0 : .008), surcos: .005 });
    if (g) return;
    // puntas de gel: conos aplanados que salen hacia afuera y arriba, con curva
    for (let i = 0; i < 150; i++) {
      const az = mezcla(-PI, PI, (i * .6180339 + .1) % 1);
      const el = mezcla(elDeY(rim(az) + .02, .014), 1.52, Math.pow((i * .7548777 + .2) % 1, .8));
      const p = sup(el, az, .012), n = p.clone().normalize();
      const alto = mezcla(.05, .09, U.r()) * (el > 1.1 ? 1.15 : .85);
      const lean = V(U.r() - .5, U.r() * .3, U.r() - .5).multiplyScalar(.04);
      const dir = n.clone().add(V(0, .45, 0)).normalize();
      const tip = p.clone().addScaledVector(dir, alto).add(lean);
      const mid = p.clone().lerp(tip, .5).addScaledVector(n, .006);
      U.mechon([p, mid, tip], { ancho: .026, grosor: .02, seg: 4, tono0: .72, tono1: 1.12 });
    }
    patillas(U, rim);
    fleco(U, { tipo: 'recto', n: 6, yTip: .19, ancho: .028, off: .024 });
  });

  def('raya_costado', 'Raya al costado', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .178, sien: .115, oreja: .085, nuca: -.1 });
    const g = U.gorro;
    U.casquete({ rim, off: g ? .008 : .013, espesor: () => (g ? 0 : .014), remolino: { el: 1.3, az: -.5 } });
    if (!g) {
      // el pelo nace en la raya (az -.4) y se peina a +x; el lado chico cae hacia -x
      rociar(U, { n: 120, rim, u: [.1, 1], az: [.05, PI], largo: [.08, .13], ancho: .019, off: .018, sube: .008, psi: 1.0, jitter: .5 });
      rociar(U, { n: 70, rim, u: [.1, 1], az: [-PI, .0], largo: [.07, .11], ancho: .019, off: .018, sube: .008, psi: -1.0, jitter: .5 });
      fleco(U, { tipo: 'lado', n: 9, yTip: .184, ancho: .03, lado: 1 });
      // la raya: un surco oscuro fino
      const raya = [];
      for (let k = 0; k <= 9; k++) raya.push(sup(mezcla(.78, 1.45, k / 9), -.42, .0215));
      U.mechon(raya, { ancho: .006, grosor: .003, tono0: .35, tono1: .5, roma: true, base: 1 });
    }
    patillas(U, rim);
    orla(U, rim);
  });

  def('militar', 'Militar', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .17, sien: .1, oreja: .04, nuca: -.1 });
    const g = U.gorro;
    U.casquete({
      rim, off: g ? .008 : .016, espesor: (el) => (g ? 0 : .035 * suave(.85, 1.3, el)), techo: g ? undefined : .292, ruido: .002, surcos: .002, tono0: .8, tono1: 1, nAz: 110,
      piel: (y) => .3 * (1 - suave(-.08, .12, y)), ratio: U.ratio(),
    });
    patillas(U, rim, { largo: .04, n: 2 });
  });

  /* ---- nuevos de corto ---- */
  def('undercut', 'Undercut', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const g = U.gorro;
    const rimF = linea({ frente: .178, sien: .08, oreja: .02, nuca: -.16 });
    const rimT = linea({ frente: .178, sien: .15, oreja: .15, nuca: .05 });
    U.casquete({
      rim: rimF, off: .006, tono0: .7, tono1: .95, nAz: 120,
      piel: (y) => .55 * (1 - suave(-.12, .08, y)), ratio: U.ratio('secundario'),
    }, true);
    U.casquete({ rim: rimT, off: g ? .01 : .018, espesor: () => (g ? 0 : .022), nAz: 110, remolino: { el: .85, az: 0 } });
    if (!g) {
      // arriba largo, peinado hacia atrás desde la frente
      rociar(U, { n: 160, rim: rimT, u: [.04, .9], az: [-1.15, 1.15], largo: [.1, .17], ancho: .02, off: .024, sube: .01, remolino: { el: .7, az: 0 }, giro: 0, jitter: .3 });
      fleco(U, { tipo: 'lado', n: 7, yTip: .19, ancho: .028, off: .026, lado: -1 });
    }
  }, '#2B170E');

  def('quiff', 'Tupé (quiff)', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const g = U.gorro;
    const rimF = linea({ frente: .178, sien: .09, oreja: .03, nuca: -.13 });
    const rimT = linea({ frente: .178, sien: .14, oreja: .12, nuca: .0 });
    U.casquete({
      rim: rimF, off: .006, tono0: .7, tono1: .95, nAz: 120,
      piel: (y) => .5 * (1 - suave(-.1, .08, y)), ratio: U.ratio('secundario'),
    }, true);
    const copete = (el: number, az: number) => (g ? 0 : .06 * Math.exp(-(az * az) / .55) * suave(.5, 1.0, el) * (1 - suave(1.2, 1.5, el)));
    U.casquete({ rim: rimT, off: g ? .01 : .018, espesor: copete, nAz: 110 });
    if (!g) {
      // mechones que suben desde la línea de la frente y se echan hacia arriba y atrás
      for (let i = 0; i < 22; i++) {
        const k = i / 21, az = (k - .5) * 1.5;
        const raiz = sup(elDeY(.18, .02), az, .02);
        const n = raiz.clone().normalize();
        const alto = mezcla(.1, .15, Math.sin(k * PI)) + U.r() * .02;
        const arribaV = V(0, 1, 0), atras = V(0, 0, -1);
        const p1 = raiz.clone().addScaledVector(n, .04).addScaledVector(arribaV, .035);
        const p2 = raiz.clone().addScaledVector(n, .05).addScaledVector(arribaV, alto * .75).addScaledVector(atras, .02);
        const p3 = raiz.clone().addScaledVector(n, .03).addScaledVector(arribaV, alto).addScaledVector(atras, .09 + U.r() * .03);
        U.mechon([raiz, p1, p2, p3], { ancho: .026, grosor: .016, tono0: .8, tono1: 1.12 });
      }
      rociar(U, { n: 90, rim: rimT, u: [.3, 1], az: [-1.3, 1.3], largo: [.08, .13], ancho: .02, off: .026, sube: .008, remolino: { el: .7, az: 0 }, giro: 0, jitter: .3 });
    }
    patillas(U, rimF, { sec: true, largo: .05 });
  }, '#2B170E');

  def('buzz_lineas', 'Rapado con líneas', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const rim = linea({ frente: .17, sien: .1, oreja: .03, nuca: -.13 });
    U.casquete({
      rim, off: .0085, ruido: .0015, surcos: .0018, tono0: .8, tono1: 1, nAz: 240, nEl: 28,
      piel: (y, az, k) => {
        const a = azN(az), A = Math.abs(a);
        const raya = A > .3 && A < 1.2 && Math.abs(a - .52) < .026 && k > .2 ? 1 : 0;
        const l1 = A > 1.25 && A < 2.7 && Math.abs(y - .035) < .011 ? 1 : 0;
        const l2 = A > 1.25 && A < 2.7 && Math.abs(y + .045) < .011 ? 1 : 0;
        const base = .32 * (1 - suave(-.1, .1, y));
        return Math.max(base, raya * .95, l1 * .95, l2 * .95);
      },
      ratio: U.ratio(),
    });
  });

  def('pixie', 'Pixie', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const g = U.gorro;
    const rim = linea({ frente: .178, sien: .09, oreja: .05, nuca: -.12 });
    U.casquete({ rim, off: g ? .008 : .014, espesor: () => (g ? 0 : .016) });
    if (!g) {
      rociar(U, { n: 170, rim, u: [.1, 1], largo: [.07, .12], ancho: .018, off: .018, sube: .008, giro: .8 });
      fleco(U, { tipo: 'largo_lado', n: 9, yTip: .184, ancho: .03, lado: 1 });
    }
    // puntas en las patillas y la nuca, largas y afiladas
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = s * (1.32 + i * .07);
      U.mechon(trazar({ el: elDeY(rim(a) + .02, .016), az: a, largo: .1 - i * .015, psi: s * .15, grav: .2, off0: .016, off1: .02, pasos: 6 }), { ancho: .014, grosor: .008, tono0: .8, tono1: 1.06 });
    }
    orla(U, rim, { largo: [.03, .06] });
  });

  def('mullet', 'Mullet suave', 'Corto', (U, _c, arriba) => {
    const g = U.gorro;
    const rim = linea({ frente: .178, sien: .1, oreja: .06, nuca: -.1 });
    if (arriba) {
      U.casquete({ rim, off: g ? .008 : .014, espesor: () => (g ? 0 : .014) });
      if (!g) {
        rociar(U, { n: 170, rim, u: [.1, 1], largo: [.08, .13], ancho: .019, off: .018, sube: .01, giro: .5 });
        fleco(U, { tipo: 'recto', n: 8, yTip: .19, ancho: .03 });
      }
      patillas(U, rim, { largo: .06 });
    }
    // la parte larga de atrás: cola corta que cae sobre la nuca y se afina en puntas
    const abajo = (az: number) => mezcla(-.15, -.34, suave(2.0, 2.9, Math.abs(azN(az))));
    U.cortina({ desde: 2.0, hasta: 2 * PI - 2.0, arriba: (az) => Math.max(rim(az), 0) + (U.gorro ? .17 : .02), abajo, off: .03, offArriba: .017, vuelo: .06, meter: .008 });
    caer(U, { n: 46, az: [2.05, 2 * PI - 2.05], el: arriba ? [.05, .6] : [.05, .3], largo: [.4, .6], ancho: .032, off0: .018, off1: .036, vuelo: .06, grav: .55, hasta: abajo });
  });

  def('rizos_fade', 'Rizos cortos con degradado', 'Corto', (U, _c, arriba) => {
    if (!arriba) return;
    const g = U.gorro;
    const rimF = linea({ frente: .176, sien: .07, oreja: -.02, nuca: -.17 });
    const rimT = linea({ frente: .176, sien: .13, oreja: .1, nuca: .0 });
    U.casquete({
      rim: rimF, off: .006, tono0: .7, tono1: .95, nAz: 120,
      piel: (y) => .72 * (1 - suave(-.14, .06, y)), ratio: U.ratio('secundario'),
    }, true);
    U.casquete({ rim: rimT, off: g ? .01 : .02, ruido: .006, surcos: .004, nAz: 110 });
    if (g) return;
    // rizos: bolitas que cubren la parte de arriba; más chicas hacia los bordes
    for (let i = 0; i < 230; i++) {
      const az = mezcla(-PI, PI, (i * .6180339 + .13) % 1);
      const u = (i * .7548777 + .3) % 1;
      const el = mezcla(elDeY(rimT(az) + .025, .02), 1.5, u);
      if (el < .05) continue;
      const p = sup(el, az, .024 + U.r() * .008);
      const r = mezcla(.034, .046, U.r()) * (.85 + .25 * u);
      U.add(geoBola(r, r * .9, r, p, .8 + U.r() * .3));
    }
    // frente: rizos sobre la línea, nunca por debajo de la frente
    for (let i = 0; i < 12; i++) {
      const az = (i / 11 - .5) * 1.5;
      U.add(geoBola(.03, .026, .03, sup(elDeY(.2, .026), az, .026), .85 + U.r() * .25));
    }
  }, '#2B170E');

  /* ========================= CON CERQUILLO ========================= */
  const cerquillo = (U: Pelo, arriba: boolean, tipo: 'recto' | 'lado' | 'cortina', o: { frente: number; atras: number; desde?: number; vuelo?: number; off?: number; meter?: number; n?: number; sec?: boolean }) => {
    const rim = linea({ frente: .178, sien: .12, oreja: .1, nuca: -.02 });
    const g = U.gorro;
    if (arriba) {
      U.casquete({ rim, off: g ? .008 : .014, espesor: () => (g ? 0 : .01) });
      if (!g) {
        rociar(U, { n: 120, rim, u: [.25, 1], az: [.85, 2 * PI - .85], largo: [.07, .12], ancho: .02, off: .019, sube: .005, giro: .5 });
        fleco(U, { tipo, n: o.n ?? 10, yTip: .184, lado: 1 });
      }
    }
    melena(U, arriba, { rim, ...o });
  };
  def('cerquillo_recto', 'Cerquillo recto', 'Con cerquillo', (U, _c, a) => cerquillo(U, a, 'recto', { frente: -.14, atras: -.1, meter: .014 }));
  def('cerquillo_lado', 'Cerquillo de lado', 'Con cerquillo', (U, _c, a) => cerquillo(U, a, 'lado', { frente: -.19, atras: -.12, vuelo: .04 }));
  def('cerquillo_cortina', 'Cerquillo cortina', 'Con cerquillo', (U, _c, a) => {
    cerquillo(U, a, 'cortina', { frente: -.28, atras: -.2, vuelo: .06, n: 11 });
    if (a) enmarcar(U, .3, 2);
  });
  def('bob_cerquillo', 'Bob con cerquillo', 'Con cerquillo', (U, _c, a) => cerquillo(U, a, 'recto', { frente: -.22, atras: -.12, vuelo: .09, off: .046, meter: .02 }));
  def('flequillo_largo', 'Flequillo largo de lado', 'Con cerquillo', (U, _c, a) => {
    cerquillo(U, a, 'lado', { frente: -.2, atras: -.12, vuelo: .05, meter: .016 });
    if (a && !U.gorro) fleco(U, { tipo: 'largo_lado', n: 7, yTip: .188, lado: 1, ancho: .03, off: .027 });
  });

  /* ============================ MEDIANO ============================ */
  const medio = (U: Pelo, arriba: boolean, fl: 'recto' | 'lado' | 'cortina' | 'largo_lado', lado: number, o: MelenaOpc, enm: number, n = 110) => {
    const rim = o.rim;
    const g = U.gorro;
    if (arriba) {
      U.casquete({ rim, off: g ? .008 : .014, espesor: () => (g ? 0 : .012) });
      if (!g) {
        rociar(U, { n, rim, u: [.25, 1], az: [.85, 2 * PI - .85], largo: [.07, .12], ancho: .02, off: .019, sube: .006, giro: .4 });
        fleco(U, { tipo: fl, n: fl === 'cortina' ? 11 : 9, yTip: .185, lado });
      }
    }
    melena(U, arriba, o);
    if (arriba && enm) enmarcar(U, enm, 3);
  };
  const rimM = linea({ frente: .178, sien: .12, oreja: .1, nuca: -.02 });
  def('bob', 'Bob', 'Mediano', (U, _c, a) => medio(U, a, 'lado', -1, { rim: rimM, frente: -.25, atras: -.11, vuelo: .1, off: .046, meter: .022, caen: 90 }, .28));
  def('lob', 'Lob (bob largo)', 'Mediano', (U, _c, a) => medio(U, a, 'cortina', 1, { rim: rimM, frente: -.38, atras: -.28, vuelo: .08, off: .046, meter: .02, caen: 100, ondas: 6, ondaAmp: .004 }, .4));
  def('hombros', 'Melena a los hombros', 'Mediano', (U, _c, a) => medio(U, a, 'cortina', 1, { rim: rimM, frente: -.46, atras: -.4, vuelo: .13, off: .045, meter: .02, caen: 120 }, .5));
  def('ondulado', 'Ondulado', 'Mediano', (U, _c, a) => medio(U, a, 'lado', -1, { rim: rimM, frente: -.4, atras: -.33, vuelo: .2, off: .05, meter: .01, caen: 110, ondas: 14, ondaAmp: .018, ondasMech: 1.6, onda: .02, ancho: .03 }, .38, 120));

  def('shaggy', 'Desmechado (shaggy)', 'Mediano', (U, _c, arriba) => {
    const rim = linea({ frente: .178, sien: .12, oreja: .06, nuca: -.02 });
    const g = U.gorro;
    if (arriba) {
      U.casquete({ rim, off: g ? .008 : .015, espesor: () => (g ? 0 : .016), surcos: .005 });
      if (!g) {
        rociar(U, { n: 150, rim, u: [.1, 1], largo: [.1, .17], ancho: .02, off: .02, sube: .014, giro: .8, jitter: 1.1 });
        fleco(U, { tipo: 'cortina', n: 9, yTip: .186, ancho: .028 });
      }
    }
    // capas picudas: corte irregular con hojas largas y angostas
    const abajo = (az: number) => mezcla(-.22, -.12, suave(1.22, PI - .4, Math.abs(azN(az)))) + .05 * Math.sin(az * 11) * Math.cos(az * 3);
    U.cortina({ desde: 1.22, hasta: 2 * PI - 1.22, arriba: (az) => Math.max(rim(az), 0) + (U.gorro ? .17 : .06), abajo, off: .04, offArriba: .017, vuelo: .06, meter: .02 });
    if (arriba) caer(U, { n: 130, az: [1.24, 2 * PI - 1.24], el: g ? [.05, .3] : [.0, .95], largo: [.5, .7], ancho: .02, off0: .019, off1: .05, vuelo: .06, grav: .6, ondas: 1.0, hasta: abajo, roma: false });
    puntas(U, { n: 46, az: [1.26, 2 * PI - 1.26], abajo, off: .036, vuelo: .06, largo: [.05, .11], ancho: .018 });
    if (arriba) enmarcar(U, .24, 3, 1.3, .018);
  });

  def('capas', 'Corte en capas', 'Mediano', (U, _c, arriba) => {
    const rim = rimM;
    const g = U.gorro;
    if (arriba) {
      U.casquete({ rim, off: g ? .008 : .014, espesor: () => (g ? 0 : .014) });
      if (!g) {
        rociar(U, { n: 130, rim, u: [.2, 1], largo: [.08, .14], ancho: .02, off: .019, sube: .008, giro: .5 });
        fleco(U, { tipo: 'cortina', n: 11, yTip: .184 });
      }
    }
    const a1 = corte(-.36, -.3, 1.22), a2 = corte(-.26, -.2, 1.22), a3 = corte(-.16, -.1, 1.22);
    for (const [abajo, off] of [[a1, .04], [a2, .046], [a3, .052]] as const) {
      U.cortina({ desde: 1.22, hasta: 2 * PI - 1.22, arriba: (az) => Math.max(rim(az), 0) + (U.gorro ? .17 : .06), abajo, off, offArriba: .017, vuelo: .09, meter: .016 });
    }
    if (arriba) {
      caer(U, { n: 80, az: [1.24, 2 * PI - 1.24], el: g ? [.05, .3] : [.0, .9], largo: [.6, .85], ancho: .024, off0: .019, off1: .042, vuelo: .09, grav: .6, hasta: a1 });
      caer(U, { n: 60, az: [1.24, 2 * PI - 1.24], el: g ? [.05, .3] : [.0, .9], largo: [.5, .7], ancho: .024, off0: .02, off1: .05, vuelo: .09, grav: .6, hasta: a2 });
    }
    puntas(U, { n: 30, az: [1.26, 2 * PI - 1.26], abajo: a1, off: .036, vuelo: .09 });
    puntas(U, { n: 24, az: [1.26, 2 * PI - 1.26], abajo: a3, off: .046, vuelo: .09 });
    if (arriba) enmarcar(U, .36, 3);
  });
}
