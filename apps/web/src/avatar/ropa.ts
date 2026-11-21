/* eslint-disable -- piezas pasadas tal cual de la maqueta aprobada (no se reescriben a mano) */
// @ts-nocheck
import { AVATAR } from './nucleo';

/*
 * Ropa del avatar de Caprichos: arriba (polos, camisas, chompas, casacas, vestidos...), abajo (pantalones, faldas...) y calzado.
 * Todas las prendas se construyen con las ayudas del núcleo (H.torso, H.falda, H.cadera) y sus propias ayudas (kit):
 * mangas y piernas van DENTRO de los grupos de brazos/piernas para moverse al animar.
 * Ids estables (minusculas_con_guion_bajo): los disfraces dependen de ellos.
 */
export function registrarRopa() {
  const A = AVATAR;
  const T = A.T, MED = A.MED, ESC = .8, PI = Math.PI;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const reg = (cat, id, nombre, grupo, colores, porDefecto, construir, extra) =>
    A.registrar(cat, Object.assign({ id, nombre, grupo, colores, porDefecto, construir }, extra));
  const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const CREMA = '#F6EBDD', NARANJA = '#E67929';

  /* =================================================================
   * KIT: ayudas de ropa ligadas al ctx de la pieza
   * ================================================================= */
  function kit(ctx) {
    const { H, partes: P, M, malla, caja, esfera, tono } = ctx;
    const cu = P.cuerpo, an = P.ancho;
    const k = { ctx, P, H, cu, an, M, tono, caja };
    k.mat = (s, o) => ctx.mat(s, o);
    k.col = ctx.col;
    k.osc = (s, f, o) => M(tono(ctx.col(s), f), o);
    k.tex = (w, h, fn, rep) => ctx.texCanvas(w, h, fn, rep);
    k.mt = (tex, o) => M('#FFFFFF', Object.assign({ map: tex, roughness: .85 }, o));
    k.esf = (r, mat, x, y, z, p, sx = 1, sy = 1, sz = 1, seg = 14) => { const m = esfera(r, mat, x, y, z, p, seg); m.scale.set(sx, sy, sz); return m; };
    k.cil = (r0, r1, h, mat, x, y, z, p, seg = 18) => malla(new T.CylinderGeometry(r0, r1, h, seg), mat, x, y, z, p);
    k.tor = (r, tubo, mat, x, y, z, p, arc = PI * 2, seg = 28) => malla(new T.TorusGeometry(r, tubo, 6, seg, arc), mat, x, y, z, p);
    /** Aro horizontal alrededor de un eje vertical. */
    k.aro = (r, tubo, mat, x, y, z, p, esx = 1, esz = 1) => { const m = k.tor(r, tubo, mat, x, y, z, p); m.rotation.x = PI / 2; m.scale.set(esx, esz, 1); return m; };
    k.linea = (a, b, r, mat, p) => {
      const d = b.clone().sub(a), l = d.length();
      const m = malla(new T.CylinderGeometry(r, r, l, 6), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, p || cu);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m;
    };

    /* ---- superficie del torso (con holgura y ensanche como H.torso) ---- */
    k.sup = (desde, hasta, hol, ens) => {
      const f = (y) => Math.pow(Math.max(0, 1 - (y - desde) / (hasta - desde)), 2);
      const r = (y, e = 0) => H.radioTorso(y) + hol + ens * f(y) + e;
      const pt = (y, ang = 0, e = .004) => { const rr = r(y, e); return V(Math.sin(ang) * rr * an, y, Math.cos(ang) * rr * ESC); };
      const pitch = (y) => Math.atan(ESC * (r(y + .01) - r(y - .01)) / .02);
      return { desde, hasta, hol, ens, r, pt, pitch };
    };
    k.top = ({ mat, desde = .49, hasta = 1.1, hol = .022, ens = .03, cerrado = true }) => {
      const s = k.sup(desde, hasta, hol, ens);
      s.mesh = H.torso({ desde, hasta, holgura: hol, ensanche: ens, mat, cerrado });
      return s;
    };
    /** Torso con hueco al frente (cárdigan abierto): cubre de ángulo fi0 a fi1. */
    k.parcial = ({ mat, desde, hasta, hol, ens, fi0, fi1, e = 0 }) => {
      const s = k.sup(desde, hasta, hol, ens), pts = [];
      for (let i = 0; i <= 18; i++) { const y = desde + (hasta - desde) * i / 18; pts.push(new T.Vector2(s.r(y, e), y)); }
      const m2 = mat.clone(); m2.side = T.DoubleSide;
      const m = malla(new T.LatheGeometry(pts, 40, fi0, fi1 - fi0), m2, 0, 0, 0, cu);
      m.scale.set(an, 1, ESC); s.mesh = m; return s;
    };
    k.anillo = (pr, y, tubo, mat, e = 0) => k.aro(pr.r(y, e), tubo, mat, 0, y, 0, cu, an, ESC);
    /** Estampado transparente que envuelve el torso (logo, número, faja). */
    k.parche = (pr, { y0, y1, centro = 0, mitad = .4, tex, e = .006, n = 6, seg = 28 }) => {
      const pts = [];
      for (let j = 0; j <= n; j++) { const y = y0 + (y1 - y0) * j / n; pts.push(new T.Vector2(pr.r(y, e), y)); }
      const mat = M('#FFFFFF', { map: tex, transparent: true, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = malla(new T.LatheGeometry(pts, seg, centro - mitad, mitad * 2), mat, 0, 0, 0, cu);
      m.scale.set(an, 1, ESC); return m;
    };
    /** Tira vertical sobre el torso (botonadura, cierre, franjas). */
    k.placa = (pr, y0, y1, w, mat, ang = 0, e = .003) => {
      const n = Math.max(1, Math.round((y1 - y0) / .06)), dy = (y1 - y0) / n;
      for (let j = 0; j < n; j++) {
        const y = y0 + dy * (j + .5), p = pr.pt(y, ang, e);
        const m = caja(w, dy * 1.05, .006, mat, p.x, p.y, p.z, cu);
        m.rotation.set(pr.pitch(y), ang, 0, 'YXZ');
      }
    };
    k.boton = (pr, y, ang, mat, r = .009) => { const p = pr.pt(y, ang, .006), m = k.esf(r, mat, p.x, p.y, p.z, cu, 1, 1, .5, 10); m.rotation.set(pr.pitch(y), ang, 0, 'YXZ'); return m; };
    k.botones = (pr, ys, mat, ang = 0, r = .009) => ys.forEach((y) => k.boton(pr, y, ang, mat, r));
    k.zip = (pr, y0, y1, mat, ang = 0, tirador = null) => {
      k.placa(pr, y0, y1, .011, mat, ang, .004);
      const p = pr.pt(y1 - .015, ang, .008);
      const c = caja(.02, .03, .008, tirador || mat, p.x, p.y, p.z, cu); c.rotation.set(pr.pitch(y1), ang, 0, 'YXZ');
    };
    k.bolsillo = (pr, y, ang, w, h, mat, solapa, boton) => {
      const p = pr.pt(y, ang, .004), g = new T.Group();
      g.position.copy(p); g.rotation.set(pr.pitch(y), ang, 0, 'YXZ'); cu.add(g);
      caja(w, h, .008, mat, 0, 0, 0, g);
      if (solapa) {
        caja(w * 1.05, h * .34, .012, solapa, 0, h * .36, .002, g);
        if (boton) k.esf(.007, boton, 0, h * .2, .009, g, 1, 1, .5, 8);
      }
      return g;
    };
    /** V de escote con ribete (estampado de piel que se ajusta al torso). borde = color hex del ribete. */
    k.vcuello = (pr, borde, prof = 1, ancho = 1) => {
      const piel = tono(P.c.piel, .94);
      const tex = k.tex(256, 256, (g, W, Hh) => {
        g.clearRect(0, 0, W, Hh);
        g.beginPath(); g.moveTo(W * (.5 - .46 * ancho), Hh * .02); g.lineTo(W * (.5 + .46 * ancho), Hh * .02); g.lineTo(W * .5, Hh * (.1 + .8 * prof)); g.closePath();
        g.fillStyle = piel; g.fill();
        if (borde) { g.strokeStyle = borde; g.lineWidth = 12; g.lineJoin = 'round'; g.beginPath(); g.moveTo(W * (.5 - .46 * ancho), Hh * .02); g.lineTo(W * .5, Hh * (.1 + .8 * prof)); g.lineTo(W * (.5 + .46 * ancho), Hh * .02); g.stroke(); }
      });
      k.parche(pr, { y0: .99, y1: 1.125, centro: 0, mitad: .42, tex, e: .006, n: 12 });
    };
    /** Escote redondo bajo (blusa, vestido) con ribete. */
    k.escote = (pr, borde, ancho = 1, prof = 1) => {
      const piel = tono(P.c.piel, .94);
      const tex = k.tex(256, 256, (g, W, Hh) => {
        g.clearRect(0, 0, W, Hh);
        g.beginPath(); g.ellipse(W / 2, Hh * .04, W * .44 * ancho, Hh * .6 * prof, 0, 0, PI); g.closePath();
        g.fillStyle = piel; g.fill();
        if (borde) { g.strokeStyle = borde; g.lineWidth = 12; g.beginPath(); g.ellipse(W / 2, Hh * .04, W * .44 * ancho, Hh * .6 * prof, 0, 0, PI); g.stroke(); }
      });
      k.parche(pr, { y0: .99, y1: 1.125, centro: 0, mitad: .5, tex, e: .006, n: 12 });
    };
    /** Aro del sobaco (prendas sin mangas). */
    k.sisa = () => {};

    /** Cuello de camisa: dos solapas triangulares que siguen la pendiente del hombro y banda al cuello. */
    k.solapas = (pr, mat, mat2, tam = 1, ang = .36) => {
      k.aro(.074, .011, mat2 || mat, 0, 1.108, 0, cu);
      for (const s of [-1, 1]) {
        const y = 1.088, g = new T.Group(); g.position.copy(pr.pt(y, s * ang, .014 + .004 * tam)); g.rotation.set(pr.pitch(y), s * ang, 0, 'YXZ'); cu.add(g);
        g.scale.x = s;
        const sh = new T.Shape(); sh.moveTo(-.034 * tam, .036 * tam); sh.lineTo(.04 * tam, .03 * tam); sh.lineTo(.03 * tam, -.052 * tam);
        const mm = mat.clone(); mm.side = T.DoubleSide; malla(new T.ShapeGeometry(sh), mm, 0, 0, 0, g);
      }
    };
    /* ---- mangas ---- */
    k.mangas = ({ largo = .1, mat, matM, punio, hol = .018, bufa = 0, vuelo = 0, aroPunio = true }) => {
      for (let i = 0; i < 2; i++) {
        const h = P.brazos[i], c = P.codos[i], R = MED.radioBrazo + hol;
        k.esf(R + .005, mat, 0, 0, 0, h, 1, 1, 1, 16);
        if (bufa) k.esf(R + bufa, mat, 0, -.045, 0, h, 1, 1.05, 1, 16);
        const lu = Math.min(largo, .225), mm = matM || mat;
        k.cil(R + .004 + vuelo * .3, R + vuelo, lu, mm, 0, -lu / 2, 0, h);
        let g = h, yFin = -lu, rFin = R + vuelo;
        if (largo > .225) {
          const lf = largo - .225, Rf = MED.radioAntebrazo + hol;
          k.esf(R * .99, mm, 0, 0, 0, c, 1, 1, 1, 14);
          k.cil(R * .96, Rf + vuelo, lf, mm, 0, -lf / 2, 0, c);
          g = c; yFin = -lf; rFin = Rf + vuelo;
        }
        if (punio) {
          k.cil(rFin + .005, rFin + .005, .032, punio, 0, yFin + .016, 0, g);
          if (aroPunio) k.aro(rFin + .005, .005, punio, 0, yFin + .032, 0, g);
        }
      }
    };

    /* ---- pantalones / piernas ---- */
    k.pantalon = ({ mat, largo = .475, hol = .016, vuelo = 0, bolsa = 0, cadera = true }) => {
      const Rt = MED.radioMuslo + hol + .008 + bolsa, Rk = MED.radioPierna + hol + .012 + bolsa * .8;
      const lf = Math.max(0, largo - .26), dT = Math.min(largo, .26);
      const Rend = lf > 0 ? Rk : Rt + (Rk - Rt) * ((dT + .03) / .29) + vuelo;
      const Rbot = MED.radioPierna + hol + vuelo;
      if (cadera) {
        H.cadera({ holgura: hol, mat });
        H.torso({ desde: .49, hasta: .7, holgura: hol, ensanche: 0, mat, cerrado: false });
      }
      const legs = [];
      for (let i = 0; i < 2; i++) {
        const p = P.piernas[i], r = P.rodillas[i];
        k.cil(Rt, Rend, .03 + dT, mat, 0, (.03 - dT) / 2, 0, p, 20);
        if (lf > 0) { k.esf(Rk, mat, 0, 0, 0, r, 1, 1, 1, 16); k.cil(Rk * .985, Rbot, lf, mat, 0, -lf / 2, 0, r, 20); }
        legs.push({ p, r, s: i ? 1 : -1 });
      }
      const at = (i, d, ang = 0, e = .003) => {
        const lg = legs[i];
        if (d <= dT || lf <= 0) { const R = Rt + (Rend - Rt) * ((d + .03) / (dT + .03)) + e; return { g: lg.p, v: V(Math.sin(ang) * R, -d, Math.cos(ang) * R), R }; }
        const R = Rk + (Rbot - Rk) * ((d - .26) / lf) + e;
        return { g: lg.r, v: V(Math.sin(ang) * R, -(d - .26), Math.cos(ang) * R), R };
      };
      const pa = {
        legs, at, largo, dT, lf,
        linea(i, d0, d1, ang, m, rad = .0026, e = .002) {
          if (lf > 0 && d0 < .26 && d1 > .26) {
            const a = at(i, d0, ang, e), b = at(i, .26, ang, e), c = at(i, .2601, ang, e), d = at(i, d1, ang, e);
            k.linea(a.v, b.v, rad, m, a.g); k.linea(c.v, d.v, rad, m, c.g);
          } else { const a = at(i, d0, ang, e), b = at(i, d1, ang, e); k.linea(a.v, b.v, rad, m, a.g); }
        },
        /** Anillo (basta, puño elástico) terminando en la distancia d bajo la cadera. */
        anillo(i, d, alto, m, e = .004) { const a = at(i, d - alto / 2, 0, 0); return k.cil(a.R + e, a.R + e, alto, m, 0, a.v.y, 0, a.g, 22); },
        bolsillo(i, d, ang, w, h, m, solapa, boton) {
          const a = at(i, d, ang, .003), g = new T.Group(); g.position.copy(a.v); g.rotation.y = ang; a.g.add(g);
          caja(w, h, .012, m, 0, 0, 0, g);
          if (solapa) { caja(w * 1.05, h * .3, .016, solapa, 0, h * .36, .002, g); if (boton) k.esf(.007, boton, 0, h * .18, .01, g, 1, 1, .5, 8); }
          return g;
        },
      };
      return pa;
    };
    return k;
  }

  /* =================================================================
   * TEXTURAS (dibujan con los colores que elige el cliente)
   * ================================================================= */
  const dib = {
    rayas: (c1, c2, pares) => (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2; const b = h / (pares * 2); for (let i = 0; i < pares; i++) g.fillRect(0, (i * 2 + 1) * b, w, b); },
    cuadros: (c1, c2, c3) => (g, w, h) => {
      g.fillStyle = c1; g.fillRect(0, 0, w, h); g.globalAlpha = .62; g.fillStyle = c2;
      g.fillRect(0, 0, w / 2, h); g.fillRect(0, 0, w, h / 2); g.globalAlpha = 1;
      g.strokeStyle = c3; g.lineWidth = 3; g.globalAlpha = .7;
      g.strokeRect(w * .72, -2, 0, h + 4); g.beginPath(); g.moveTo(w * .75, 0); g.lineTo(w * .75, h); g.moveTo(0, h * .75); g.lineTo(w, h * .75); g.stroke(); g.globalAlpha = 1;
    },
    denim: (c) => (g, w, h) => {
      g.fillStyle = c; g.fillRect(0, 0, w, h); const r = rng(7); g.globalAlpha = .45;
      for (let n = 0; n < 320; n++) { g.fillStyle = r() < .5 ? A.tono(c, .86) : A.tono(c, 1.15); g.fillRect(r() * w, r() * h, 1, 2 + r() * 5); }
      g.globalAlpha = 1;
    },
    punto: (c) => (g, w, h) => {
      g.fillStyle = c; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) { g.fillStyle = A.tono(c, .86); g.fillRect(x, 0, 2, h); g.fillStyle = A.tono(c, 1.1); g.fillRect(x + 2, 0, 1, h); }
    },
    rombos: (c1, c2, c3) => (g, w, h) => {
      g.fillStyle = c1; g.fillRect(0, 0, w, h);
      g.fillStyle = c2; g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 4, h / 2); g.lineTo(w / 2, h - 4); g.lineTo(4, h / 2); g.closePath(); g.fill();
      g.strokeStyle = c3; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
      g.fillStyle = c3; g.beginPath(); g.arc(w / 2, h / 2, 5, 0, PI * 2); g.fill();
    },
    puntos: (c1, c2) => (g, w, h) => {
      g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2;
      for (const [x, y] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) { g.beginPath(); g.arc(x, y, w * .16, 0, PI * 2); g.fill(); }
    },
    acolchado: (c) => (g, w, h) => {
      g.fillStyle = A.tono(c, .72); g.fillRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * .62); gr.addColorStop(0, A.tono(c, 1.18)); gr.addColorStop(1, A.tono(c, .78));
      g.fillStyle = gr; g.fillRect(3, 3, w - 6, h - 6);
    },
    cordones: (c) => (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); },
    navidad: (rojo, blanco, verde) => (g, w, h) => {
      g.fillStyle = rojo; g.fillRect(0, 0, w, h);
      const r = rng(11); g.fillStyle = blanco;
      for (let n = 0; n < 70; n++) { g.beginPath(); g.arc(r() * w, h * (.5 + r() * .5), 2 + r() * 2.5, 0, PI * 2); g.fill(); }
      const zig = (y) => { g.fillStyle = blanco; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 12); g.lineTo(x + 16, y); g.fill(); } };
      zig(h * .105); g.fillStyle = rojo; zig(h * .105 + 3);
      g.fillStyle = verde; g.fillRect(0, h * .46, w, 5); g.fillStyle = blanco; g.fillRect(0, h * .46 + 5, w, 3);
      g.fillStyle = blanco; g.fillRect(0, h * .125 - 8, w, 3);
      const pino = (cx, base) => {
        g.fillStyle = '#6B4423'; g.fillRect(cx - 4, base - 12, 8, 12);
        g.fillStyle = verde; for (let t = 0; t < 3; t++) { const y = base - 12 - t * 22, a = 30 - t * 6; g.beginPath(); g.moveTo(cx, y - 34); g.lineTo(cx - a, y); g.lineTo(cx + a, y); g.fill(); }
        g.fillStyle = '#F2D27A'; g.beginPath(); g.arc(cx, base - 12 - 2 * 22 - 34, 5, 0, PI * 2); g.fill();
      };
      const reno = (cx, base) => {
        g.fillStyle = blanco; g.strokeStyle = blanco; g.lineWidth = 4;
        g.beginPath(); g.ellipse(cx, base - 42, 30, 17, 0, 0, PI * 2); g.fill();
        g.beginPath(); g.arc(cx + 30, base - 66, 11, 0, PI * 2); g.fill();
        for (const dx of [-20, -8, 12, 24]) { g.beginPath(); g.moveTo(cx + dx, base - 30); g.lineTo(cx + dx, base); g.stroke(); }
        g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 28, base - 74); g.lineTo(cx + 22, base - 98); g.moveTo(cx + 36, base - 74); g.lineTo(cx + 44, base - 96); g.moveTo(cx + 22, base - 98); g.lineTo(cx + 14, base - 94); g.moveTo(cx + 44, base - 96); g.lineTo(cx + 52, base - 92); g.stroke();
        g.fillStyle = '#E02B2B'; g.beginPath(); g.arc(cx + 40, base - 64, 4, 0, PI * 2); g.fill();
      };
      const base = h * .43;
      for (let j = 0; j <= 8; j++) { g.save(); g.translate(j * 64, base); g.scale(.6, .6); g.translate(0, -base); (j % 2 ? reno : pino)(0, base); g.restore(); }
    },
  };

  /* Estampado de texto sobre fondo transparente (logo, número) */
  const texTexto = (k, dibujar, w = 256, h = 256) => k.tex(w, h, (g, W, Hh) => { g.clearRect(0, 0, W, Hh); g.textAlign = 'center'; g.textBaseline = 'middle'; dibujar(g, W, Hh); });

  /* =================================================================
   * ARRIBA
   * ================================================================= */
  const dc = (colores, porDefecto) => ({ colores, porDefecto });

  // ---------- Polos ----------
  reg('arriba', 'polo_basico', 'Polo básico', 'Polos', ['principal', 'secundario'], { principal: '#2F6FA8', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), os = k.osc('principal', .88);
    const pr = k.top({ mat: m, desde: .485 });
    k.anillo(pr, .492, .008, os);
    ctx.H.cuello('redondo', m, k.mat('secundario'));
    k.mangas({ largo: .105, mat: m, punio: os });
  });

  reg('arriba', 'polo_cuello_v', 'Polo cuello V', 'Polos', ['principal', 'secundario'], { principal: '#B23A48', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), os = k.osc('principal', .88);
    const pr = k.top({ mat: m, desde: .485 });
    k.anillo(pr, .492, .008, os);
    k.vcuello(pr, k.col('secundario'));
    k.mangas({ largo: .105, mat: m, punio: os });
  });

  reg('arriba', 'polo_rayas', 'Polo de rayas', 'Polos', ['principal', 'secundario'], { principal: CREMA, secundario: '#0B2C3E' }, (ctx) => {
    const k = kit(ctx), c1 = k.col('principal'), c2 = k.col('secundario');
    const m = k.mt(k.tex(8, 256, dib.rayas(c1, c2, 8), [1, 1])), ms = k.mt(k.tex(8, 64, dib.rayas(c1, c2, 2), [1, .5]));
    const pr = k.top({ mat: m, desde: .485 });
    k.anillo(pr, .492, .008, k.mat('secundario'));
    ctx.H.cuello('redondo', m, k.mat('secundario'));
    k.mangas({ largo: .105, mat: ms, punio: k.mat('secundario') });
  });

  reg('arriba', 'polo_caprichos', 'Polo Caprichos', 'Polos', ['principal', 'secundario'], { principal: CREMA, secundario: NARANJA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), c2 = k.col('secundario');
    const pr = k.top({ mat: m, desde: .485 });
    k.anillo(pr, .492, .008, k.mat('secundario'));
    ctx.H.cuello('redondo', m, k.mat('secundario'));
    k.mangas({ largo: .105, mat: m, punio: k.mat('secundario') });
    const logo = texTexto(k, (g, W, Hh) => {
      g.fillStyle = c2; g.font = '900 150px Georgia, "Times New Roman", serif'; g.fillText('C.', W / 2, Hh * .44);
      g.font = '700 30px "Segoe UI", Arial, sans-serif'; g.fillText('CAPRICHOS', W / 2, Hh * .86);
      g.fillRect(W * .2, Hh * .75, W * .6, 4);
    });
    k.parche(pr, { y0: .74, y1: .98, centro: 0, mitad: .52, tex: logo });
  });

  reg('arriba', 'polo_oversize', 'Polo oversize', 'Polos', ['principal', 'secundario'], { principal: '#5C7A5A', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .85 }), os = k.osc('principal', .88);
    const pr = k.top({ mat: m, desde: .485, hol: .036, ens: .07 });
    k.anillo(pr, .494, .01, os);
    ctx.H.cuello('redondo', m, k.mat('secundario'));
    k.mangas({ largo: .2, mat: m, punio: os, hol: .034, vuelo: .012 });
    k.anillo(pr, .93, .005, k.mat('secundario'), .002); k.anillo(pr, .95, .005, k.mat('secundario'), .002);
  });

  reg('arriba', 'bividi', 'Polo sin mangas (bividí)', 'Polos', ['principal', 'secundario'], { principal: '#F2F2F2', secundario: '#2F6FA8' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), m2 = k.mat('secundario');
    const pr = k.top({ mat: m, desde: .485, hol: .02, ens: .025 });
    k.anillo(pr, .492, .008, m2);
    ctx.H.cuello('redondo', m, m2);
    k.sisa(m2);
  });

  reg('arriba', 'polo_manga_larga', 'Polo manga larga', 'Polos', ['principal', 'secundario'], { principal: '#7B4B94', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), os = k.osc('principal', .86);
    const pr = k.top({ mat: m, desde: .485 });
    k.anillo(pr, .492, .008, os);
    ctx.H.cuello('redondo', m, k.mat('secundario'));
    k.mangas({ largo: .4, mat: m, punio: os });
  });

  // ---------- Camisas ----------
  reg('arriba', 'camisa_vestir', 'Camisa', 'Camisas', ['principal', 'secundario', 'acento'], { principal: '#DCE8F5', secundario: '#FFFFFF', acento: '#C9B79A' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .75 }), m2 = k.mat('secundario'), mb = k.mat('acento', { roughness: .3 });
    const pr = k.top({ mat: m, desde: .485, hol: .02, ens: .026 });
    k.anillo(pr, .495, .006, k.osc('principal', .93));
    k.placa(pr, .5, 1.08, .03, k.osc('principal', .94), 0, .003);
    k.botones(pr, [.56, .66, .76, .86, .96, 1.04], mb, 0, .008);
    k.solapas(pr, m2, m2);
    k.bolsillo(pr, .9, .55, .06, .066, k.osc('principal', .95));
    k.mangas({ largo: .4, mat: m, punio: m2 });
    for (let i = 0; i < 2; i++) k.esf(.007, mb, 0, -.14, i ? .061 : -.061, ctx.partes.codos[i], 1, 1, .5, 8);
  });

  reg('arriba', 'camisa_cuadros', 'Camisa a cuadros (leñador)', 'Camisas', ['principal', 'secundario', 'acento'], { principal: '#B3261E', secundario: '#1E1E24', acento: '#E8D9B5' }, (ctx) => {
    const k = kit(ctx), c1 = k.col('principal'), c2 = k.col('secundario'), c3 = k.col('acento');
    const m = k.mt(k.tex(128, 128, dib.cuadros(c1, c2, c3), [7, 3.5])), mb = k.mat('acento', { roughness: .4 }), os = k.osc('secundario', 1);
    const pr = k.top({ mat: m, desde: .485, hol: .022, ens: .03 });
    k.anillo(pr, .495, .007, os);
    k.placa(pr, .5, 1.08, .028, k.osc('secundario', 1), 0, .003);
    k.botones(pr, [.56, .66, .76, .86, .96, 1.04], mb, 0, .008);
    k.solapas(pr, m, os);
    for (const a of [.55, -.55]) k.bolsillo(pr, .9, a, .062, .07, m, os, mb);
    k.mangas({ largo: .31, mat: m, punio: os, vuelo: .004 });
  });

  reg('arriba', 'blusa', 'Blusa', 'Camisas', ['principal', 'secundario', 'acento'], { principal: '#F5D7DC', secundario: '#FFFFFF', acento: NARANJA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .7 }), m2 = k.mat('secundario', { roughness: .6 }), ma = k.mat('acento');
    const pr = k.top({ mat: m, desde: .5, hol: .02, ens: .07 });
    for (const [y, t] of [[.508, .012], [.53, .009]]) k.anillo(pr, y, t, m2, .002);
    k.anillo(pr, .72, .007, ma, .002);
    k.botones(pr, [.78, .86, .94, 1.02], m2, 0, .007);
    ctx.H.cuello('redondo', m, m2);
    // lazo al cuello
    const y = 1.07, p = pr.pt(y, 0, .014);
    for (const s of [-1, 1]) { const a = k.esf(.026, ma, p.x + s * .03, y - .018, p.z, ctx.partes.cuerpo, 1.1, .7, .5, 10); a.rotation.z = s * .5; }
    k.esf(.013, ma, p.x, y - .018, p.z + .004, ctx.partes.cuerpo, 1, 1, .8, 10);
    k.mangas({ largo: .1, mat: m, punio: m2, bufa: .03, hol: .02 });
  });

  reg('arriba', 'guayabera', 'Guayabera', 'Camisas', ['principal', 'secundario'], { principal: '#EDE3CC', secundario: '#C9B79A' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .85 }), m2 = k.mat('secundario');
    const pr = k.top({ mat: m, desde: .475, hol: .02, ens: .03 });
    k.anillo(pr, .485, .007, m2);
    k.placa(pr, .5, 1.08, .03, m2, 0, .003);
    k.botones(pr, [.56, .68, .8, .92, 1.03], k.mat('principal', { roughness: .3 }), 0, .008);
    for (const a of [.24, -.24, .3, -.3]) k.placa(pr, .52, 1.04, .006, m2, a, .003);
    k.solapas(pr, m, m2);
    for (const [y, a] of [[.93, .62], [.93, -.62], [.64, .72], [.64, -.72]]) k.bolsillo(pr, y, a, .06, y > .8 ? .07 : .09, m, m2);
    k.mangas({ largo: .13, mat: m, punio: m2 });
  });

  // ---------- Chompas ----------
  reg('arriba', 'chompa_cuello_redondo', 'Chompa cuello redondo', 'Chompas', ['principal', 'secundario'], { principal: '#8C2F39', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), tx = k.tex(64, 64, dib.punto ? dib.punto(k.col('principal')) : dib.punto(k.col('principal')), [18, 10]);
    const m = k.mt(tx), rib = k.osc('principal', .8, { roughness: .95 });
    const pr = k.top({ mat: m, desde: .485, hol: .026, ens: .026 });
    k.anillo(pr, .5, .014, rib);
    ctx.H.cuello('redondo', rib, rib);
    k.aro(.085, .02, rib, 0, 1.1, 0, ctx.partes.cuerpo);
    k.mangas({ largo: .4, mat: m, punio: rib, hol: .022 });
  });

  reg('arriba', 'chompa_rombos', 'Chompa de rombos', 'Chompas', ['principal', 'secundario', 'acento'], { principal: '#3F5E8C', secundario: '#F0E0B8', acento: '#B23A48' }, (ctx) => {
    const k = kit(ctx), tx = k.tex(128, 128, dib.rombos(k.col('principal'), k.col('secundario'), k.col('acento')), [5, 3]);
    const m = k.mt(tx, { roughness: .95 }), rib = k.osc('principal', .8, { roughness: .95 });
    const pr = k.top({ mat: m, desde: .485, hol: .026, ens: .026 });
    k.anillo(pr, .5, .014, rib);
    k.aro(.088, .02, rib, 0, 1.1, 0, ctx.partes.cuerpo);
    const tx2 = k.tex(128, 128, dib.rombos(k.col('principal'), k.col('secundario'), k.col('acento')), [2.2, 1.6]);
    k.mangas({ largo: .4, mat: m, matM: k.mt(tx2, { roughness: .95 }), punio: rib, hol: .022 });
  });

  reg('arriba', 'chompa_navidena', 'Chompa navideña (renos y pinos)', 'Chompas', ['principal', 'secundario', 'acento'], { principal: '#C0282D', secundario: CREMA, acento: '#2E7D32' }, (ctx) => {
    const k = kit(ctx), c1 = k.col('principal'), c2 = k.col('secundario'), c3 = k.col('acento');
    const m = k.mt(k.tex(512, 512, dib.navidad(c1, c2, c3), [1, 1]), { roughness: .95 });
    const rib = k.mat('secundario', { roughness: .95 }), roj = k.osc('principal', .85, { roughness: .95 });
    const pr = k.top({ mat: m, desde: .485, hol: .026, ens: .026 });
    k.anillo(pr, .5, .015, rib);
    ctx.H.cuello('redondo', rib, rib);
    k.aro(.088, .02, rib, 0, 1.1, 0, ctx.partes.cuerpo);
    k.mangas({ largo: .4, mat: roj, punio: rib, hol: .022 });
    for (let i = 0; i < 2; i++) { // franja verde y blanca en las mangas
      const c = ctx.partes.codos[i];
      k.aro(.074, .006, k.mat('acento'), 0, -.04, 0, c); k.aro(.073, .004, rib, 0, -.065, 0, c);
    }
  });

  reg('arriba', 'cardigan_abierto', 'Cárdigan abierto', 'Chompas', ['principal', 'secundario', 'acento'], { principal: '#C9A27A', secundario: CREMA, acento: '#8A6544' }, (ctx) => {
    const k = kit(ctx), m = k.mt(k.tex(64, 64, dib.punto(k.col('principal')), [18, 10]), { roughness: .95 });
    const ms = k.mat('secundario', { roughness: .8 }), banda = k.mat('acento', { roughness: .95 });
    k.top({ mat: ms, desde: .5, hol: .017, ens: .012 });
    ctx.H.cuello('redondo', ms, ms);
    const g = .2, hol = .034, ens = .03;
    const pr = k.parcial({ mat: m, desde: .485, hasta: 1.09, hol, ens, fi0: g, fi1: PI * 2 - g });
    k.parcial({ mat: banda, desde: .485, hasta: 1.09, hol, ens, fi0: g, fi1: g + .09, e: .007 });
    k.parcial({ mat: banda, desde: .485, hasta: 1.09, hol, ens, fi0: PI * 2 - g - .09, fi1: PI * 2 - g, e: .007 });
    k.anillo(pr, 1.085, .014, banda, .002).scale.z = ESC;
    for (const a of [.75, -.75]) k.bolsillo(pr, .64, a, .07, .08, banda);
    k.mangas({ largo: .4, mat: m, punio: banda, hol: .03 });
  });

  // ---------- Cafarenas ----------
  const cafarena = (ctx, mangas) => {
    const k = kit(ctx), tx = k.tex(64, 64, dib.punto(k.col('principal')), [22, 10]);
    const m = k.mt(tx, { roughness: .9 }), rib = k.osc('principal', .82, { roughness: .95 });
    const pr = k.top({ mat: m, desde: .485, hol: .018, ens: .02 });
    k.anillo(pr, .494, .01, rib);
    ctx.H.cuello('alto', m);
    k.aro(.079, .013, rib, 0, 1.21, 0, ctx.partes.cuerpo); k.aro(.083, .01, rib, 0, 1.13, 0, ctx.partes.cuerpo);
    if (mangas) k.mangas({ largo: .4, mat: m, punio: rib, hol: .016 }); else k.sisa(rib);
  };
  reg('arriba', 'cafarena_manga_larga', 'Cafarena manga larga', 'Cafarenas', ['principal'], { principal: '#1E1E24' }, (ctx) => cafarena(ctx, true));
  reg('arriba', 'cafarena_sin_mangas', 'Cafarena sin mangas', 'Cafarenas', ['principal'], { principal: '#8C5A3C' }, (ctx) => cafarena(ctx, false));

  // ---------- Poleras ----------
  const capucha = (ctx, k, m) => {
    k.esf(1, m, 0, 1.1, -.1, ctx.partes.cuerpo, .125, .095, .09, 18);
    k.aro(.1, .032, m, 0, 1.115, -.005, ctx.partes.cuerpo).scale.set(1, .9, 1);
  };
  reg('arriba', 'polera_capucha', 'Polera con capucha', 'Poleras', ['principal', 'secundario'], { principal: '#6B7A8F', secundario: CREMA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .95 }), rib = k.osc('principal', .8, { roughness: .95 }), cor = k.mat('secundario');
    const pr = k.top({ mat: m, desde: .48, hol: .03, ens: .04 });
    k.anillo(pr, .495, .015, rib);
    capucha(ctx, k, m, rib);
    // bolsillo canguro
    const p = pr.pt(.64, 0, .006), g = new T.Group(); g.position.copy(p); g.rotation.x = pr.pitch(.64); ctx.partes.cuerpo.add(g);
    ctx.caja(.2, .1, .008, k.osc('principal', .92), 0, 0, 0, g);
    for (const s of [-1, 1]) k.linea(V(s * .1, .05, .006), V(s * .075, -.05, .006), .005, rib, g);
    // cordones
    for (const s of [-1, 1]) { const a = pr.pt(1.07, s * .17, .012), b = pr.pt(.86, s * .12, .012); k.linea(a, b, .004, cor); k.esf(.008, cor, b.x, b.y - .006, b.z, ctx.partes.cuerpo, 1, 1.8, 1, 8); }
    k.mangas({ largo: .4, mat: m, punio: rib, hol: .03 });
  });

  reg('arriba', 'polera_cierre', 'Polera con cierre', 'Poleras', ['principal', 'secundario', 'acento'], { principal: '#2F4F8F', secundario: CREMA, acento: '#C8C8D0' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .95 }), rib = k.osc('principal', .8, { roughness: .95 }), z = k.mat('acento', { metalness: .6, roughness: .35 });
    const pr = k.top({ mat: m, desde: .48, hol: .03, ens: .04 });
    k.anillo(pr, .495, .015, rib);
    capucha(ctx, k, m, rib);
    k.zip(pr, .5, 1.09, z, 0);
    for (const a of [.8, -.8]) k.linea(pr.pt(.72, a, .006), pr.pt(.58, a * .88, .006), .005, rib);
    for (const s of [-1, 1]) { const a = pr.pt(1.07, s * .17, .012), b = pr.pt(.9, s * .13, .012); k.linea(a, b, .004, k.mat('secundario')); }
    k.mangas({ largo: .4, mat: m, punio: rib, hol: .03 });
  });

  // ---------- Casacas ----------
  reg('arriba', 'casaca_jean', 'Casaca jean', 'Casacas', ['principal', 'secundario', 'acento'], { principal: '#4F6F98', secundario: '#D79A3C', acento: '#C8A24B' }, (ctx) => {
    const k = kit(ctx), c = k.col('principal');
    const m = k.mt(k.tex(64, 64, dib.denim(c), [6, 4])), md = k.osc('principal', .82), hilo = k.mat('secundario'), mb = k.mat('acento', { metalness: .6, roughness: .35 });
    const pr = k.top({ mat: m, desde: .485, hol: .026, ens: .03 });
    k.anillo(pr, .5, .016, md);
    k.anillo(pr, .95, .004, hilo, .003);
    k.placa(pr, .5, 1.08, .024, md, 0, .003);
    k.botones(pr, [.56, .68, .8, .92, 1.03], mb, 0, .01);
    for (const a of [.62, -.62]) { k.placa(pr, .52, .93, .004, hilo, a, .003); }
    for (const a of [.5, -.5]) k.bolsillo(pr, .88, a, .066, .07, md, md, mb);
    k.solapas(pr, md, md);
    k.mangas({ largo: .4, mat: m, punio: md });
    for (let i = 0; i < 2; i++) k.esf(.007, mb, 0, -.145, i ? .063 : -.063, ctx.partes.codos[i], 1, 1, .5, 8);
  });

  reg('arriba', 'casaca_cuero', 'Casaca de cuero', 'Casacas', ['principal', 'secundario'], { principal: '#1C1C20', secundario: '#A8A8B0' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .32, metalness: .08 }), z = k.mat('secundario', { metalness: .7, roughness: .3 }), os = k.osc('principal', .75, { roughness: .4 });
    const pr = k.top({ mat: m, desde: .49, hol: .026, ens: .016 });
    k.anillo(pr, .5, .014, os);
    // cierre diagonal (cruzado)
    k.linea(pr.pt(1.08, .06, .008), pr.pt(.52, .5, .008), .006, z);
    k.solapas(pr, m, m, 1, .5);
    for (const s of [-1, 1]) { const g = new T.Group(); const p = pr.pt(1.0, s * .55, .02); g.position.copy(p); g.rotation.set(-.2, s * .45, s * .5); ctx.partes.cuerpo.add(g); ctx.caja(.1, .2, .01, os, 0, 0, 0, g); }
    k.anillo(pr, .6, .012, os, .004);
    const p = pr.pt(.6, 0, .016); ctx.caja(.04, .028, .01, z, p.x, p.y, p.z, ctx.partes.cuerpo);
    for (const a of [.85, -.85]) { k.linea(pr.pt(.57, a - .07, .006), pr.pt(.57, a + .07, .006), .005, z); }
    for (const s of [-1, 1]) { const a = pr.pt(1.06, s * .75, .012), b = pr.pt(1.07, s * 1.1, .012); k.linea(a, b, .01, os); }
    k.mangas({ largo: .4, mat: m, punio: os });
    for (let i = 0; i < 2; i++) k.linea(V(-.034, -.14, .05), V(.034, -.14, .05), .004, z, ctx.partes.codos[i]);
  });

  reg('arriba', 'casaca_deportiva', 'Casaca deportiva', 'Casacas', ['principal', 'secundario', 'acento'], { principal: '#C0282D', secundario: '#FFFFFF', acento: '#1E1E24' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .55 }), s2 = k.mat('secundario', { roughness: .5 }), a = k.mat('acento', { roughness: .5 });
    const pr = k.top({ mat: m, desde: .485, hol: .024, ens: .028 });
    k.anillo(pr, .495, .014, a);
    for (const ang of [1.15, -1.15]) { k.placa(pr, .52, 1.06, .028, s2, ang, .003); k.placa(pr, .52, 1.06, .008, s2, ang + (ang > 0 ? .16 : -.16), .003); }
    ctx.H.cuello('alto', m);
    k.aro(.08, .012, a, 0, 1.21, 0, ctx.partes.cuerpo);
    k.zip(pr, .5, 1.1, s2, 0, a);
    for (const ang of [.58, -.58]) k.linea(pr.pt(.6, ang, .006), pr.pt(.52, ang * .9, .006), .005, a);
    k.mangas({ largo: .4, mat: m, punio: a });
    for (let i = 0; i < 2; i++) { // franja lateral por la manga
      const h = ctx.partes.brazos[i], c = ctx.partes.codos[i], sx = i ? 1 : -1;
      k.linea(V(sx * .0, 0, .076), V(0, -.22, .076), .007, s2, h); k.linea(V(0, 0, .072), V(0, -.17, .066), .007, s2, c);
    }
  });

  reg('arriba', 'chaleco_acolchado', 'Chaleco acolchado', 'Casacas', ['principal', 'secundario'], { principal: '#2E5E4A', secundario: '#1E1E24' }, (ctx) => {
    const k = kit(ctx), m = k.mt(k.tex(64, 64, dib.acolchado(k.col('principal')), [12, 6]), { roughness: .55 }), a = k.mat('secundario', { roughness: .5 }), z = k.mat('secundario', { metalness: .5, roughness: .4 });
    const pr = k.top({ mat: m, desde: .49, hol: .034, ens: .016 });
    k.anillo(pr, .5, .014, a);
    ctx.H.cuello('alto', m);
    k.aro(.08, .012, a, 0, 1.21, 0, ctx.partes.cuerpo);
    k.zip(pr, .5, 1.1, z, 0, a);
    for (const ang of [.62, -.62]) k.linea(pr.pt(.7, ang, .008), pr.pt(.6, ang * .95, .008), .006, a);
    k.sisa(a);
  });

  reg('arriba', 'abrigo_largo', 'Abrigo largo', 'Casacas', ['principal', 'secundario', 'acento'], { principal: '#8A6544', secundario: '#5E4128', acento: '#C9A24B' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .9 }), m2 = k.mat('secundario', { roughness: .85 }), mb = k.mat('acento', { metalness: .6, roughness: .3 });
    const pr = k.top({ mat: m, desde: .56, hol: .028, ens: 0 });
    const dY = .64, lg = .5, vu = .1;
    ctx.H.falda({ desdeY: dY, largo: lg, vuelo: vu, mat: m });
    const r0 = ctx.H.radioTorso(dY) + MED.holgura;
    const fr = (y) => r0 + vu * Math.pow((dY - y) / lg, .85);
    const fp = (y, ang, e = .004) => V(Math.sin(ang) * (fr(y) + e) * k.an, y, Math.cos(ang) * (fr(y) + e) * .9);
    k.aro(r0 + .004, .016, m2, 0, dY, 0, ctx.partes.cuerpo, k.an, .9);   // cinturón
    k.aro(fr(dY - lg) + .003, .012, m2, 0, dY - lg, 0, ctx.partes.cuerpo, k.an, .9);   // basta
    const bp = fp(dY, 0, .016); ctx.caja(.05, .035, .01, mb, bp.x, bp.y, bp.z, ctx.partes.cuerpo);
    // botonadura cruzada y solapas
    for (const a of [.13, -.13]) for (const y of [.7, .8, .9, 1.0]) k.boton(pr, y, a, mb, .011);
    for (const a of [.13, -.13]) for (const y of [.56, .47, .38]) { const p = fp(y, a, .008), b = k.esf(.011, mb, p.x, p.y, p.z, ctx.partes.cuerpo, 1, 1, .5, 10); b.rotation.x = .1; }
    for (const s of [-1, 1]) { const g = new T.Group(); const p = pr.pt(.99, s * .24, .018); g.position.copy(p); g.rotation.set(-.15, s * .3, s * .42); ctx.partes.cuerpo.add(g); ctx.caja(.1, .22, .012, m2, 0, 0, 0, g); }
    k.solapas(pr, m2, m2, 1, .5);
    for (const a of [.55, -.55]) { const p = fp(.5, a, .006), b = ctx.caja(.07, .02, .01, m2, p.x, p.y, p.z, ctx.partes.cuerpo); b.rotation.y = a; }
    k.mangas({ largo: .4, mat: m, punio: m2, hol: .028 });
  });

  // ---------- Vestidos ----------
    reg('arriba', 'vestido_corto', 'Vestido corto', 'Vestidos', ['principal', 'secundario'], { principal: '#E8A0B0', secundario: '#FFFFFF' }, (ctx) => {
    const k = kit(ctx), tx = k.tex(64, 64, dib.puntos(k.col('principal'), k.col('secundario')), [10, 4]);
    const m = k.mt(tx, { roughness: .7 }), m2 = k.mat('secundario', { roughness: .6 });
    const pr = k.top({ mat: m, desde: .62, hol: .02, ens: 0 });
    const dY = .7;
    ctx.H.falda({ desdeY: dY, largo: .3, vuelo: .13, mat: m });
    const r0 = ctx.H.radioTorso(dY) + MED.holgura;
    k.aro(r0 + .003, .012, m2, 0, dY, 0, ctx.partes.cuerpo, k.an, .9);
    k.aro(r0 + .13 + .003, .008, m2, 0, dY - .3, 0, ctx.partes.cuerpo, k.an, .9);
    k.escote(pr, k.col('secundario'));
    k.mangas({ largo: .05, mat: m, punio: null, hol: .018 });
  }, { cubreAbajo: true });

  reg('arriba', 'vestido_largo', 'Vestido largo', 'Vestidos', ['principal', 'secundario'], { principal: '#6B2F5E', secundario: '#C9A24B' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .32, metalness: .12 }), m2 = k.mat('secundario', { metalness: .5, roughness: .35 });
    const pr = k.top({ mat: m, desde: .62, hol: .02, ens: 0 });
    const dY = .7, lg = .55;
    ctx.H.falda({ desdeY: dY, largo: lg, vuelo: .16, mat: m, pliegues: 10 });
    const r0 = ctx.H.radioTorso(dY) + MED.holgura;
    k.aro(r0 + .004, .015, m2, 0, dY, 0, ctx.partes.cuerpo, k.an, .9);
    k.aro(r0 + .16 + .006, .008, m2, 0, dY - lg, 0, ctx.partes.cuerpo, k.an, .9);
    k.vcuello(pr, k.col('secundario'));
    const p = pr.pt(dY, 0, .02), cb = ctx.partes.cuerpo; // broche de la cintura
    k.esf(.018, m2, p.x, p.y, p.z, cb, 1, 1, .6, 12);
    k.mangas({ largo: .32, mat: m, punio: m2, hol: .018 });
  }, { cubreAbajo: true });

  reg('arriba', 'vestido_fiesta', 'Vestido de fiesta (falda amplia)', 'Vestidos', ['principal', 'secundario', 'acento'], { principal: '#C0286E', secundario: '#F6D6E8', acento: '#F2D27A' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .28, metalness: .15 }), tul = k.mat('secundario', { roughness: .7 }), br = k.mat('acento', { metalness: .6, roughness: .25, emissive: new T.Color(k.col('acento')), emissiveIntensity: .25 });
    const cb = ctx.partes.cuerpo;
    const pr = k.top({ mat: m, desde: .62, hol: .02, ens: 0 });
    const dY = .7;
    ctx.H.falda({ desdeY: dY, largo: .42, vuelo: .32, mat: m });
    ctx.H.falda({ desdeY: dY + .005, largo: .32, vuelo: .27, mat: tul, pliegues: 14 });
    const r0 = ctx.H.radioTorso(dY) + MED.holgura;
    k.aro(r0 + .004, .02, br, 0, dY + .005, 0, cb, k.an, .9);
    k.aro(r0 + .32 + .004, .008, m, 0, dY - .42, 0, cb, k.an, .9);
    k.escote(pr, k.col('acento'), 1.1);
    // lazo de la cintura (atrás)
    const pb = V(0, dY + .005, -(r0 + .03) * .9);
    for (const s of [-1, 1]) { const a = k.esf(.04, br, s * .045, pb.y - .015, pb.z - .01, cb, 1.2, .8, .5, 10); a.rotation.z = s * .45; }
    k.esf(.02, br, 0, pb.y, pb.z - .015, cb, 1, 1, .8, 10);
    // brillos en el corpiño
    const r = rng(5);
    for (let n = 0; n < 16; n++) { const y = .72 + r() * .3, a = (r() - .5) * 2.4, p = pr.pt(y, a, .008); k.esf(.006, br, p.x, p.y, p.z, cb, 1, 1, 1, 6); }
    k.mangas({ largo: .06, mat: m, punio: br, hol: .02, bufa: .03 });
  }, { cubreAbajo: true });

  // ---------- Deporte ----------
  reg('arriba', 'camiseta_futbol', 'Camiseta de fútbol con número', 'Deporte', ['principal', 'secundario', 'acento'], { principal: '#FFFFFF', secundario: '#D91023', acento: '#D91023' }, (ctx) => {
    const k = kit(ctx), c2 = k.col('secundario'), m = k.mat('principal', { roughness: .6 }), m2 = k.mat('secundario'), ma = k.mat('acento');
    const pr = k.top({ mat: m, desde: .485, hol: .022, ens: .03 });
    k.anillo(pr, .492, .008, ma);
    k.vcuello(pr, k.col('acento'));
    k.mangas({ largo: .13, mat: m, punio: ma });
    const faja = texTexto(k, (g, W, Hh) => { g.strokeStyle = c2; g.lineWidth = 78; g.beginPath(); g.moveTo(-30, Hh + 30); g.lineTo(W + 30, -30); g.stroke(); });
    k.parche(pr, { y0: .56, y1: 1.07, centro: 0, mitad: 1.45, tex: faja, e: .005, seg: 40 });
    const num = texTexto(k, (g, W, Hh) => { g.fillStyle = c2; g.font = '900 190px Impact, "Arial Black", sans-serif'; g.fillText('10', W / 2, Hh * .5); });
    k.parche(pr, { y0: .62, y1: .96, centro: PI, mitad: .5, tex: num, e: .005 });
    const nom = texTexto(k, (g, W, Hh) => { g.fillStyle = c2; g.font = '800 54px Impact, "Arial Black", sans-serif'; g.fillText('CAPRICHOS', W / 2, Hh * .5); }, 512, 64);
    k.parche(pr, { y0: .975, y1: 1.04, centro: PI, mitad: .6, tex: nom, e: .005 });
    const esc = texTexto(k, (g, W, Hh) => { g.fillStyle = '#FFF'; g.strokeStyle = c2; g.lineWidth = 12; g.beginPath(); g.arc(W / 2, Hh / 2, 90, 0, PI * 2); g.fill(); g.stroke(); g.fillStyle = NARANJA; g.font = '900 110px Georgia, serif'; g.fillText('C', W / 2, Hh * .52); });
    k.parche(pr, { y0: .92, y1: .98, centro: .72, mitad: .15, tex: esc, e: .006 });
  });

  reg('arriba', 'top_deportivo', 'Top deportivo', 'Deporte', ['principal', 'secundario'], { principal: NARANJA, secundario: '#1E1E24' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .5 }), m2 = k.mat('secundario', { roughness: .5 });
    const pr = k.top({ mat: m, desde: .8, hol: .018, ens: 0 });
    k.anillo(pr, .81, .014, m2);
    k.anillo(pr, .95, .006, m2, .002);
    ctx.H.cuello('redondo', m, m2);
    k.sisa(m2);
    const p = pr.pt(.92, 0, .006); const c = ctx.caja(.02, .06, .006, m2, p.x, p.y, p.z, ctx.partes.cuerpo); c.rotation.x = pr.pitch(.92);
  });

  /* =================================================================
   * ABAJO
   * ================================================================= */
  reg('abajo', 'pantalon_vestir', 'Pantalón de vestir', 'Pantalones', ['principal', 'secundario'], { principal: '#4A4F5C', secundario: '#2A1A12' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .85 }), bt = k.osc('principal', .8), cinto = k.mat('secundario', { roughness: .4 });
    const pa = k.pantalon({ mat: m, largo: .475, hol: .016, vuelo: .004 });
    k.aro(.17, .012, cinto, 0, .665, 0, ctx.partes.cuerpo, k.an * 1.0, ESC);
    for (let i = 0; i < 2; i++) { pa.linea(i, .02, .475, 0, bt, .003); pa.linea(i, .03, .26, i ? -PI / 2 : PI / 2, bt, .0025); pa.anillo(i, .475, .02, bt, .003); }
  });

  const denimPant = (id, nombre, roto, def) => reg('abajo', id, nombre, 'Pantalones', ['principal', 'secundario'], def, (ctx) => {
    const k = kit(ctx), c = k.col('principal');
    const m = k.mt(k.tex(64, 64, dib.denim(c), [6, 4])), md = k.osc('principal', .8), hilo = k.mat('secundario');
    const pa = k.pantalon({ mat: m, largo: .475, hol: .016, vuelo: .006 });
    k.aro(.17, .01, md, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) {
      const s = pa.legs[i].s;
      pa.linea(i, .0, .475, s * PI / 2, hilo, .0026); pa.linea(i, .0, .475, s * PI / 2 + s * .12, hilo, .0022);
      pa.linea(i, .02, .26, 0, md, .0025);
      pa.anillo(i, .475, .03, k.osc('principal', roto ? 1.1 : .9), .005);
      if (roto) { // roturas con hilos en rodilla y muslo
        const piel = ctx.M(ctx.c.piel, { roughness: .55 }), rod = ctx.partes.rodillas[i], sx = i ? 1 : -1;
        const h = k.esf(.04, piel, sx * .006, -.025, .088, rod, 1, .75, .16, 12);
        for (let t = 0; t < 4; t++) { const hl = k.caja(.07, .0035, .0035, ctx.M('#EDEDED'), sx * .006, -.025 + (t - 1.5) * .0125, .097, rod); hl.rotation.z = (t % 2 ? .05 : -.04); }
        const a = pa.at(i, .17, i ? .5 : -.5, .001), pm = ctx.M(ctx.c.piel, { roughness: .55 });
        const hm = k.esf(.026, pm, a.v.x, a.v.y, a.v.z, a.g, 1, 1.2, .2, 10); hm.rotation.y = i ? .5 : -.5;
        for (let t = 0; t < 3; t++) { const hl = k.caja(.045, .003, .003, ctx.M('#EDEDED'), a.v.x, a.v.y + (t - 1) * .014, a.v.z + .003, a.g); hl.rotation.y = i ? .5 : -.5; }
      }
    }
  });
  denimPant('jean', 'Jean', false, { principal: '#34507A', secundario: '#D79A3C' });
  denimPant('jean_roto', 'Jean roto', true, { principal: '#5B7FB0', secundario: '#E8E8E8' });

  reg('abajo', 'jogger_buzo', 'Jogger / buzo', 'Pantalones', ['principal', 'secundario'], { principal: '#5E6470', secundario: '#F6EBDD' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .95 }), rib = k.osc('principal', .8, { roughness: .95 }), fr = k.mat('secundario');
    const pa = k.pantalon({ mat: m, largo: .475, hol: .016, bolsa: .018, vuelo: -.0 });
    k.aro(.17, .012, rib, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { pa.anillo(i, .475, .045, rib, .004); pa.linea(i, .0, .43, pa.legs[i].s * PI / 2, fr, .005, .003); }
    for (const s of [-1, 1]) { const a = V(s * .03, .64, ESC * (ctx.H.radioTorso(.64) + .03)); k.linea(V(s * .02, .665, .16), V(s * .03, .56, .165), .0035, fr); }
  });

  reg('abajo', 'pantalon_cargo', 'Pantalón cargo', 'Pantalones', ['principal', 'secundario'], { principal: '#7A7355', secundario: '#5E5A42' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .9 }), m2 = k.mat('secundario', { roughness: .9 }), mb = k.mat('secundario', { metalness: .4 });
    const pa = k.pantalon({ mat: m, largo: .475, hol: .016, bolsa: .008, vuelo: .006 });
    k.aro(.17, .01, m2, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) {
      const s = pa.legs[i].s;
      pa.bolsillo(i, .12, s * .95, .07, .09, m2, m2, mb);
      pa.bolsillo(i, .36, s * .9, .055, .07, m2, m2, mb);
      pa.linea(i, .0, .475, s * PI / 2, m2, .003); pa.linea(i, .02, .475, s * PI / 2 - s * .3, m2, .0022);
      pa.anillo(i, .475, .025, m2, .004);
    }
  });

  reg('abajo', 'bermuda', 'Bermuda', 'Cortos', ['principal', 'secundario'], { principal: '#B79A6A', secundario: '#8A7048' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .9 }), m2 = k.mat('secundario', { roughness: .9 }), mb = k.mat('secundario', { metalness: .4 });
    const pa = k.pantalon({ mat: m, largo: .35, hol: .016, vuelo: .012, bolsa: .004 });
    k.aro(.17, .01, m2, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { const s = pa.legs[i].s; pa.anillo(i, .35, .035, m2, .004); pa.bolsillo(i, .14, s * .9, .06, .07, m2, m2, mb); pa.linea(i, 0, .33, s * PI / 2, m2, .003); }
  });

  reg('abajo', 'short', 'Short', 'Cortos', ['principal', 'secundario'], { principal: '#2F6FA8', secundario: '#F6EBDD' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .8 }), m2 = k.mat('secundario');
    const pa = k.pantalon({ mat: m, largo: .15, hol: .016, vuelo: .014 });
    k.aro(.17, .012, m2, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { pa.anillo(i, .15, .022, m2, .004); pa.linea(i, 0, .13, pa.legs[i].s * PI / 2, m2, .0035); }
  });

  reg('abajo', 'short_jean', 'Short jean', 'Cortos', ['principal', 'secundario'], { principal: '#5B7FB0', secundario: '#F2F2F2' }, (ctx) => {
    const k = kit(ctx), c = k.col('principal');
    const m = k.mt(k.tex(64, 64, dib.denim(c), [6, 2])), md = k.osc('principal', .85), fl = k.mat('secundario', { roughness: 1 });
    const pa = k.pantalon({ mat: m, largo: .13, hol: .016, vuelo: .006 });
    k.aro(.17, .01, md, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { pa.anillo(i, .13, .014, fl, .002); pa.linea(i, 0, .11, pa.legs[i].s * PI / 2, k.mat('secundario'), .0022); }
  });

  /* ---- faldas ---- */
  const falda = (id, nombre, o, extra) => reg('abajo', id, nombre, 'Faldas', ['principal', 'secundario'], o.def, (ctx) => {
    const k = kit(ctx), cb = ctx.partes.cuerpo;
    const m = o.tex ? k.mt(o.tex(k), { roughness: .85 }) : k.mat('principal', { roughness: .8 }), m2 = k.mat('secundario');
    ctx.H.falda({ desdeY: o.dY, largo: o.largo, vuelo: o.vuelo, mat: m, pliegues: o.pliegues || 0 });
    const r0 = ctx.H.radioTorso(o.dY) + MED.holgura;
    k.aro(r0 + .004, .014, m2, 0, o.dY + .005, 0, cb, k.an, .9);
    k.aro(r0 + o.vuelo + .004, o.hem || .008, m2, 0, o.dY - o.largo, 0, cb, k.an, .9);
    if (extra) extra(k, ctx, r0);
  });
  falda('falda_corta', 'Falda corta', { dY: .66, largo: .2, vuelo: .09, def: { principal: '#C0286E', secundario: '#F6EBDD' }, hem: .007 }, (k, ctx, r0) => {
    for (const a of [.4, -.4]) k.linea(V(Math.sin(a) * (r0 + .002) * k.an, .66, Math.cos(a) * (r0 + .002) * .9), V(Math.sin(a) * (r0 + .09) * k.an, .46, Math.cos(a) * (r0 + .09) * .9), .003, k.mat('secundario'));
  });
  falda('falda_tableada', 'Falda tableada (escocesa)', { dY: .67, largo: .26, vuelo: .14, pliegues: 24, def: { principal: '#2F4F8F', secundario: '#F6EBDD' }, hem: .007, tex: (k) => k.tex(128, 128, dib.cuadros(k.col('principal'), k.tone ? k.tone : A.tono(k.col('principal'), .5), k.col('secundario')), [8, 2.4]) });
  falda('falda_larga', 'Falda larga', { dY: .66, largo: .5, vuelo: .2, pliegues: 8, def: { principal: '#7A4E8C', secundario: '#E8C86A' }, hem: .012 }, (k, ctx, r0) => {
    k.aro(r0 + .2 + .004, .006, k.mat('secundario'), 0, .185, 0, ctx.partes.cuerpo, k.an, .9);
  });

  reg('abajo', 'leggings', 'Leggings', 'Pantalones', ['principal', 'secundario'], { principal: '#1E1E24', secundario: NARANJA }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .35 }), m2 = k.mat('secundario');
    const pa = k.pantalon({ mat: m, largo: .475, hol: .014, bolsa: -.006 });
    k.aro(.168, .012, m2, 0, .685, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { pa.linea(i, .02, .475, pa.legs[i].s * PI / 2, m2, .005, .002); pa.anillo(i, .475, .014, k.osc('principal', .8), .002); }
  });

  reg('abajo', 'pantalon_campana', 'Pantalón campana', 'Pantalones', ['principal', 'secundario'], { principal: '#6B3F58', secundario: '#E8C86A' }, (ctx) => {
    const k = kit(ctx), m = k.mat('principal', { roughness: .85 }), m2 = k.mat('secundario', { roughness: .4 }), bt = k.osc('principal', .8);
    const pa = k.pantalon({ mat: m, largo: .475, hol: .016, vuelo: .05 });
    k.aro(.17, .012, m2, 0, .67, 0, ctx.partes.cuerpo, k.an, ESC);
    for (let i = 0; i < 2; i++) { pa.anillo(i, .475, .02, bt, .004); pa.linea(i, .03, .475, 0, bt, .003); }
  });

  /* =================================================================
   * CALZADO
   * ================================================================= */
  const FOOT_Y = -.265;       // base de la suela (el pie descalzo queda en -.268..-.202)
  /** Elipsoide del empeine: devuelve el y de su superficie en (x, z). */
  const sup = (U, x, z) => { const t = 1 - (x / U.rx) ** 2 - ((z - U.cz) / U.rz) ** 2; return t > 0 ? U.cy + U.ry * Math.sqrt(t) : U.cy; };

  function zapato(ctx, i, o) {
    const k = kit(ctx), r = ctx.partes.rodillas[i];
    const sH = o.sH || .022, sTop = FOOT_Y + sH;
    const mat = o.mat, matS = o.matS;
    const U = { cx: 0, rx: o.rx || .07, ry: o.hU || .042, rz: o.rz || .118, cz: o.cz == null ? .042 : o.cz, cy: -.225 + (o.elev || 0) };
    // suela
    const sue = k.cil(1, 1, sH, matS, 0, FOOT_Y + sH / 2, .04, r, 28); sue.scale.set(U.rx + .004, 1, (o.sz || .126));
    // empeine
    if (!o.sinEmpeine) k.esf(1, mat, 0, U.cy, U.cz, r, U.rx, U.ry, U.rz, 22);
    // caña / cuello del pie
    const alto = o.alto || 0, rs = o.rs || .073;
    if (!o.sinCana) {
      const h = .035 + alto, topY = -.195 + alto;
      k.cil(rs + (alto > .05 ? .006 : .002), rs, h, o.matC || mat, 0, topY - h / 2, 0, r, 22);
      if (o.borde) k.aro(rs + (alto > .05 ? .006 : .002), o.bordeG || .009, o.borde, 0, topY, 0, r);
    }
    return { k, r, U, sTop, sH, topY: -.195 + alto, rs };
  }
  const regCalzado = (id, nombre, grupo, colores, def, fn) => reg('calzado', id, nombre, grupo, colores, def, (ctx) => { for (let i = 0; i < 2; i++) fn(ctx, i); });
  /** Cordones cruzados sobre el empeine entre z0 y z1. */
  const cordones = (k, r, U, mat, z0, z1, n, ancho = .05) => {
    for (let j = 0; j < n; j++) {
      const zz = z0 + (z1 - z0) * j / (n - 1), y = sup(U, 0, zz) + .004, dy = (sup(U, 0, zz + .01) - sup(U, 0, zz - .01)) / .02;
      const b = k.caja(ancho, .006, .008, mat, 0, y, zz, r); b.rotation.set(-Math.atan(dy), (j % 2 ? .4 : -.4), 0, 'YXZ');
    }
  };

  regCalzado('zapatilla_urbana', 'Zapatillas urbanas', 'Zapatillas', ['principal', 'secundario', 'acento'], { principal: '#2E5E8C', secundario: '#FFFFFF', acento: NARANJA }, (ctx, i) => {
    const k0 = kit(ctx), mat = ctx.mat('principal', { roughness: .7 }), blanco = ctx.mat('secundario', { roughness: .55 }), ac = ctx.mat('acento');
    const z = zapato(ctx, i, { mat, matS: blanco, sH: .03, elev: .006, borde: blanco });
    const { k, r, U } = z;
    k.esf(1, blanco, 0, -.232, .128, r, .062, .04, .06, 14);              // puntera de goma
    k.esf(1, blanco, 0, -.226, -.052, r, .066, .042, .04, 12);             // talonera
    const s = k.cil(1, 1, .006, ac, 0, FOOT_Y + .016, .04, r, 28); s.scale.set(U.rx + .0055, 1, .1275);  // franja de la suela
    cordones(k, r, U, ac, .02, .125, 5);
    k.esf(1, mat, 0, sup(U, 0, .04) + .006, .04, r, .03, .012, .045, 10);   // lengüeta
    for (const sx of [-1, 1]) k.linea(V(sx * .066, -.205, 0), V(sx * .06, -.236, .095), .006, ac, r);
  });

  regCalzado('zapatilla_bota_alta', 'Zapatillas de bota alta', 'Zapatillas', ['principal', 'secundario', 'acento'], { principal: '#1E1E24', secundario: '#FFFFFF', acento: '#D91023' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .85 }), blanco = ctx.mat('secundario', { roughness: .55 }), ac = ctx.mat('acento');
    const z = zapato(ctx, i, { mat, matS: blanco, sH: .028, elev: .004, alto: .1, rs: .073, borde: blanco, bordeG: .008 });
    const { k, r, U } = z;
    k.esf(1, blanco, 0, -.232, .13, r, .064, .042, .062, 14);
    k.esf(1, blanco, 0, -.226, -.052, r, .066, .042, .04, 12);
    const s = k.cil(1, 1, .006, ac, 0, FOOT_Y + .014, .04, r, 28); s.scale.set(U.rx + .0055, 1, .1275);
    cordones(k, r, U, blanco, .03, .125, 4);
    for (let j = 0; j < 5; j++) { const y = -.19 + j * .02, b = k.caja(.05, .006, .007, blanco, 0, y, .074 - j * .0008, r); b.rotation.set(-.12, j % 2 ? .4 : -.4, 0, 'YXZ'); }
    for (const sx of [-1, 1]) { const c = k.cil(.02, .02, .004, blanco, sx * .0735, -.15, 0, r, 16); c.rotation.z = PI / 2; const e = k.cil(.011, .011, .005, ac, sx * .0755, -.15, 0, r, 12); e.rotation.z = PI / 2; }
  });

  regCalzado('zapato_vestir', 'Zapatos de vestir', 'Zapatos', ['principal', 'secundario'], { principal: '#2A1A12', secundario: '#14100E' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .22, metalness: .08 }), suela = ctx.mat('secundario', { roughness: .6 });
    const z = zapato(ctx, i, { mat, matS: suela, sH: .014, hU: .04, rz: .124 });
    const { k, r, U } = z;
    k.cil(1, 1, .004, ctx.mat('secundario'), 0, FOOT_Y + .015, .04, r, 28).scale.set(U.rx + .001, 1, .1245);
    const hb = k.caja(.062, .028, .062, suela, 0, FOOT_Y + .014 + .0, -.035, r); hb.position.y = FOOT_Y + .012;
    k.esf(1, mat, 0, -.222, .13, r, .06, .038, .05, 14);
    cordones(k, r, U, ctx.mat('principal', { roughness: .4 }), .03, .09, 3, .046);
    k.linea(V(-.056, -.216, .105), V(.056, -.216, .105), .0028, ctx.M('#0A0705'), r);
  });

  regCalzado('botas', 'Botas', 'Botas', ['principal', 'secundario', 'acento'], { principal: '#6B4423', secundario: '#2A1A12', acento: '#C9A24B' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .5 }), suela = ctx.mat('secundario', { roughness: .7 }), mb = ctx.mat('acento', { metalness: .7, roughness: .3 });
    const z = zapato(ctx, i, { mat, matS: suela, sH: .018, alto: .16, rs: .075, borde: ctx.mat('principal', { roughness: .6 }), bordeG: .01 });
    const { k, r } = z;
    k.caja(.07, .036, .07, suela, 0, FOOT_Y + .018, -.035, r);
    k.esf(1, ctx.mat('principal', { roughness: .6 }), 0, -.23, .125, r, .06, .036, .05, 14);
    k.aro(.081, .008, ctx.mat('secundario', { roughness: .6 }), 0, -.11, 0, r);
    k.caja(.026, .022, .008, mb, 0, -.11, .084, r);
    k.aro(.076, .004, suela, 0, -.07, 0, r);
  });

  regCalzado('botas_vaquero', 'Botas de vaquero', 'Botas', ['principal', 'secundario', 'acento'], { principal: '#8A5A2B', secundario: '#4A2C14', acento: '#F2D27A' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .45 }), suela = ctx.mat('secundario', { roughness: .7 }), ac = ctx.mat('acento', { roughness: .4 });
    const z = zapato(ctx, i, { mat, matS: suela, sH: .016, alto: .17, rs: .074, rz: .108, cz: .03, borde: suela, bordeG: .012 });
    const { k, r } = z;
    const cono = k.cil(.006, .05, .1, mat, 0, -.233, .16, r, 14); cono.rotation.x = PI / 2;   // punta
    k.caja(.07, .042, .06, suela, 0, FOOT_Y + .021, -.04, r).rotation.x = .12;
    for (const sx of [-1, 1]) {
      k.linea(V(sx * .01, -.18, .077), V(sx * .03, -.1, .075), .0028, ac, r); k.linea(V(sx * .03, -.1, .075), V(0, -.06, .082), .0028, ac, r);
      k.linea(V(sx * .045, -.2, .06), V(sx * .052, -.12, .054), .0028, ac, r);
    }
    k.linea(V(-.04, -.205, .125), V(0, -.19, .15), .003, ac, r); k.linea(V(.04, -.205, .125), V(0, -.19, .15), .003, ac, r);
  });

  regCalzado('botin', 'Botines', 'Botas', ['principal', 'secundario', 'acento'], { principal: '#3A2A22', secundario: '#1E1E24', acento: '#C9A24B' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .4 }), suela = ctx.mat('secundario', { roughness: .7 }), el = ctx.mat('secundario', { roughness: .9 });
    const z = zapato(ctx, i, { mat, matS: suela, sH: .018, alto: .055, rs: .074, borde: mat, bordeG: .008 });
    const { k, r } = z;
    k.caja(.066, .03, .06, suela, 0, FOOT_Y + .015, -.038, r);
    for (const sx of [-1, 1]) { const g = k.esf(.024, el, sx * .0725, -.19, 0, r, .14, 1.15, .9, 10); }
    k.esf(.013, mat, 0, -.145, -.072, r, .8, 1.5, .5, 8);
    k.esf(1, mat, 0, -.231, .125, r, .06, .036, .05, 14);
  });

  regCalzado('sandalias', 'Sandalias', 'Abiertos', ['principal', 'secundario', 'acento'], { principal: '#8A5A2B', secundario: '#D9B38C', acento: '#C9A24B' }, (ctx, i) => {
    const k = kit(ctx), r = ctx.partes.rodillas[i], tira = ctx.mat('principal', { roughness: .55 }), sue = ctx.mat('secundario', { roughness: .8 }), ac = ctx.mat('acento', { metalness: .6, roughness: .3 });
    const s = k.cil(1, 1, .016, sue, 0, FOOT_Y + .008, .04, r, 28); s.scale.set(.072, 1, .135);
    k.cil(1, 1, .006, tira, 0, FOOT_Y + .019, .04, r, 28).scale.set(.068, 1, .128);
    for (const [z, sc] of [[.045, 1], [.105, .92]]) { const a = k.tor(.063 * sc, .0075, tira, 0, -.246, z, r, PI, 18); a.scale.y = .78; }
    const t = k.aro(.07, .007, tira, 0, -.205, 0, r);
    k.caja(.026, .018, .008, ac, 0, -.205, .074, r);
    const h = k.tor(.072, .007, tira, 0, -.236, -.048, r, PI, 16); h.rotation.set(0, PI, 0); h.scale.y = .75;
    k.linea(V(0, -.245, .005), V(0, -.215, .068), .006, tira, r);
  });

  regCalzado('crocs_zuecos', 'Crocs / zuecos', 'Abiertos', ['principal', 'secundario'], { principal: '#2DA3C9', secundario: '#1B6E8C' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .45 }), strap = ctx.mat('secundario', { roughness: .5 });
    const z = zapato(ctx, i, { mat, matS: mat, sH: .026, rx: .076, hU: .052, rz: .122, elev: .006, alto: -.012, rs: .074, sz: .134 });
    const { k, r, U } = z;
    for (const [x, zz] of [[-.03, .06], [.03, .06], [-.03, .105], [.03, .105], [0, .08], [0, .13], [-.034, .145], [.034, .145]]) { const y = sup(U, x, zz); const h = k.esf(.0095, ctx.M('#0E3A4A'), x, y + .0005, zz, r, 1, .35, 1, 8); }
    const a = k.tor(.076, .0095, strap, 0, -.19, 0, r, PI, 18); a.rotation.set(PI / 2, 0, PI);
    for (const sx of [-1, 1]) k.esf(.013, ctx.mat('secundario', { metalness: .5 }), sx * .077, -.19, 0, r, .6, 1, 1, 8);
    k.esf(.02, ctx.mat('secundario'), 0, sup(U, 0, .15) + .004, .15, r, 1.2, .5, 1, 8);
  });

  regCalzado('pantuflas', 'Pantuflas', 'Casa', ['principal', 'secundario'], { principal: '#C9A27A', secundario: '#F5C6CF' }, (ctx, i) => {
    const k = kit(ctx), r = ctx.partes.rodillas[i], piel = ctx.mat('principal', { roughness: 1 }), rosa = ctx.mat('secundario', { roughness: 1 });
    const crema = ctx.M('#F4EBDD', { roughness: 1 }), negro = ctx.M('#14100E', { roughness: .3 });
    const s = k.cil(1, 1, .014, crema, 0, FOOT_Y + .007, .04, r, 28); s.scale.set(.08, 1, .14);
    const U = { rx: .081, ry: .06, rz: .13, cz: .035, cy: -.215 };
    k.esf(1, piel, 0, U.cy, U.cz, r, U.rx, U.ry, U.rz, 22);
    k.cil(.077, .074, .045, piel, 0, -.21, 0, r, 22);
    for (let n = 0; n < 14; n++) { const a = n / 14 * PI * 2; k.esf(.0145, piel, Math.sin(a) * .08, -.188, Math.cos(a) * .08, r, 1, .9, 1, 8); }
    for (const sx of [-1, 1]) { k.esf(.026, piel, sx * .05, sup(U, sx * .05, .085) - .005, .075, r, 1, 1, .7, 10); k.esf(.015, rosa, sx * .05, sup(U, sx * .05, .085) - .002, .082, r, 1, 1, .5, 8); }
    k.esf(.032, rosa, 0, -.226, .145, r, 1.05, .8, .9, 12);      // hocico
    k.esf(.011, negro, 0, -.214, .171, r, 1.2, .9, .8, 8);        // nariz
    for (const sx of [-1, 1]) k.esf(.008, negro, sx * .03, sup(U, sx * .03, .115) + .002, .115, r, 1, 1, .6, 8);
  });

  regCalzado('zapato_princesa', 'Zapatos de princesa', 'Zapatos', ['principal', 'secundario', 'acento'], { principal: '#F29CC0', secundario: '#C0286E', acento: '#FFFFFF' }, (ctx, i) => {
    const bri = ctx.mat('principal', { roughness: .25, metalness: .45 }), suela = ctx.mat('secundario', { roughness: .5 }), gem = ctx.mat('acento', { roughness: .1, metalness: .3, emissive: new T.Color('#FFFFFF'), emissiveIntensity: .35 });
    const z = zapato(ctx, i, { mat: bri, matS: suela, sH: .014, hU: .04 });
    const { k, r, U } = z;
    k.caja(.056, .024, .054, suela, 0, FOOT_Y + .012, -.04, r);
    const a = k.tor(.066, .006, bri, 0, -.238, .045, r, PI, 18); a.scale.y = .82;       // correa de empeine
    for (const sx of [-1, 1]) k.esf(.0075, gem, sx * .066, -.238, .045, r, 1, 1, 1, 8);
    const by = sup(U, 0, .1) + .012;
    for (const sx of [-1, 1]) { const l = k.esf(.026, bri, sx * .026, by, .1, r, 1.15, .6, .65, 10); l.rotation.z = sx * .35; }
    k.esf(.012, gem, 0, by, .1, r, 1, 1, 1, 8);
    for (const [x, zz] of [[-.03, .15], [.03, .15], [0, .165], [-.02, .0], [.02, -.02]]) { k.esf(.0065, gem, x, sup(U, x, zz) + .002, zz, r, 1, 1, 1, 6); }
    const rr = k.tor(.075, .005, gem, 0, -.2, 0, r, PI * 2, 18); rr.rotation.x = PI / 2;
  });

  regCalzado('botas_lluvia', 'Botas de lluvia', 'Botas', ['principal', 'secundario'], { principal: '#F2C230', secundario: '#2A2A2E' }, (ctx, i) => {
    const mat = ctx.mat('principal', { roughness: .2, metalness: .02 }), suela = ctx.mat('secundario', { roughness: .8 });
    const z = zapato(ctx, i, { mat, matS: suela, sH: .026, elev: .004, alto: .18, rs: .077, borde: mat, bordeG: .01 });
    const { k, r } = z;
    k.esf(1, mat, 0, -.228, .13, r, .066, .04, .052, 14);
    k.aro(.088, .008, suela, 0, -.04, 0, r);
    for (const sx of [-1, 1]) k.linea(V(sx * .067, -.2, .02), V(sx * .06, -.236, .1), .004, suela, r);
  });
}
