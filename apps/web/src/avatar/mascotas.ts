/* eslint-disable -- piezas procedurales (mismo estilo que cabello/ropa/disfraces: se revisan con el catálogo visual) */
// @ts-nocheck
import { AVATAR } from './nucleo';

/*
 * Mascotas del avatar de Caprichos. Cada mascota es un grupo aparte (partes.mascota) que va al lado del avatar,
 * mira hacia +z y se anima sola (respira, parpadea, mueve cola/orejas/alas, da saltitos).
 * Colores: principal (cuerpo), secundario (barriga, orejas, detalles), acento (nariz, cuernos, adornos).
 * Todo el diseño es propio: nada copia personajes con derechos de autor.
 */
export function registrarMascotas() {
  const A = AVATAR;
  const T = A.T;
  const PI = Math.PI;
  const ROSA = '#F59AAE';
  const reg = (id, nombre, grupo, colores, porDefecto, construir, extra) =>
    A.registrar('mascota', Object.assign({ id, nombre, grupo, colores, porDefecto, construir }, extra));
  A.registrar('mascota', { id: 'ninguno', nombre: 'Sin mascota', grupo: 'Básico', colores: [], construir() {} });

  const esferaGeo = new T.SphereGeometry(1, 28, 20);

  /* ---------- Caja de herramientas de una mascota ---------- */
  function kit(ctx) {
    const g = ctx.g;
    const { M, tono } = ctx;
    const k = { g, ojos: [], movs: [], alas: [], extras: [], cuerpo: null, cabeza: null, cuerpoSy: 1 };
    k.col = ctx.col;
    k.m = (c, o) => M(c, Object.assign({ roughness: 0.82 }, o));
    k.mat = (slot, o) => k.m(ctx.col(slot), o);
    k.osc = (slot, f, o) => k.m(tono(ctx.col(slot), f), o);
    k.brillo = (c, i = 1.2) => M(c, { emissive: c, emissiveIntensity: i, roughness: 0.4 });
    k.bola = (p, mat, rx, ry, rz, x = 0, y = 0, z = 0) => {
      const m = new T.Mesh(esferaGeo, mat);
      m.scale.set(rx, ry, rz);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      p.add(m);
      return m;
    };
    k.cono = (p, mat, r, h, x = 0, y = 0, z = 0, seg = 16) => {
      const m = new T.Mesh(new T.ConeGeometry(r, h, seg), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      p.add(m);
      return m;
    };
    k.cil = (p, mat, r1, r2, h, x = 0, y = 0, z = 0) => {
      const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 14), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      p.add(m);
      return m;
    };
    k.caja = (p, mat, w, h, d, x = 0, y = 0, z = 0) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      p.add(m);
      return m;
    };
    k.pivote = (p, x = 0, y = 0, z = 0) => {
      const o = new T.Group();
      o.position.set(x, y, z);
      p.add(o);
      return o;
    };
    /** Movimiento senoidal de un pivote: rotation[eje] = base + sen(t*vel+fase)*amp (se exagera cuando está contenta). */
    k.mov = (grp, eje, amp, vel, fase = 0) => {
      k.movs.push({ g: grp, eje, amp, vel, fase, base: grp.rotation[eje] });
      return grp;
    };
    /** Ojos grandes y brillantes. iris: color (con pupila oscura); sin iris: ojo oscuro de dibujo animado. */
    k.ojo = (p, x, y, z, r, iris) => {
      const o = k.pivote(p, x, y, z);
      k.bola(o, iris ? k.m(iris, { roughness: 0.15 }) : k.m('#1B1218', { roughness: 0.12 }), r, r * 1.1, r * 0.55);
      if (iris) k.bola(o, k.m('#0B0A0E', { roughness: 0.1 }), r * 0.5, r * 0.95, r * 0.5, 0, 0, r * 0.12);
      const br = M('#FFFFFF', { emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2 });
      k.bola(o, br, r * 0.32, r * 0.32, r * 0.2, r * 0.3, r * 0.4, r * 0.42);
      k.bola(o, br, r * 0.15, r * 0.15, r * 0.15, -r * 0.32, -r * 0.34, r * 0.42);
      k.ojos.push(o);
      return o;
    };
    k.ojosPar = (p, x, y, z, r, iris) => [-1, 1].map((s) => k.ojo(p, s * x, y, z, r, iris));
    k.mejillas = (p, x, y, z, r, c = ROSA) => {
      for (const s of [-1, 1]) {
        const m = k.bola(p, M(c, { transparent: true, opacity: 0.55, roughness: 1 }), r, r * 0.7, r * 0.22, s * x, y, z);
        m.rotation.y = s * 0.55;
        m.castShadow = false;
      }
    };
    k.boca = (p, y, z, w = 0.04, c = '#5A2A2A') => {
      for (const s of [-1, 1]) {
        const t = new T.Mesh(new T.TorusGeometry(w * 0.5, w * 0.1, 6, 14, PI), k.m(c));
        t.position.set(s * w * 0.5, y, z);
        t.rotation.z = PI;
        p.add(t);
      }
    };
    k.nariz = (p, mat, r, x, y, z) => k.bola(p, mat, r * 1.15, r * 0.8, r * 0.8, x, y, z);
    k.bigotes = (p, y, z, largo = 0.09, c = '#FFFFFF') => {
      for (const s of [-1, 1]) for (const dy of [-0.012, 0.012]) {
        const b = k.cil(p, k.m(c, { roughness: 0.4 }), 0.0025, 0.0025, largo, s * (0.06 + largo / 2), y + dy * 1.5, z);
        b.rotation.z = PI / 2 + s * dy * 5;
      }
    };
    /** Cuadrúpedo base: cuerpo ovalado, cabeza grande al frente y cuatro patitas. */
    k.cuatro = ({ mc, mp = mc, rx, ry, rz, hr, pat, pr = rx * 0.3, sep = 0.6, cabY = 0.5, cabZ = 0.72, ancho = 1.05 }) => {
      const yC = pat + ry * 0.85;
      k.cuerpo = k.bola(g, mc, rx, ry, rz, 0, yC, 0);
      k.cuerpoSy = ry;
      const cab = (k.cabeza = k.pivote(g, 0, yC + ry * cabY + hr * 0.35, rz * cabZ));
      k.bola(cab, mc, hr * ancho, hr * 0.95, hr);
      const patas = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const alto = pat / 2 + pr * 0.6;
        patas.push(k.bola(g, mp, pr, alto, pr * 1.15, sx * rx * sep, alto * 0.95, sz * rz * 0.55 + (sz > 0 ? pr * 0.2 : 0)));
      }
      return { cab, yC, patas, cuerpo: k.cuerpo };
    };
    /** Bípedo redondo (pingüino, búho, pollito): cuerpo huevo, cabeza opcional y dos pies. */
    k.bipedo = ({ mc, rx, ry, rz, y0 = 0.03 }) => {
      k.cuerpo = k.bola(g, mc, rx, ry, rz, 0, y0 + ry, 0);
      k.cuerpoSy = ry;
      return { yC: y0 + ry };
    };
    k.pie = (p, mat, x, y, z, r = 0.03) => {
      const f = k.bola(p, mat, r * 1.1, r * 0.4, r * 1.5, x, y, z);
      for (const d of [-1, 0, 1]) k.bola(p, mat, r * 0.32, r * 0.3, r * 0.6, x + d * r * 0.55, y, z + r * 1.1);
      return f;
    };
    k.copos = (p, mat, n, R, cy, esc, rng) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * PI * 2, b = (rng() - 0.5) * PI * 0.9;
        k.bola(p, mat, esc, esc, esc, Math.cos(a) * Math.cos(b) * R, cy + Math.sin(b) * R * 0.9, Math.sin(a) * Math.cos(b) * R);
      }
    };
    return k;
  }
  const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

  /** Animación común: respirar, parpadear, mover pivotes, saltito ocasional, bailar de alegría, aletear. */
  function animador(k, ctx, def) {
    const ud = k.g.userData;
    const fase = Math.random() * 10;
    return (t, dt, alegria = 0) => {
      const tt = t + fase;
      if (k.cuerpo) k.cuerpo.scale.y = k.cuerpoSy * (1 + Math.sin(tt * 2.3) * 0.03 + alegria * 0.02);
      const parp = tt % 4.1 < 0.12 ? 0.1 : alegria > 0.4 ? 0.55 : 1;
      for (const o of k.ojos) o.scale.y = parp;
      for (const m of k.movs) m.g.rotation[m.eje] = m.base + Math.sin(tt * m.vel * (1 + alegria * 0.8) + m.fase) * m.amp * (1 + alegria * 1.2);
      for (const a of k.alas) a.g.rotation.z = a.base + a.lado * (Math.sin(tt * a.vel * (1 + alegria * 0.6)) * a.amp);
      let y = ud.base || 0;
      if (def.volador) y += Math.sin(tt * 1.7) * 0.035 + alegria * Math.abs(Math.sin(tt * 6)) * 0.06;
      else if (!ud.descanso) {
        const c = tt % 8;
        if (c < 0.5) y += Math.abs(Math.sin((c / 0.5) * PI)) * 0.07;
        y += alegria * Math.abs(Math.sin(tt * 9)) * 0.1;
      }
      k.g.position.y = y;
      if (k.cabeza) {
        k.cabeza.rotation.z = Math.sin(tt * 0.9) * 0.06;
        k.cabeza.rotation.y = Math.sin(tt * 0.5) * 0.18;
      }
      if (ud.descanso && k.cuerpo) k.cuerpo.scale.y *= 0.82;
      for (const f of k.extras) f(tt, dt, alegria);
    };
  }

  const crear = (def) => (ctx) => {
    const k = kit(ctx);
    def.cuerpo(k, ctx);
    return { animar: animador(k, ctx, def) };
  };
  const mascota = (id, nombre, grupo, porDefecto, cuerpo, extra = {}) =>
    reg(id, nombre, grupo, Object.keys(porDefecto), porDefecto, (ctx) => crear({ cuerpo, ...extra })(ctx), extra);

  /* =================================================================
   * PERROS Y GATOS
   * ================================================================= */
  mascota('perro_cachorro', 'Cachorro', 'Perros y gatos', { principal: '#D9A25B', secundario: '#F6E3C2', acento: '#2B1B14' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), N = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: S, rx: 0.12, ry: 0.11, rz: 0.15, hr: 0.14, pat: 0.07 });
    k.bola(k.g, S, 0.085, 0.07, 0.08, 0, q.yC - 0.03, 0.115);
    k.bola(q.cab, S, 0.065, 0.055, 0.075, 0, -0.045, 0.115);
    k.nariz(q.cab, N, 0.026, 0, -0.012, 0.19);
    k.boca(q.cab, -0.085, 0.172, 0.05);
    k.bola(q.cab, k.m('#F2708A'), 0.016, 0.022, 0.008, 0, -0.112, 0.175);
    k.ojosPar(q.cab, 0.058, 0.04, 0.122, 0.034);
    k.mejillas(q.cab, 0.1, -0.03, 0.1, 0.028);
    for (const s of [-1, 1]) {
      k.bola(q.cab, S, 0.02, 0.012, 0.01, s * 0.058, 0.098, 0.12);
      const pv = k.pivote(q.cab, s * 0.105, 0.075, 0);
      pv.rotation.z = s * 0.4;
      k.bola(pv, k.osc('principal', 0.78), 0.05, 0.1, 0.034, s * 0.02, -0.07, 0);
      k.mov(pv, 'z', 0.1, 2.4, s);
    }
    const cola = k.pivote(k.g, 0, q.yC + 0.02, -0.14);
    cola.rotation.x = -0.9;
    k.bola(cola, P, 0.028, 0.08, 0.028, 0, 0.06, 0);
    k.mov(cola, 'z', 0.55, 11);
  });

  mascota('perro_salchicha', 'Salchicha', 'Perros y gatos', { principal: '#8A4B2A', secundario: '#C58A5A', acento: '#1B1218' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), N = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: P, rx: 0.075, ry: 0.075, rz: 0.24, hr: 0.1, pat: 0.04, pr: 0.03, sep: 0.7, cabZ: 0.8, cabY: 0.45 });
    k.bola(k.g, S, 0.06, 0.04, 0.17, 0, q.yC - 0.045, 0.01);
    k.bola(q.cab, S, 0.045, 0.045, 0.1, 0, -0.035, 0.1);
    k.nariz(q.cab, N, 0.024, 0, -0.012, 0.2);
    k.boca(q.cab, -0.075, 0.17, 0.04);
    k.ojosPar(q.cab, 0.045, 0.04, 0.085, 0.03);
    k.mejillas(q.cab, 0.075, -0.025, 0.07, 0.022);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.085, 0.05, -0.005);
      pv.rotation.z = s * 0.2;
      k.bola(pv, k.osc('principal', 0.8), 0.038, 0.12, 0.04, s * 0.02, -0.09, 0);
      k.mov(pv, 'z', 0.07, 2.2, s);
    }
    const cola = k.pivote(k.g, 0, q.yC + 0.01, -0.235);
    cola.rotation.x = -0.6;
    k.bola(cola, P, 0.018, 0.1, 0.018, 0, 0.07, 0);
    k.mov(cola, 'z', 0.5, 9);
  });

  function gatoBase(k, { iris, rayas }) {
    const P = k.mat('principal'), S = k.mat('secundario'), N = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: P, rx: 0.1, ry: 0.1, rz: 0.14, hr: 0.14, pat: 0.065, pr: 0.032, sep: 0.55, cabZ: 0.65 });
    k.bola(k.g, S, 0.07, 0.065, 0.06, 0, q.yC - 0.03, 0.1);
    for (const sx of [-1, 1]) k.bola(k.g, S, 0.032, 0.025, 0.04, sx * 0.058, 0.03, 0.13);
    k.nariz(q.cab, N, 0.015, 0, -0.03, 0.14);
    k.boca(q.cab, -0.058, 0.128, 0.045);
    k.bola(q.cab, S, 0.045, 0.035, 0.04, 0, -0.045, 0.1);
    k.ojosPar(q.cab, 0.062, 0.03, 0.115, 0.036, iris);
    k.mejillas(q.cab, 0.1, -0.04, 0.095, 0.024);
    k.bigotes(q.cab, -0.045, 0.12, 0.08);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.08, 0.1, -0.005);
      pv.rotation.z = -s * 0.28;
      k.cono(pv, P, 0.052, 0.1, 0, 0.04, 0).scale.z = 0.55;
      k.cono(pv, k.m(ROSA), 0.032, 0.07, 0, 0.032, 0.014).scale.z = 0.4;
      k.mov(pv, 'z', 0.07, 1.6, s * 2);
    }
    if (rayas) for (const dx of [-0.03, 0, 0.03]) k.bola(q.cab, k.osc('principal', 0.72), 0.008, 0.03, 0.006, dx, 0.12, 0.085).rotation.x = -0.9;
    // cola larga en cadena que ondula
    const cad = [];
    let padre = k.pivote(k.g, 0, q.yC, -0.13);
    padre.rotation.x = -0.5;
    for (let i = 0; i < 4; i++) {
      k.bola(padre, P, 0.026 - i * 0.002, 0.035, 0.026 - i * 0.002, 0, 0.03, 0);
      const sig = k.pivote(padre, 0, 0.055, 0);
      sig.rotation.x = -0.25;
      k.mov(sig, 'x', 0.18, 2.6, i * 0.7);
      cad.push(sig);
      padre = sig;
    }
    return q;
  }
  mascota('gato', 'Gatito', 'Perros y gatos', { principal: '#E9944A', secundario: '#FFF1DF', acento: '#E5757F' }, (k) => gatoBase(k, { iris: '#6BBF59', rayas: true }));
  mascota('gato_negro', 'Gatito negro', 'Perros y gatos', { principal: '#2B2A33', secundario: '#4A4958', acento: '#F2C14E' }, (k) => {
    const q = gatoBase(k, { iris: k.col('acento'), rayas: false });
    // moño rojo en el cuello
    const mono = k.m('#D93A4B');
    for (const s of [-1, 1]) k.cono(k.g, mono, 0.03, 0.05, s * 0.032, q.yC + 0.1, 0.1).rotation.z = -s * PI / 2;
    k.bola(k.g, mono, 0.016, 0.016, 0.016, 0, q.yC + 0.1, 0.1);
  });

  /* =================================================================
   * ANIMALITOS
   * ================================================================= */
  mascota('hamster', 'Hámster', 'Animalitos', { principal: '#E8B26E', secundario: '#FFF3E0', acento: '#F29AA5' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario');
    k.cuerpo = k.bola(k.g, P, 0.13, 0.115, 0.125, 0, 0.12, 0);
    k.cuerpoSy = 0.115;
    k.bola(k.g, S, 0.09, 0.08, 0.06, 0, 0.1, 0.07);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.19, 0.06));
    k.bola(cab, P, 0.115, 0.095, 0.1);
    for (const s of [-1, 1]) {
      k.bola(cab, S, 0.07, 0.06, 0.06, s * 0.07, -0.03, 0.04);
      const pv = k.pivote(cab, s * 0.075, 0.09, -0.01);
      k.bola(pv, k.m('#FFCDD2'), 0.035, 0.04, 0.012, 0, 0, 0.03);
      k.bola(pv, P, 0.04, 0.045, 0.02);
      k.mov(pv, 'z', 0.1, 2, s);
      k.bola(k.g, S, 0.026, 0.026, 0.03, s * 0.05, 0.05, 0.1);
      k.bola(k.g, k.mat('acento'), 0.03, 0.012, 0.045, s * 0.05, 0.015, 0.06);
      k.bola(k.g, k.mat('acento'), 0.03, 0.012, 0.045, s * 0.06, 0.015, -0.06);
    }
    k.nariz(cab, k.mat('acento'), 0.018, 0, 0, 0.1);
    k.boca(cab, -0.04, 0.09, 0.04);
    k.bola(cab, S, 0.012, 0.016, 0.006, 0, -0.058, 0.095);
    k.ojosPar(cab, 0.05, 0.03, 0.082, 0.028);
    k.mejillas(cab, 0.085, -0.015, 0.075, 0.022);
    k.bigotes(cab, -0.015, 0.09, 0.06);
    k.bola(k.g, k.m('#4A3A2A'), 0.012, 0.008, 0.016, 0.09, 0.225, 0.14); // semillita de girasol
    k.bola(k.g, S, 0.018, 0.018, 0.018, 0, 0.12, -0.12);
  });

  mascota('conejo', 'Conejito', 'Animalitos', { principal: '#F4EFE8', secundario: '#F8C8D2', acento: '#F29AA5' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario');
    const q = k.cuatro({ mc: P, rx: 0.1, ry: 0.11, rz: 0.13, hr: 0.12, pat: 0.05, pr: 0.03, cabZ: 0.7, cabY: 0.5 });
    k.bola(k.g, k.m('#FFFFFF'), 0.06, 0.07, 0.05, 0, q.yC - 0.02, 0.09);
    k.nariz(q.cab, k.mat('acento'), 0.014, 0, -0.02, 0.118);
    k.boca(q.cab, -0.05, 0.11, 0.04);
    k.bola(q.cab, k.m('#FFFFFF'), 0.012, 0.016, 0.006, 0, -0.067, 0.108);
    k.ojosPar(q.cab, 0.05, 0.03, 0.1, 0.03);
    k.mejillas(q.cab, 0.085, -0.03, 0.085, 0.022);
    k.bigotes(q.cab, -0.03, 0.11, 0.07);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.05, 0.1, -0.01);
      pv.rotation.z = -s * 0.18;
      k.bola(pv, P, 0.035, 0.14, 0.02, 0, 0.12, 0);
      k.bola(pv, S, 0.02, 0.11, 0.012, 0, 0.12, 0.012);
      k.mov(pv, 'z', 0.1, 1.8, s * 2);
    }
    k.bola(k.g, k.m('#FFFFFF', { roughness: 1 }), 0.05, 0.05, 0.05, 0, q.yC + 0.01, -0.14);
  });

  mascota('panda', 'Osito panda', 'Animalitos', { principal: '#FBFBF8', secundario: '#1F1F26', acento: '#F29AA5' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario');
    const q = k.cuatro({ mc: P, mp: S, rx: 0.12, ry: 0.11, rz: 0.12, hr: 0.14, pat: 0.06, pr: 0.04, cabZ: 0.62, cabY: 0.5 });
    k.bola(k.g, S, 0.125, 0.04, 0.05, 0, q.yC + 0.02, 0.06); // franja de los hombros
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.1, 0.11, -0.01);
      k.bola(pv, S, 0.045, 0.045, 0.03);
      k.mov(pv, 'z', 0.12, 1.7, s);
      const m = k.bola(q.cab, S, 0.038, 0.048, 0.02, s * 0.054, 0.025, 0.12);
      m.rotation.z = s * 0.5;
    }
    k.ojosPar(q.cab, 0.054, 0.025, 0.133, 0.022);
    k.nariz(q.cab, S, 0.022, 0, -0.02, 0.14);
    k.boca(q.cab, -0.055, 0.128, 0.045);
    k.mejillas(q.cab, 0.1, -0.04, 0.1, 0.026);
    // bambú
    const verde = k.m('#6DBE5B');
    const b = k.cil(k.g, verde, 0.012, 0.012, 0.16, 0.1, q.yC + 0.03, 0.14);
    b.rotation.z = -0.3;
    for (const y of [-0.04, 0.04]) k.cil(b, k.m('#3F8F3E'), 0.014, 0.014, 0.008, 0, y, 0);
    k.bola(b, verde, 0.03, 0.012, 0.016, 0.02, 0.09, 0).rotation.z = 0.6;
    k.bola(k.g, P, 0.03, 0.03, 0.03, 0, q.yC + 0.01, -0.13);
  });

  mascota('pinguino', 'Pingüinito', 'Animalitos', { principal: '#2A3550', secundario: '#FFFFFF', acento: '#F2A33A' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), O = k.mat('acento');
    const b = k.bipedo({ mc: P, rx: 0.115, ry: 0.15, rz: 0.1, y0: 0.03 });
    k.bola(k.g, S, 0.09, 0.125, 0.07, 0, b.yC - 0.01, 0.045);
    const cab = (k.cabeza = k.pivote(k.g, 0, b.yC + 0.16, 0.01));
    k.bola(cab, P, 0.1, 0.09, 0.09);
    k.bola(cab, S, 0.07, 0.06, 0.04, 0, -0.02, 0.05);
    k.ojosPar(cab, 0.045, 0.02, 0.078, 0.03);
    k.bola(cab, O, 0.028, 0.014, 0.04, 0, -0.012, 0.1);
    k.bola(cab, O, 0.024, 0.01, 0.03, 0, -0.03, 0.098);
    k.mejillas(cab, 0.075, -0.025, 0.07, 0.02);
    for (const s of [-1, 1]) {
      const pv = k.pivote(k.g, s * 0.115, b.yC + 0.06, 0);
      pv.rotation.z = s * 0.3;
      k.bola(pv, P, 0.022, 0.085, 0.045, s * 0.01, -0.06, 0);
      k.mov(pv, 'z', 0.25, 4, s);
      k.pie(k.g, O, s * 0.05, 0.02, 0.055);
    }
    // bufanda
    const bu = k.m('#D93A4B');
    const t = new T.Mesh(new T.TorusGeometry(0.075, 0.017, 8, 24), bu);
    t.position.set(0, b.yC + 0.11, 0.01);
    t.rotation.x = PI / 2;
    k.g.add(t);
    k.caja(k.g, bu, 0.03, 0.08, 0.012, 0.05, b.yC + 0.07, 0.085).rotation.z = 0.1;
  });

  mascota('zorro', 'Zorrito', 'Animalitos', { principal: '#E8762C', secundario: '#FFF4E6', acento: '#2B1B14' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), D = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: D, rx: 0.095, ry: 0.095, rz: 0.14, hr: 0.13, pat: 0.065, pr: 0.03, cabZ: 0.68 });
    k.bola(k.g, S, 0.065, 0.06, 0.06, 0, q.yC - 0.03, 0.1);
    k.bola(q.cab, S, 0.1, 0.05, 0.08, 0, -0.04, 0.045);
    k.bola(q.cab, P, 0.05, 0.05, 0.08, 0, 0.0, 0.07);
    k.bola(q.cab, S, 0.04, 0.04, 0.07, 0, -0.025, 0.1);
    k.nariz(q.cab, D, 0.02, 0, -0.012, 0.165);
    k.boca(q.cab, -0.065, 0.14, 0.04);
    k.ojosPar(q.cab, 0.058, 0.04, 0.105, 0.032);
    k.mejillas(q.cab, 0.1, -0.02, 0.085, 0.022);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.075, 0.1, -0.01);
      pv.rotation.z = -s * 0.2;
      k.cono(pv, P, 0.05, 0.12, 0, 0.05, 0).scale.z = 0.5;
      k.cono(pv, D, 0.036, 0.06, 0, 0.1, 0.004).scale.z = 0.5;
      k.cono(pv, k.m('#FFE0D0'), 0.028, 0.07, 0, 0.04, 0.012).scale.z = 0.3;
      k.mov(pv, 'z', 0.08, 1.4, s * 3);
    }
    const cola = k.pivote(k.g, 0, q.yC, -0.13);
    cola.rotation.x = -1.0;
    k.bola(cola, P, 0.055, 0.13, 0.055, 0, 0.1, 0);
    k.bola(cola, S, 0.05, 0.05, 0.05, 0, 0.21, 0);
    k.mov(cola, 'z', 0.4, 2.2);
  });

  mascota('buho', 'Búho', 'Animalitos', { principal: '#9B6B43', secundario: '#F2DDBD', acento: '#F2A33A' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), O = k.mat('acento');
    const b = k.bipedo({ mc: P, rx: 0.12, ry: 0.15, rz: 0.1, y0: 0.03 });
    k.bola(k.g, S, 0.085, 0.115, 0.06, 0, b.yC - 0.02, 0.05);
    for (let i = 0; i < 3; i++) for (const s of [-1, 0, 1]) k.bola(k.g, k.osc('principal', 0.9), 0.016, 0.011, 0.006, s * 0.03, b.yC - 0.05 + i * 0.035, 0.108 - Math.abs(s) * 0.01);
    const cab = (k.cabeza = k.pivote(k.g, 0, b.yC + 0.15, 0.015));
    k.bola(cab, P, 0.12, 0.1, 0.1);
    for (const s of [-1, 1]) {
      k.bola(cab, S, 0.058, 0.058, 0.03, s * 0.055, 0.015, 0.075);
      k.ojo(cab, s * 0.055, 0.015, 0.098, 0.035, '#F2A33A');
      const pv = k.pivote(cab, s * 0.08, 0.085, 0);
      pv.rotation.z = -s * 0.45;
      k.cono(pv, P, 0.03, 0.08, 0, 0.02, 0).scale.z = 0.6;
      k.mov(pv, 'z', 0.06, 1.5, s);
      const al = k.pivote(k.g, s * 0.12, b.yC + 0.05, -0.01);
      al.rotation.z = s * 0.15;
      k.bola(al, k.osc('principal', 0.8), 0.03, 0.1, 0.06, s * 0.012, -0.07, 0);
      k.mov(al, 'z', 0.1, 2.5, s);
      k.pie(k.g, O, s * 0.05, 0.02, 0.055);
    }
    k.cono(cab, O, 0.022, 0.05, 0, -0.025, 0.115).rotation.x = PI / 2 + 0.3;
    k.mejillas(cab, 0.09, -0.04, 0.07, 0.02);
    const a0 = k.cabeza;
    k.extras.push((t) => { a0.rotation.y = Math.sin(t * 0.5) * 0.18 + (t % 9 < 1.2 ? Math.sin((t % 9) / 1.2 * PI) * 0.9 : 0); });
  });

  mascota('tortuga', 'Tortuguita', 'Animalitos', { principal: '#7CC46B', secundario: '#8A6A3E', acento: '#4C9A52' }, (k) => {
    const P = k.mat('principal'), C = k.mat('secundario');
    k.cuerpo = k.bola(k.g, k.mat('principal'), 0.13, 0.04, 0.15, 0, 0.065, 0);
    k.cuerpoSy = 0.04;
    caparazon(k, C, k.mat('acento'), 0.15, 0.1, 0.17, 0.12);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.1, 0.18));
    k.bola(cab, P, 0.07, 0.065, 0.075);
    k.ojosPar(cab, 0.034, 0.015, 0.058, 0.025);
    k.mejillas(cab, 0.058, -0.022, 0.05, 0.016);
    k.boca(cab, -0.032, 0.07, 0.034);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = k.bola(k.g, P, 0.04, 0.035, 0.05, sx * 0.1, 0.035, sz * 0.09);
      const pv = p;
      k.extras.push((t) => { pv.position.z = sz * 0.09 + Math.sin(t * 2 + (sx * sz > 0 ? 0 : PI)) * 0.012; });
    }
    const cola = k.pivote(k.g, 0, 0.05, -0.16);
    k.cono(cola, P, 0.025, 0.06, 0, 0, -0.02).rotation.x = -PI / 2;
    k.mov(cola, 'y', 0.4, 3);
  });
  function caparazon(k, mat, mat2, rx, ry, rz, y) {
    k.bola(k.g, mat, rx, ry, rz, 0, y - 0.03, 0);
    const placas = [[0, 0.98, 0], [0.55, 0.8, 0], [-0.55, 0.8, 0], [0.45, 0.78, 0.55], [-0.45, 0.78, 0.55], [0.45, 0.78, -0.55], [-0.45, 0.78, -0.55]];
    for (const [x, yy, z] of placas) {
      const m = k.bola(k.g, mat2, rx * 0.32, ry * 0.2, rz * 0.3, x * rx * 0.95, y - 0.03 + yy * ry * 0.98, z * rz * 0.85);
      m.lookAt(x * 2, y + yy * 3, z * 2);
      m.scale.set(rx * 0.32, rx * 0.32, ry * 0.2);
    }
  }

  mascota('pollito', 'Pollito', 'Animalitos', { principal: '#FFD84A', secundario: '#FFF6D2', acento: '#F2A33A' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), O = k.mat('acento');
    k.cuerpo = k.bola(k.g, P, 0.14, 0.13, 0.13, 0, 0.17, 0);
    k.cuerpoSy = 0.13;
    k.bola(k.g, S, 0.1, 0.09, 0.05, 0, 0.15, 0.08);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.18, 0.03));
    for (const s of [-1, 1]) {
      k.ojo(cab, s * 0.06, 0.03, 0.11, 0.032);
      const al = k.pivote(k.g, s * 0.135, 0.17, 0);
      al.rotation.z = s * 0.35;
      k.bola(al, P, 0.03, 0.065, 0.06, s * 0.01, -0.03, 0);
      k.mov(al, 'z', 0.35, 7, s);
      k.pie(k.g, O, s * 0.05, 0.015, 0.02);
    }
    k.mejillas(cab, 0.1, -0.025, 0.09, 0.025);
    k.cono(cab, O, 0.026, 0.05, 0, -0.01, 0.145).rotation.x = PI / 2;
    for (let i = 0; i < 3; i++) {
      const m = k.bola(cab, P, 0.012, 0.04, 0.012, (i - 1) * 0.02, 0.15, 0.01);
      m.rotation.z = (i - 1) * 0.5;
    }
    // cascarón: mitad de huevo abajo
    const c = new T.Mesh(new T.SphereGeometry(0.12, 24, 12, 0, PI * 2, PI / 2 + 0.2, PI / 2 - 0.2), k.m('#FFF8EC', { side: T.DoubleSide }));
    c.position.set(0, 0.12, 0);
    k.g.add(c);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      k.cono(k.g, k.m('#FFF8EC'), 0.022, 0.05, Math.cos(a) * 0.115, 0.115 + (i % 2) * 0.012, Math.sin(a) * 0.115).rotation.x = PI;
    }
  });

  mascota('axolote', 'Axolote', 'Animalitos', { principal: '#F7B3C6', secundario: '#FFE3EA', acento: '#E85A8A' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), G = k.mat('acento');
    k.cuerpo = k.bola(k.g, P, 0.09, 0.075, 0.17, 0, 0.09, -0.02);
    k.cuerpoSy = 0.075;
    k.bola(k.g, S, 0.06, 0.04, 0.12, 0, 0.065, 0);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.1, 0.12));
    k.bola(cab, P, 0.12, 0.08, 0.1);
    k.ojosPar(cab, 0.075, 0.025, 0.08, 0.028);
    k.mejillas(cab, 0.11, -0.035, 0.065, 0.026);
    k.boca(cab, -0.032, 0.095, 0.06);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const pv = k.pivote(cab, s * 0.105, 0.04 + i * 0.03, -0.02);
      pv.rotation.z = -s * (0.5 + i * 0.35);
      pv.rotation.x = -0.1;
      k.bola(pv, G, 0.01, 0.07, 0.014, 0, 0.06, 0);
      for (const d of [-1, 1]) k.bola(pv, G, 0.008, 0.035, 0.01, d * 0.012, 0.09, 0).rotation.z = d * 0.4;
      k.mov(pv, 'z', 0.2, 3, i + s);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = k.pivote(k.g, sx * 0.09, 0.04, sz * 0.09 - 0.03);
      k.bola(p, P, 0.025, 0.02, 0.04, sx * 0.015, 0, 0.012);
      for (const d of [-1, 0, 1]) k.bola(p, P, 0.007, 0.007, 0.012, sx * 0.015 + d * 0.012, 0, 0.05);
    }
    const cola = k.pivote(k.g, 0, 0.09, -0.17);
    k.bola(cola, P, 0.025, 0.05, 0.14, 0, 0.005, -0.1);
    k.bola(cola, G, 0.006, 0.07, 0.16, 0, 0.04, -0.1);
    k.mov(cola, 'y', 0.35, 2.6);
  });

  /* =================================================================
   * DEL PERÚ
   * ================================================================= */
  mascota('cuy', 'Cuy peruano', 'Del Perú', { principal: '#B5733A', secundario: '#FFF1DC', acento: '#D93A4B' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), R = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: S, rx: 0.1, ry: 0.1, rz: 0.15, hr: 0.115, pat: 0.04, pr: 0.03, cabZ: 0.78, cabY: 0.3, ancho: 1 });
    k.bola(k.g, S, 0.07, 0.06, 0.08, 0.04, q.yC + 0.03, -0.03).castShadow = false;
    k.bola(k.g, k.m('#F0A94E'), 0.05, 0.05, 0.06, -0.05, q.yC + 0.02, -0.05).castShadow = false;
    k.bola(q.cab, S, 0.035, 0.07, 0.03, 0, 0.025, 0.1).rotation.x = 0.3;
    k.nariz(q.cab, k.m('#E5757F'), 0.018, 0, -0.025, 0.112);
    k.boca(q.cab, -0.055, 0.1, 0.04);
    k.ojosPar(q.cab, 0.05, 0.03, 0.092, 0.03);
    k.mejillas(q.cab, 0.085, -0.03, 0.08, 0.02);
    k.bigotes(q.cab, -0.03, 0.105, 0.06);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.095, 0.03, -0.01);
      pv.rotation.z = s * 0.5;
      k.bola(pv, k.osc('principal', 0.85), 0.04, 0.045, 0.018, s * 0.015);
      k.mov(pv, 'z', 0.1, 2.2, s);
    }
    // chullo (gorro andino) con orejeras y pompón
    const ch = k.pivote(q.cab, 0, 0.085, 0);
    const gorro = new T.Mesh(new T.SphereGeometry(0.075, 20, 12, 0, PI * 2, 0, PI / 2 + 0.05), R);
    ch.add(gorro);
    gorro.scale.y = 1.15;
    const franja = new T.Mesh(new T.CylinderGeometry(0.0745, 0.0765, 0.014, 20), k.m('#F2C14E'));
    franja.position.y = 0.012;
    ch.add(franja);
    k.cono(ch, k.m('#2DBE60'), 0.07, 0.014, 0, 0.035, 0, 20).scale.set(1, 1, 1);
    k.bola(ch, k.m('#FFF1DC', { roughness: 1 }), 0.02, 0.02, 0.02, 0, 0.09, 0);
    for (const s of [-1, 1]) {
      const fl = k.bola(ch, R, 0.02, 0.05, 0.018, s * 0.075, -0.035, 0.0);
      fl.rotation.z = s * 0.2;
      k.cil(ch, k.m('#F2C14E'), 0.006, 0.006, 0.03, s * 0.078, -0.1, 0);
    }
    ch.rotation.x = 0.1;
  });

  mascota('llama', 'Alpaca', 'Del Perú', { principal: '#F3E6D2', secundario: '#C99A6B', acento: '#D93A4B' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), R = k.mat('acento');
    const lana = k.m(k.col('principal'), { roughness: 1 });
    k.cuerpo = k.bola(k.g, lana, 0.1, 0.1, 0.14, 0, 0.26, 0);
    k.cuerpoSy = 0.1;
    k.copos(k.g, lana, 14, 0.1, 0.27, 0.05, rng(7));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.bola(k.g, lana, 0.034, 0.1, 0.034, sx * 0.06, 0.1, sz * 0.09);
      k.bola(k.g, S, 0.03, 0.02, 0.04, sx * 0.06, 0.012, sz * 0.09 + 0.005);
    }
    const cuello = k.pivote(k.g, 0, 0.32, 0.1);
    cuello.rotation.x = 0.3;
    k.bola(cuello, lana, 0.055, 0.14, 0.055, 0, 0.1, 0);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.5, 0.15));
    k.bola(cab, lana, 0.07, 0.07, 0.075);
    k.bola(cab, P, 0.05, 0.045, 0.06, 0, -0.03, 0.05);
    k.bola(cab, S, 0.03, 0.025, 0.03, 0, -0.045, 0.095);
    k.nariz(cab, k.m('#6A4A3A'), 0.012, 0, -0.03, 0.12);
    k.ojosPar(cab, 0.04, 0.025, 0.063, 0.024);
    k.mejillas(cab, 0.062, -0.025, 0.05, 0.015);
    k.boca(cab, -0.065, 0.1, 0.03);
    k.copos(cab, lana, 6, 0.045, 0.07, 0.04, rng(3));
    for (const s of [-1, 1]) {
      const pv = k.pivote(cab, s * 0.045, 0.075, -0.01);
      pv.rotation.z = -s * 0.5;
      k.bola(pv, P, 0.018, 0.065, 0.016, 0, 0.04, 0);
      k.mov(pv, 'z', 0.15, 2.4, s);
    }
    // aguayo (manta tejida) sobre el lomo
    const man = k.caja(k.g, R, 0.23, 0.014, 0.2, 0, 0.355, 0.0);
    man.scale.set(1, 1, 1);
    for (const [dz, c] of [[-0.05, '#F2C14E'], [0, '#2DBE60'], [0.05, '#3B6FB6']]) k.caja(k.g, k.m(c), 0.232, 0.016, 0.018, 0, 0.357, dz);
    for (const s of [-1, 1]) {
      const fl = k.caja(k.g, R, 0.014, 0.1, 0.2, s * 0.115, 0.31, 0);
      fl.rotation.z = s * -0.15;
      for (const dz of [-0.05, 0, 0.05]) k.caja(k.g, k.m('#F2C14E'), 0.016, 0.05, 0.016, s * 0.118, 0.27, dz);
    }
    const cola = k.pivote(k.g, 0, 0.3, -0.14);
    k.bola(cola, lana, 0.03, 0.04, 0.03, 0, 0.02, -0.01);
    k.mov(cola, 'x', 0.15, 2);
  });

  /* =================================================================
   * MÁGICOS
   * ================================================================= */
  mascota('dragon', 'Dragoncito', 'Mágicos', { principal: '#5BBF8A', secundario: '#F5E3A6', acento: '#E8762C' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), O = k.mat('acento');
    k.cuerpo = k.bola(k.g, P, 0.1, 0.11, 0.1, 0, 0.0, 0);
    k.cuerpoSy = 0.11;
    k.bola(k.g, S, 0.075, 0.09, 0.05, 0, -0.01, 0.06);
    for (let i = 0; i < 4; i++) k.caja(k.g, k.osc('secundario', 0.9), 0.1 - i * 0.004, 0.012, 0.01, 0, -0.05 + i * 0.03, 0.105);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.14, 0.04));
    k.bola(cab, P, 0.115, 0.095, 0.1);
    k.bola(cab, P, 0.06, 0.05, 0.065, 0, -0.035, 0.08);
    k.bola(cab, k.m('#2B1B14'), 0.008, 0.012, 0.008, 0.02, -0.025, 0.14);
    k.bola(cab, k.m('#2B1B14'), 0.008, 0.012, 0.008, -0.02, -0.025, 0.14);
    k.boca(cab, -0.06, 0.12, 0.05);
    k.ojosPar(cab, 0.05, 0.035, 0.088, 0.032, '#F2C14E');
    k.mejillas(cab, 0.09, -0.03, 0.075, 0.022, '#F28C7A');
    for (const s of [-1, 1]) {
      const h = k.cono(cab, S, 0.02, 0.08, s * 0.05, 0.1, -0.01);
      h.rotation.z = -s * 0.35;
      h.rotation.x = -0.25;
      k.cono(cab, O, 0.012, 0.035, s * 0.02, 0.09, -0.07 - 0.0).rotation.x = -0.5;
      const al = k.pivote(k.g, s * 0.09, 0.05, -0.05);
      // ala con membrana
      const shape = new T.Shape();
      shape.moveTo(0, 0); shape.quadraticCurveTo(0.08, 0.12, 0.2, 0.1); shape.quadraticCurveTo(0.16, 0.05, 0.18, 0.0); shape.quadraticCurveTo(0.1, 0.03, 0.1, -0.04); shape.quadraticCurveTo(0.05, -0.01, 0, 0);
      const m2 = new T.Mesh(new T.ShapeGeometry(shape), k.m(k.col('acento'), { side: T.DoubleSide, roughness: 0.6 }));
      m2.scale.x = s;
      m2.castShadow = true;
      al.add(m2);
      al.rotation.y = s * 0.5;
      k.alas.push({ g: al, base: 0, lado: s, amp: 0.55, vel: 9 });
      k.bola(k.g, P, 0.04, 0.035, 0.05, s * 0.05, -0.1, 0.03);
    }
    const cola = k.pivote(k.g, 0, -0.05, -0.08);
    let p = cola;
    for (let i = 0; i < 4; i++) {
      k.bola(p, P, 0.04 - i * 0.008, 0.04 - i * 0.008, 0.06, 0, 0, -0.04);
      const sig = k.pivote(p, 0, 0, -0.07);
      k.mov(sig, 'y', 0.25, 3, i * 0.8);
      p = sig;
    }
    k.cono(p, O, 0.025, 0.06, 0, 0, -0.03).rotation.x = -PI / 2;
    // humito
    const humo = k.bola(k.g, k.m('#DDDDDD', { transparent: true, opacity: 0.5 }), 0.01, 0.01, 0.01, 0, 0.12, 0.2);
    k.extras.push((t) => { const c = (t * 0.5) % 1; humo.position.set(0, 0.15 + c * 0.1, 0.15 + c * 0.1); humo.scale.setScalar(0.01 + c * 0.02); humo.material.opacity = 0.5 * (1 - c); });
  }, { volador: true });

  mascota('unicornio', 'Unicornio', 'Mágicos', { principal: '#FFFFFF', secundario: '#F59AC8', acento: '#F2C14E' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), O = k.mat('acento');
    const q = k.cuatro({ mc: P, mp: P, rx: 0.1, ry: 0.1, rz: 0.15, hr: 0.12, pat: 0.1, pr: 0.03, cabZ: 0.7, cabY: 0.65 });
    k.bola(q.cab, P, 0.06, 0.055, 0.08, 0, -0.045, 0.085);
    k.nariz(q.cab, k.m(ROSA), 0.014, 0.0, -0.04, 0.15);
    k.boca(q.cab, -0.075, 0.125, 0.04);
    k.ojosPar(q.cab, 0.055, 0.025, 0.1, 0.034, '#7A4FD0');
    k.mejillas(q.cab, 0.095, -0.03, 0.085, 0.024);
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.06, 0.1, -0.02);
      pv.rotation.z = -s * 0.15;
      k.cono(pv, P, 0.03, 0.07, 0, 0.03, 0).scale.z = 0.7;
      k.mov(pv, 'z', 0.08, 1.7, s);
      k.bola(k.g, k.m('#F5F0F5'), 0.03, 0.025, 0.04, s * 0.06, 0.02, 0.1);
    }
    // cuerno en espiral
    const cuerno = k.cono(q.cab, O, 0.022, 0.13, 0, 0.17, 0.04);
    cuerno.rotation.x = 0.25;
    for (let i = 0; i < 4; i++) { const t = new T.Mesh(new T.TorusGeometry(0.019 - i * 0.0035, 0.004, 6, 14), k.m('#FFFFFF')); t.position.set(0, 0.13 + i * 0.026 - 0.0, 0.03 + i * 0.006); t.rotation.x = PI / 2 + 0.25; q.cab.add(t); }
    // melena y cola de colores
    const cols = [k.col('secundario'), '#8FD3F2', '#B58CF0'];
    for (let i = 0; i < 6; i++) k.bola(q.cab, k.m(cols[i % 3], { roughness: 0.9 }), 0.04, 0.05, 0.04, 0, 0.1 - i * 0.012, -0.03 - i * 0.03).scale.set(0.04, 0.06, 0.05);
    for (let i = 0; i < 5; i++) k.bola(k.g, k.m(cols[i % 3], { roughness: 0.9 }), 0.025, 0.04, 0.04, 0, q.yC + 0.1 - i * 0.025, 0.14 - i * 0.055).scale.set(0.025, 0.04, 0.045);
    const cola = k.pivote(k.g, 0, q.yC + 0.03, -0.14);
    for (let i = 0; i < 3; i++) {
      const c = k.pivote(cola, 0, 0, 0);
      c.rotation.x = -0.5 - i * 0.2;
      k.bola(c, k.m(cols[i], { roughness: 0.9 }), 0.03, 0.1, 0.03, 0, -0.06, -0.02);
      k.mov(c, 'z', 0.2, 2.5, i);
    }
    // estrellita en el costado
    k.bola(k.g, O, 0.02, 0.02, 0.006, 0.098, q.yC, 0.02).castShadow = false;
  });

  /* =================================================================
   * CRIATURAS FANTÁSTICAS (diseños propios)
   * ================================================================= */
  mascota('raton_chispa', 'Chispín', 'Criaturas', { principal: '#6FD3F2', secundario: '#FFF6C9', acento: '#FFD23A' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), Y = k.mat('acento');
    const rayo = k.brillo(k.col('acento'), 0.7);
    k.cuerpo = k.bola(k.g, P, 0.11, 0.115, 0.1, 0, 0.14, 0);
    k.cuerpoSy = 0.115;
    k.bola(k.g, S, 0.07, 0.08, 0.04, 0, 0.12, 0.07);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.27, 0.01));
    k.bola(cab, P, 0.12, 0.1, 0.105);
    k.ojosPar(cab, 0.05, 0.015, 0.09, 0.035);
    k.nariz(cab, k.m('#2B2A33'), 0.012, 0, -0.02, 0.105);
    k.boca(cab, -0.05, 0.1, 0.04);
    k.mejillas(cab, 0.09, -0.035, 0.08, 0.026, '#FF7A8A');
    for (const s of [-1, 1]) {
      const pv = k.pivote(cab, s * 0.09, 0.095, 0);
      pv.rotation.z = -s * 0.3;
      k.bola(pv, P, 0.062, 0.062, 0.02, 0, 0.045, 0);
      k.bola(pv, Y, 0.04, 0.04, 0.022, 0, 0.065, 0.004);
      k.bola(pv, k.m('#FFB3C1'), 0.035, 0.035, 0.012, 0, 0.035, 0.014);
      k.mov(pv, 'z', 0.1, 2, s);
      const br = k.pivote(k.g, s * 0.11, 0.15, 0.03);
      br.rotation.z = s * 0.4;
      k.bola(br, P, 0.022, 0.06, 0.022, s * 0.01, -0.035, 0);
      k.mov(br, 'z', 0.15, 2.5, s);
      k.bola(k.g, P, 0.03, 0.025, 0.05, s * 0.055, 0.03, 0.03);
    }
    // cola de rayo en zigzag
    const cola = k.pivote(k.g, 0, 0.1, -0.1);
    const pts = [[0, 0], [-0.05, 0.05], [0.0, 0.07], [-0.06, 0.15], [0.0, 0.18], [-0.04, 0.3], [0.08, 0.2], [0.03, 0.18], [0.09, 0.1], [0.04, 0.08], [0.06, 0.0]];
    const sh = new T.Shape();
    sh.moveTo(0.02, 0);
    pts.forEach(([x, y]) => sh.lineTo(x, y));
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
    const rayoMesh = new T.Mesh(geo, rayo);
    rayoMesh.position.z = -0.012;
    cola.add(rayoMesh);
    cola.rotation.x = -0.2;
    k.mov(cola, 'z', 0.12, 3);
    // chispitas
    const chi = [0, 1, 2].map(() => k.bola(k.g, k.brillo('#FFF6C9', 1.5), 0.012, 0.012, 0.012));
    k.extras.push((t) => chi.forEach((c, i) => {
      const a = t * 1.6 + i * 2.1, r = 0.17 + Math.sin(t * 3 + i) * 0.02;
      c.position.set(Math.cos(a) * r, 0.28 + Math.sin(t * 2 + i) * 0.08, Math.sin(a) * r);
      c.scale.setScalar(0.008 + Math.abs(Math.sin(t * 6 + i * 2)) * 0.012);
    }));
  });

  mascota('brasita', 'Brasita', 'Criaturas', { principal: '#E8542C', secundario: '#FFD58A', acento: '#FFB020' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), F = k.brillo(k.col('acento'), 0.9);
    const q = k.cuatro({ mc: P, mp: k.osc('principal', 0.8), rx: 0.11, ry: 0.1, rz: 0.12, hr: 0.12, pat: 0.04, pr: 0.03, cabZ: 0.7, cabY: 0.4 });
    k.bola(k.g, S, 0.075, 0.07, 0.05, 0, q.yC - 0.02, 0.09);
    // caparazón de brasa con manchas
    k.bola(k.g, k.osc('principal', 0.7), 0.1, 0.07, 0.11, 0, q.yC + 0.06, -0.025);
    for (const [x, z] of [[0.04, 0.0], [-0.04, -0.04], [0, -0.07], [-0.03, 0.03]]) k.bola(k.g, F, 0.016, 0.008, 0.016, x, q.yC + 0.125 - Math.abs(x) * 0.3, z - 0.02);
    k.ojosPar(q.cab, 0.055, 0.025, 0.108, 0.034, '#FFE070');
    k.mejillas(q.cab, 0.098, -0.03, 0.09, 0.022, '#FFB020');
    k.boca(q.cab, -0.05, 0.112, 0.045);
    k.nariz(q.cab, k.m('#6A2A1A'), 0.01, 0, -0.02, 0.118);
    // antenitas con punta brillante
    for (const s of [-1, 1]) {
      const pv = k.pivote(q.cab, s * 0.05, 0.1, 0.02);
      pv.rotation.z = -s * 0.5;
      k.cil(pv, P, 0.006, 0.008, 0.1, 0, 0.05, 0);
      k.bola(pv, F, 0.016, 0.016, 0.016, 0, 0.105, 0);
      k.mov(pv, 'z', 0.15, 3, s);
    }
    // cola con llamita
    const cola = k.pivote(k.g, 0, q.yC + 0.01, -0.13);
    cola.rotation.x = -1.0;
    k.bola(cola, P, 0.025, 0.07, 0.025, 0, 0.06, 0);
    const llama = k.pivote(cola, 0, 0.14, 0);
    const l1 = k.cono(llama, k.brillo('#E8542C', 0.8), 0.045, 0.12, 0, 0.05, 0);
    const l2 = k.cono(llama, F, 0.03, 0.09, 0, 0.04, 0.004);
    const l3 = k.cono(llama, k.brillo('#FFF0A0', 1.2), 0.015, 0.05, 0, 0.03, 0.008);
    k.extras.push((t) => { [l1, l2, l3].forEach((l, i) => { l.scale.set(1 + Math.sin(t * 14 + i) * 0.1, 1 + Math.sin(t * 11 + i * 2) * 0.18, 1); l.rotation.z = Math.sin(t * 5 + i) * 0.15; }); });
  });

  mascota('aquita', 'Aquita', 'Criaturas', { principal: '#5CC0F0', secundario: '#E8F8FF', acento: '#2E7FD0' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), C = k.mat('acento');
    k.cuerpo = k.bola(k.g, P, 0.11, 0.07, 0.14, 0, 0.1, 0);
    k.cuerpoSy = 0.07;
    k.bola(k.g, S, 0.08, 0.04, 0.1, 0, 0.075, 0.02);
    // concha en espiral
    k.bola(k.g, C, 0.1, 0.09, 0.11, 0, 0.19, -0.03);
    for (let i = 0; i < 4; i++) {
      const t = new T.Mesh(new T.TorusGeometry(0.095 - i * 0.02, 0.008, 6, 24), k.m('#E8F8FF'));
      t.position.set(0, 0.19 + i * 0.012, -0.03);
      t.rotation.x = PI / 2;
      k.g.add(t);
    }
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.13, 0.15));
    k.bola(cab, P, 0.09, 0.08, 0.085);
    k.ojosPar(cab, 0.045, 0.02, 0.07, 0.03);
    k.mejillas(cab, 0.075, -0.025, 0.062, 0.02);
    k.boca(cab, -0.04, 0.078, 0.04);
    // cresta de ola
    for (let i = 0; i < 3; i++) { const c = k.cono(cab, S, 0.02, 0.06, 0, 0.09 + (1 - Math.abs(i - 1)) * 0.015, 0.04 - i * 0.035); c.rotation.x = -0.6 - i * 0.2; }
    for (const s of [-1, 1]) {
      const pv = k.pivote(k.g, s * 0.1, 0.09, 0.08);
      pv.rotation.z = s * 0.5;
      k.bola(pv, P, 0.07, 0.015, 0.035, s * 0.05, 0, 0);
      k.mov(pv, 'z', 0.3, 2.6, s);
      const pt = k.pivote(k.g, s * 0.08, 0.07, -0.09);
      pt.rotation.z = s * 0.3;
      k.bola(pt, P, 0.05, 0.014, 0.03, s * 0.03, 0, 0);
      k.mov(pt, 'z', 0.25, 2.6, s + 2);
    }
    const aleta = k.pivote(k.g, 0, 0.11, -0.14);
    k.bola(aleta, C, 0.012, 0.05, 0.04, 0, 0.02, -0.03);
    k.mov(aleta, 'y', 0.4, 3);
    // burbujas
    const bur = [0, 1, 2].map(() => k.bola(k.g, k.m('#CFEFFF', { transparent: true, opacity: 0.55, roughness: 0.1 }), 0.02, 0.02, 0.02));
    k.extras.push((t) => bur.forEach((b, i) => { const c = (t * 0.35 + i / 3) % 1; b.position.set(0.1 + Math.sin(c * 6 + i) * 0.03, 0.2 + c * 0.25, 0.1 - i * 0.06); b.scale.setScalar(0.012 + c * 0.014); b.material.opacity = 0.6 * (1 - c); }));
  });

  mascota('brotecito', 'Brotecito', 'Criaturas', { principal: '#9BDB6A', secundario: '#E8F5C8', acento: '#2E9C4E' }, (k) => {
    const P = k.mat('principal'), S = k.mat('secundario'), G = k.mat('acento');
    k.cuerpo = k.bola(k.g, P, 0.12, 0.12, 0.11, 0, 0.13, 0);
    k.cuerpoSy = 0.12;
    k.bola(k.g, S, 0.08, 0.08, 0.04, 0, 0.1, 0.075);
    const cab = (k.cabeza = k.pivote(k.g, 0, 0.14, 0.02));
    k.ojosPar(cab, 0.055, 0.04, 0.095, 0.036);
    k.mejillas(cab, 0.095, -0.0, 0.085, 0.026);
    k.boca(cab, -0.02, 0.108, 0.045);
    // brote con hojas
    const tallo = k.pivote(k.g, 0, 0.24, 0);
    k.cil(tallo, G, 0.01, 0.014, 0.08, 0, 0.04, 0);
    for (const s of [-1, 1]) {
      const h = k.pivote(tallo, 0, 0.08, 0);
      h.rotation.z = -s * 0.8;
      k.bola(h, G, 0.07, 0.012, 0.035, s * 0.065, 0, 0);
      k.bola(h, k.osc('acento', 1.3), 0.06, 0.008, 0.008, s * 0.065, 0.008, 0);
      k.mov(h, 'z', 0.15, 2.2, s);
    }
    k.mov(tallo, 'x', 0.1, 1.6);
    // capullo de flor
    const flor = k.bola(tallo, k.m('#F59AC8'), 0.02, 0.03, 0.02, 0, 0.11, 0);
    const yem = k.cono(tallo, k.m('#F59AC8'), 0.018, 0.04, 0, 0.14, 0);
    k.extras.push((t) => { yem.scale.setScalar(1 + Math.sin(t * 2) * 0.08); });
    // piecitos con raíces
    for (const s of [-1, 1]) {
      k.bola(k.g, k.m('#8A5A33'), 0.04, 0.025, 0.055, s * 0.06, 0.02, 0.03);
      const hoja = k.bola(k.g, G, 0.03, 0.01, 0.014, s * 0.12, 0.17, 0.0);
      hoja.rotation.z = s * 0.5;
    }
  });

  mascota('fantasmita', 'Fantasmita', 'Criaturas', { principal: '#F3F0FF', secundario: '#C8B8F0', acento: '#F59AC8' }, (k) => {
    const sab = k.m(k.col('principal'), { roughness: 0.55, emissive: k.col('principal'), emissiveIntensity: 0.12 });
    // cuerpo: sábana con cola ondulada
    const perfil = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI / 2; perfil.push(new T.Vector2(Math.sin(a) * 0.11, 0.1 + Math.cos(a) * 0.1)); }
    perfil.push(new T.Vector2(0.115, 0.04), new T.Vector2(0.12, -0.02), new T.Vector2(0.115, -0.08));
    const geo = new T.LatheGeometry(perfil.reverse(), 32);
    const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j++) { const y = pos.getY(j); if (y < -0.0) { const a = Math.atan2(pos.getZ(j), pos.getX(j)); pos.setY(j, y - (Math.cos(a * 4) * 0.5 + 0.5) * 0.045 * Math.min(1, -y * 20)); } }
    geo.computeVertexNormals();
    const cuerpo = new T.Mesh(geo, sab);
    cuerpo.castShadow = true;
    const cg = k.pivote(k.g, 0, 0.0, 0);
    cg.add(cuerpo);
    k.cuerpo = cg;
    k.cabeza = k.pivote(k.g, 0, 0.12, 0.02);
    k.ojosPar(k.g, 0.045, 0.13, 0.108, 0.03);
    k.boca(k.g, 0.06, 0.118, 0.045, '#6A4A8A');
    k.mejillas(k.g, 0.08, 0.08, 0.1, 0.024);
    for (const s of [-1, 1]) {
      const br = k.pivote(k.g, s * 0.12, 0.06, 0.03);
      br.rotation.z = s * 0.8;
      k.bola(br, sab, 0.025, 0.05, 0.025, s * 0.02, -0.02, 0);
      k.mov(br, 'z', 0.35, 3.2, s);
    }
    // moñito
    const mono = k.mat('acento');
    for (const s of [-1, 1]) k.cono(k.g, mono, 0.03, 0.05, s * 0.04, 0.215, 0.05).rotation.z = -s * PI / 2;
    k.bola(k.g, mono, 0.016, 0.016, 0.016, 0, 0.215, 0.05);
    k.extras.push((t) => { cg.scale.x = 1 + Math.sin(t * 2.5) * 0.02; cg.rotation.z = Math.sin(t * 1.3) * 0.05; });
  }, { volador: true });

  mascota('estrellita', 'Estrellita', 'Criaturas', { principal: '#FFD84A', secundario: '#FFF3A8', acento: '#F29A3A' }, (k) => {
    const sh = new T.Shape();
    const n = 5, R = 0.16, r = 0.09;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * PI * 2 + PI / 2, rr = i % 2 ? r : R;
      i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.035, bevelSegments: 5, curveSegments: 8 });
    geo.center();
    const cuerpo = new T.Mesh(geo, k.m(k.col('principal'), { roughness: 0.45, emissive: k.col('principal'), emissiveIntensity: 0.18 }));
    cuerpo.castShadow = true;
    const cg = k.pivote(k.g, 0, 0.0, 0);
    cg.add(cuerpo);
    k.cuerpo = cg;
    k.cabeza = null;
    k.ojosPar(cg, 0.04, 0.0, 0.075, 0.026);
    k.boca(cg, -0.04, 0.083, 0.04);
    k.mejillas(cg, 0.07, -0.03, 0.075, 0.02, '#FF8A9A');
    const brillos = [0, 1, 2, 3].map(() => k.bola(k.g, k.brillo('#FFFFFF', 1.6), 0.012, 0.012, 0.012));
    k.extras.push((t) => {
      cg.rotation.z = Math.sin(t * 1.4) * 0.18;
      cg.rotation.y = Math.sin(t * 0.8) * 0.35;
      brillos.forEach((b, i) => { const a = t * 1.2 + i * 1.57, rr = 0.22 + Math.sin(t * 2 + i) * 0.02; b.position.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.8, 0.02); b.scale.setScalar(0.006 + Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.016); });
    });
  }, { volador: true });
}
