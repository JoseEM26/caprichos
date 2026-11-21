/* eslint-disable -- piezas pasadas tal cual de la maqueta aprobada (no se reescriben a mano) */
// @ts-nocheck
import { AVATAR } from './nucleo';

/*
 * Cabellos del avatar de Caprichos. Todo se arma sobre H.casquete (respeta la frente) más mechones, melenas,
 * colas, moños y rizos. Regla fija: nada del cabello baja de MED.frenteY en la cara (los mechones se suben solos
 * si el borde les quedaría bajo la frente).
 */
export function registrarCabello() {
  const A = AVATAR, T = A.T, MED = A.MED;
  const FRENTE = MED.frenteY + .008;
  const R = .283; // radio donde viven los mechones (sobre el casquete)
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const Y = V(0, 1, 0);
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };

  /** Tubo que se afina a lo largo de una curva (mechón, cola, rasta). Termina redondeado. */
  function geoTubo(pts, r, afil, n = 24, m = 10) {
    const c = new T.CatmullRomCurve3(pts);
    const pos = [], idx = [];
    const ref = Math.abs(c.getTangentAt(0).y) < .9 ? V(0, 1, 0) : V(1, 0, 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = c.getPointAt(t), tg = c.getTangentAt(t).normalize();
      const N = new T.Vector3().crossVectors(tg, ref).normalize(), B = new T.Vector3().crossVectors(tg, N);
      let rr = r * (1 - (1 - afil) * t);
      if (t > .88) rr *= Math.sqrt(Math.max(0, 1 - Math.pow((t - .88) / .12, 2)));
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr;
        pos.push(p.x + N.x * ca + B.x * sa, p.y + N.y * ca + B.y * sa, p.z + N.z * ca + B.z * sa);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + (j + 1) % m, c2 = (i + 1) * m + j, d = (i + 1) * m + (j + 1) % m;
      idx.push(a, b, c2, b, d, c2);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  /** Melena: esfera deformada (arriba corta, abajo larga) con corte plano, vuelo y onda opcionales. */
  function geoMelena({ w = .287, ht = .26, largo = .4, d = .255, plano = 0, onda = 0, vuelo = 0 }) {
    const g = new T.SphereGeometry(1, 30, 22);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let ny = y > 0 ? y * ht : y * largo;
      if (plano && ny < -largo * plano) ny = -largo * plano;
      const k = ny < 0 ? 1 + vuelo * (-ny / largo) : 1;
      const f = ny < 0 ? -ny / largo : 0;
      x = x * w * k + Math.sin(ny * onda) * .04 * f;
      z = z * d * (ny < 0 ? 1 + vuelo * .3 * f : 1) - f * .16;
      p.setXYZ(i, x, ny, z);
    }
    g.computeVertexNormals();
    return g;
  }

  function utiles(ctx, g) {
    const cab = ctx.partes.cabeza, m = ctx.mat('principal'), m2 = ctx.mat('secundario');
    const oscuro = ctx.mat('principal'); // reemplazado abajo
    const U = { ctx, g, cab, m, m2, anim: [] };
    U.mDark = ctx.M(ctx.tono(ctx.col('principal'), .55));
    U.bola = (rx, ry, rz, x, y, z, mat = m, par = cab, seg = 18) => {
      const s = ctx.esfera(1, mat, x, y, z, par, seg); s.scale.set(rx, ry, rz); return s;
    };
    U.casquete = (o = {}) => ctx.H.casquete(Object.assign({ mat: m, radio: g ? .274 : .284 }, o));
    U.tubo = (pts, r, afil = .3, mat = m, par = cab, n = 24, mm = 10) => ctx.malla(geoTubo(pts, r, afil, n, mm), mat, 0, 0, 0, par);
    U.mel = (o, mat = m, y = -.02, z = -.07) => ctx.malla(geoMelena(Object.assign({ ht: g ? .12 : .26 }, o)), mat, 0, y, z, cab);
    U.grupo = (x, y, z) => { const gr = new T.Group(); gr.position.set(x, y, z); cab.add(gr); return gr; };
    U.aro = (r, grosor, x, y, z, rx = 0, ry = 0, par = cab, mat = U.mDark) => {
      const t = ctx.malla(new T.TorusGeometry(r, grosor, 8, 20), mat, x, y, z, par); t.rotation.set(rx, ry, 0); return t;
    };
    /** Punto sobre el casquete que no baja de la frente (si el mechón de largo drop lo hiciera, sube). */
    U.punto = (el, az, rad, drop = 0) => {
      const P = () => V(Math.sin(az) * Math.cos(el) * rad, Math.sin(el) * rad, Math.cos(az) * Math.cos(el) * rad);
      let p = P();
      for (let k = 0; k < 40 && Math.abs(p.x) < .22 && p.z > .06 && p.y - drop < FRENTE; k++) { el += .025; p = P(); }
      return p;
    };
    /** Mechón aplanado pegado a la cabeza; la punta cae siguiendo la superficie. giro > 0 la lleva hacia +x. */
    U.mechon = (az, el, w, l, th, giro = 0, mat = m, rad = R) => {
      const n = V(0, 0, 0), t = V(0, 0, 0), P = V(0, 0, 0);
      const calc = () => {
        P.set(Math.sin(az) * Math.cos(el) * rad, Math.sin(el) * rad, Math.cos(az) * Math.cos(el) * rad);
        n.copy(P).normalize();
        t.set(Math.sin(az) * Math.sin(el), -Math.cos(el), Math.cos(az) * Math.sin(el)).normalize();
        if (giro) t.applyAxisAngle(n, giro);
      };
      calc();
      for (let k = 0; k < 40 && Math.abs(P.x) < .22 && P.z > .06 && P.y + t.y * l < FRENTE; k++) { el += .025; calc(); }
      const Zb = n.clone().addScaledVector(t, -n.dot(t)).normalize(), Xb = new T.Vector3().crossVectors(t, Zb);
      const s = U.bola(w, l, th, P.x, P.y, P.z, mat);
      s.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(Xb, t, Zb));
      return s;
    };
    /** Flequillo: recto | lado | cortina. Siempre termina sobre la frente. */
    U.flequillo = (tipo, n = 9, mat = m) => {
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        if (tipo === 'recto') {
          const az = (k - .5) * 2;
          U.mechon(az, .86, .065, .08, .036, 0, mat);
          U.mechon(az + .1, 1.12, .07, .1, .04, 0, mat);
        } else if (tipo === 'lado') {
          const az = -1 + k * 1.9;
          U.mechon(az, .86, .07, .1, .036, .85, mat);
          U.mechon(az, 1.12, .07, .11, .04, .65, mat);
        } else {
          const az = (k - .5) * 2.1, s = Math.sign(az) || 1;
          if (Math.abs(az) < .16) continue;
          U.mechon(az, .86, .07, .1, .036, s * .7, mat);
          U.mechon(az, 1.12, .07, .11, .04, s * .5, mat);
        }
      }
    };
    /** Patillas cortas a los lados (|x| > .2, sin pasar por delante de los ojos). */
    U.patillas = (largo = .07, y = .03, mat = m) => {
      for (const s of [-1, 1]) U.bola(.032, largo, .05, s * .258, y, .06, mat);
    };
    /** Frente a dos mechones largos que caen por delante de los hombros, pegados al costado. */
    U.mechonesFrente = (largoY = -.5, r = .042) => {
      for (const s of [-1, 1]) U.tubo([V(s * .255, .04, .0), V(s * .272, -.1, .04), V(s * .26, -.3, .07), V(s * .235, largoY, .075)], r, .45);
    };
    /** Cola o trenza colgante con balanceo suave; el grupo gira desde su atadura. */
    U.cola = (x, y, z, pts, r, afil, fase = 0, amp = .06) => {
      const gr = U.grupo(x, y, z);
      U.tubo(pts, r, afil, m, gr);
      U.anim.push((t) => { gr.rotation.z = Math.sin(t * 1.7 + fase) * amp; gr.rotation.x = Math.sin(t * 1.2 + fase) * amp * .6; });
      return gr;
    };
    U.espinas = (el, cuantos, desde, hasta, largo = .17, r = .05) => {
      for (let i = 0; i < cuantos; i++) {
        const az = desde + (hasta - desde) * (i / Math.max(1, cuantos - 1));
        const p = U.punto(el, az, .268, .06);
        const n = p.clone().normalize(), dir = n.clone().add(V(0, .45, 0)).normalize();
        const c = ctx.malla(new T.ConeGeometry(r, largo, 10), m, 0, 0, 0, cab);
        c.position.copy(p).addScaledVector(dir, largo * .42);
        c.quaternion.setFromUnitVectors(Y, dir);
      }
    };
    return U;
  }

  function reg(id, nombre, grupo, alto, bajo, sec) {
    A.registrar('cabello', {
      id, nombre, grupo,
      colores: sec ? ['principal', 'secundario'] : ['principal'],
      porDefecto: sec ? { principal: '#4A2C1D', secundario: sec } : { principal: '#4A2C1D' },
      construir(ctx) {
        semilla = 7;
        const g = ctx.conGorro, U = utiles(ctx, g);
        if (!ctx.gorroOcultaCabello && alto) alto(U, g);
        if (bajo) bajo(U, g);
        if (U.anim.length) return { animar: (t, dt) => U.anim.forEach((f) => f(t, dt)) };
      },
    });
  }

  /* ============================ CORTO ============================ */
  reg('corto', 'Corto clásico', 'Corto', (U, g) => {
    U.casquete();
    if (!g) for (const az of [-.55, -.2, .15, .5]) U.mechon(az, 1.12, .06, .1, .036, az * .6);
    U.patillas();
  });
  reg('degradado', 'Degradado (fade)', 'Corto', (U, g) => {
    U.casquete({ mat: U.m2, radio: g ? .272 : .279 });
    U.casquete({ cobertura: .33, inclinacion: -.3, radio: g ? .277 : .288 });
    if (!g) for (const az of [-.5, -.15, .2, .55]) U.mechon(az, 1.2, .06, .1, .038, az * .5, U.m, .288);
  }, null, '#2B170E');
  reg('rapado', 'Rapado', 'Corto', (U) => {
    U.casquete({ radio: .277 });
  });
  reg('mohicano', 'Mohicano', 'Corto', (U, g) => {
    U.casquete({ radio: .277 });
    if (g) return;
    const pc = [48, 70, 95, 125, 148].map((a) => { a *= Math.PI / 180; return V(0, Math.sin(a) * .312, Math.cos(a) * .312); });
    U.tubo(pc, .05, 1, U.m, U.cab, 28, 12);
  });
  reg('erizado', 'Erizado con gel', 'Corto', (U, g) => {
    U.casquete({ radio: g ? .274 : .281 });
    if (g) return;
    U.espinas(.95, 10, -3.0, 3.0, .15);
    U.espinas(1.2, 7, 0, 6.0, .17);
    U.espinas(1.43, 3, 0, 4, .17);
    U.espinas(.4, 10, 1.4, 4.9, .14);
    U.espinas(-.05, 9, 1.9, 4.4, .13);
  });
  reg('raya_costado', 'Raya al costado', 'Corto', (U, g) => {
    U.casquete();
    if (g) return;
    U.flequillo('lado', 8);
    U.bola(.16, .075, .17, .03, .235, .03);
    U.patillas();
  });
  reg('militar', 'Militar', 'Corto', (U, g) => {
    U.casquete({ radio: .277 });
    if (!g) U.ctx.malla(new T.CylinderGeometry(.16, .18, .05, 28), U.m, 0, .26, -.03, U.cab);
  });

  /* ========================= CON CERQUILLO ========================= */
  reg('cerquillo_recto', 'Cerquillo recto', 'Con cerquillo', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('recto', 10);
  }, (U, g) => { U.mel({ largo: .2, plano: .85 }); U.patillas(.09, .0); });
  reg('cerquillo_lado', 'Cerquillo de lado', 'Con cerquillo', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('lado', 9);
  }, (U, g) => { U.mel({ largo: .2, plano: .85 }); U.patillas(.09, .0); });
  reg('cerquillo_cortina', 'Cerquillo cortina', 'Con cerquillo', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('cortina', 11);
  }, (U, g) => { U.mel({ largo: .26, plano: .9 }); U.patillas(.1, .0); });
  reg('bob_cerquillo', 'Bob con cerquillo', 'Con cerquillo', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('recto', 10);
  }, (U, g) => { U.mel({ w: .295, largo: .27, plano: .9, vuelo: .08 }); U.patillas(.1, .0); });

  /* ============================ MEDIANO ============================ */
  reg('bob', 'Bob', 'Mediano', (U, g) => {
    U.casquete();
    if (!g) { U.flequillo('lado', 8); }
  }, (U, g) => { U.mel({ w: .297, largo: .26, plano: .88, vuelo: .1 }); });
  reg('hombros', 'Melena a los hombros', 'Mediano', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('cortina', 9);
  }, (U, g) => { U.mel({ largo: .42, vuelo: .12, plano: .93 }); U.mechonesFrente(-.33, .04); });
  reg('ondulado', 'Ondulado', 'Mediano', (U, g) => {
    U.casquete();
    if (!g) U.flequillo('lado', 8);
  }, (U, g) => {
    U.mel({ w: .29, largo: .42, vuelo: .2, onda: 16 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) U.bola(.055, .06, .055, s * (.255 + i * .008), -.1 - i * .09, -.03);
  });
  reg('shaggy', 'Desmechado (shaggy)', 'Mediano', (U, g) => {
    U.casquete({ radio: g ? .274 : .286 });
    if (g) return;
    for (let i = 0; i < 12; i++) U.mechon(-1.1 + i * .2, .9 + azar() * .25, .06, .1 + azar() * .05, .036, (azar() - .5) * 1.5);
    for (let i = 0; i < 6; i++) U.mechon(-.9 + i * .36, 1.3, .07, .1, .04, (azar() - .5));
  }, (U, g) => {
    U.mel({ largo: .2, w: .29, vuelo: .1 });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const c = U.bola(.035, .12 + azar() * .05, .04, s * (.255 + azar() * .02), -.02 - i * .05, -.02 - i * .06);
      c.rotation.z = s * (.12 + azar() * .2);
    }
    for (let i = 0; i < 8; i++) {
      const az = 1.7 + i * .3, c = U.bola(.04, .11 + azar() * .06, .04, Math.sin(az) * .27, -.17 - azar() * .04, -.07 + Math.cos(az) * .22);
      c.rotation.z = Math.sin(az) * .25;
    }
  });
  // Largo, Recogido y Rizado viven en cabello-largo.ts (registrarCabelloLargo)
}
