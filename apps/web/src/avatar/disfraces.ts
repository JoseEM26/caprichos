/* eslint-disable -- piezas pasadas tal cual de la maqueta aprobada (no se reescriben a mano) */
// @ts-nocheck
import { AVATAR } from './nucleo';

/*
 * Disfraces de Caprichos: gorros, máscaras, accesorios y disfraces completos (presets).
 * Categorías que registra: cabeza, cara, accesorio, disfraz, y las prendas especiales dz_* de arriba/abajo/calzado.
 */
export function registrarDisfraces() {
  const A = AVATAR, T = A.T, MED = A.MED;
  const { M, malla, caja, esfera, capsula, texCanvas, tono } = A;
  const PI = Math.PI, DOS = PI * 2, DS = T.DoubleSide;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const grupo = (p, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); if (p) p.add(g); return g; };
  const cil = (rt, rb, h, mat, x, y, z, p, seg = 20) => malla(new T.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
  const cono = (r, h, mat, x, y, z, p, seg = 16) => cil(0, r, h, mat, x, y, z, p, seg);
  const toro = (R, r, mat, x, y, z, p, rx = PI / 2, arco = DOS, seg = 28) => { const m = malla(new T.TorusGeometry(R, r, 10, seg, arco), mat, x, y, z, p); m.rotation.x = rx; return m; };
  const elip = (sx, sy, sz, mat, x, y, z, p, seg = 16) => { const m = esfera(1, mat, x, y, z, p, seg); m.scale.set(sx, sy, sz); return m; };
  /** Cúpula (casquete esférico) con borde a la altura yb (en coordenadas del mundo/cabeza) y estirada en y por sy. */
  const domo = (R, yb, mat, p, sy = 1) => { const m = malla(new T.SphereGeometry(R, 36, 20, 0, DOS, 0, Math.acos(Math.min(1, yb / (sy * R)))), mat, 0, 0, 0, p); m.scale.y = sy; return m; };
  const orient = (m, dir) => { m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); return m; };
  /** Tubo cónico por puntos (cuernos, astas, colas, tallos). mats: lista opcional de materiales alternados por tramo. */
  function rama(pts, r0, r1, mat, p, mats) {
    const g = grupo(p), n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], ra = r0 + (r1 - r0) * i / n, rb = r0 + (r1 - r0) * (i + 1) / n;
      const d = b.clone().sub(a), mt = mats ? mats[i % mats.length] : mat;
      orient(cil(rb, ra, d.length(), mt, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, g, 10), d);
      esfera(ra, mt, a.x, a.y, a.z, g, 8);
    }
    const u = pts[n]; esfera(r1 || .002, mats ? mats[(n - 1) % mats.length] : mat, u.x, u.y, u.z, g, 8);
    return g;
  }
  function deformar(geo, f) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const r = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, r[0], r[1], r[2]); }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  }
  /** Cono curvo (puntas de gorros): sale de y=-h/2 (base) a h/2 (punta); devuelve la punta (en el sistema del cono). */
  function conoCurvo(rb, h, mat, p, { bz = 0, bx = 0, by = 0, y0 = 0, seg = 28 } = {}) {
    const f = (x, y, z) => { const k = (y + h / 2) / h, e = k * k; return [x + bx * e, y - by * e, z + bz * e]; };
    const g = new T.CylinderGeometry(.012, rb, h, seg, 12, true);
    deformar(g, f);
    const m = malla(g, mat, 0, y0, 0, p); m.material = mat; m.geometry = g;
    const t = f(0, h / 2, 0);
    return { m, punta: V(t[0], t[1] + y0, t[2]) };
  }
  /** Anillo plano (alas de sombreros) con deformación f(x,y,z). */
  function ala(r0, r1, mat, p, f, grosor = .016) {
    const m = (r0 + r1) / 2;
    const perfil = [[r0, 0], [m, -.004], [r1, 0], [r1, grosor], [m, grosor - .004], [r0, grosor]].map(([x, y]) => new T.Vector2(x, y));
    const g = new T.LatheGeometry(perfil, 48);
    deformar(g, f || ((x, y, z) => [x, y, z]));
    return malla(g, mat, 0, 0, 0, p);
  }
  const R = (cat, id, nombre, grupoN, porDefecto, construir, extra) => A.registrar(cat, Object.assign({ id, nombre, grupo: grupoN, colores: Object.keys(porDefecto), porDefecto, construir }, extra));
  const brillo = (o = {}) => Object.assign({ roughness: .25, metalness: .85 }, o);
  const dorado = '#F2C14E';
  /** Coloca m sobre la cabeza en (elev, azim) con su +y apuntando hacia afuera. desp = desplazamiento extra hacia afuera. */
  function clavar(ctx, m, elev, azim, extra = .012, desp = 0) {
    const pos = ctx.H.sobreCabeza(elev, azim, extra), n = pos.clone().normalize();
    m.position.copy(pos.add(n.clone().multiplyScalar(desp))); orient(m, n); return m;
  }
  /** Pegatina (logo) sobre una cúpula de radio Rc a th rad de la coronilla, azimut az. */
  function pegatina(p, Rc, th, az, w, h, tex) {
    const g = grupo(p); g.rotation.y = az;
    const m = malla(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 }), 0, Rc * Math.cos(th), Rc * Math.sin(th), g);
    m.rotation.x = th - PI / 2; m.castShadow = false; return m;
  }
  const estrella2D = (c, x, y, r, rin) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? rin : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };

  /* ---------- Pintura sobre la cara (casquete con textura transparente) ---------- */
  const FW = 512, FH = 400, FK = 917, FT0 = .7, FTL = 1.6, FHW = 1;
  function mapa(x, y) {
    const th = Math.acos(Math.max(-1, Math.min(1, y / (.279 * .97)))), s = Math.max(.25, Math.sin(th));
    const d = Math.asin(Math.max(-1, Math.min(1, x / (.279 * s))));
    return [FW * (.5 + d / (2 * FHW)), FH * (th - FT0) / FTL];
  }
  function kit(c) {
    const K = {
      c,
      todo(col) { c.fillStyle = col; c.fillRect(0, 0, FW, FH); },
      ell(x, y, rx, ry, col, rot = 0, borde, bw = .004) { const [px, py] = mapa(x, y); c.beginPath(); c.ellipse(px, py, rx * FK, ry * FK, rot, 0, DOS); if (col) { c.fillStyle = col; c.fill(); } if (borde) { c.strokeStyle = borde; c.lineWidth = bw * FK; c.stroke(); } return K; },
      poli(pts, col, borde, bw = .004) { c.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = mapa(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); if (col) { c.fillStyle = col; c.fill(); } if (borde) { c.strokeStyle = borde; c.lineWidth = bw * FK; c.lineJoin = 'round'; c.stroke(); } return K; },
      linea(pts, col, w = .006) { c.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = mapa(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.strokeStyle = col; c.lineWidth = w * FK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); return K; },
      hueco(x, y, rx, ry, rot = 0) { c.save(); c.globalCompositeOperation = 'destination-out'; K.ell(x, y, rx, ry, '#000', rot); c.restore(); return K; },
      estrella(x, y, r, col) { const [px, py] = mapa(x, y); estrella2D(c, px, py, r * FK, r * FK * .45); c.fillStyle = col; c.fill(); return K; },
    };
    return K;
  }
  function pintar(ctx, dibujar) {
    const g = grupo(ctx.partes.cabeza);
    const tex = texCanvas(FW, FH, (c) => { c.clearRect(0, 0, FW, FH); dibujar(kit(c)); });
    const mat = new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: .03, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const m = malla(new T.SphereGeometry(.279, 48, 28, PI / 2 - FHW, 2 * FHW, FT0, FTL), mat, 0, 0, 0, g);
    m.scale.set(1, .97, .95); m.castShadow = false;
    return g;
  }

  /* =================================================================
   * CABEZA: gorros, sombreros, coronas, orejas, cascos
   * ================================================================= */
  const cab = (ctx) => grupo(ctx.partes.cabeza);

  function gorra(ctx, reves) {
    const g = cab(ctx), t = grupo(g);
    t.rotation.x = reves ? 0 : -.12; if (reves) g.rotation.y = PI;
    const P = ctx.mat('principal', { roughness: .72, side: DS }), S = ctx.mat('secundario', { roughness: .6 });
    const PV = M(tono(ctx.col('principal'), .86), { roughness: .7 });
    domo(.305, reves ? .17 : .15, P, t);
    const v = malla(new T.CylinderGeometry(.42, .42, .022, 30, 1, false, -1.05, 2.1), PV, 0, .16, 0, t); v.rotation.x = .1; v.scale.set(.82, 1, .95);
    esfera(.024, S, 0, .305, 0, t);
    for (let k = 0; k < 3; k++) { const gm = grupo(t); gm.rotation.y = k * PI / 3; toro(.307, .004, PV, 0, 0, 0, gm, 0, PI - 1.02).rotation.z = .51; }
    const tex = texCanvas(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = ctx.col('secundario'); c.font = 'bold 104px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('C.', w / 2, h / 2 + 6); });
    pegatina(t, .308, .78, 0, .125, .125, tex);
  }
  R('cabeza', 'gorra_caprichos', 'Gorra Caprichos', 'Gorras', { principal: '#E67929', secundario: '#FFF1DC' }, (ctx) => gorra(ctx, false));
  R('cabeza', 'gorra_reves', 'Gorra al revés', 'Gorras', { principal: '#0B2C3E', secundario: '#FFF1DC' }, (ctx) => gorra(ctx, true));

  R('cabeza', 'gorro_lana', 'Gorro de lana', 'Gorros', { principal: '#D94F4F', secundario: '#FFFFFF', acento: '#F2C14E' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = -.16;
    const P = ctx.mat('principal', { roughness: .95, side: DS }), S = ctx.mat('secundario', { roughness: .95 });
    domo(.31, .14, P, t, 1.1);
    toro(.29, .042, S, 0, .17, 0, t); toro(.248, .016, ctx.mat('acento', { roughness: .9 }), 0, .27, 0, t);
    const top = .31 * 1.1 + .03;
    esfera(.06, S, 0, top, 0, t); for (let i = 0; i < 5; i++) { const a = i * DOS / 5; esfera(.034, S, Math.cos(a) * .045, top + .02, Math.sin(a) * .045, t, 8); }
  });

  R('cabeza', 'boina', 'Boina', 'Gorros', { principal: '#7A2E3A', secundario: '#2B1A1F' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.set(-.08, 0, .14);
    const P = ctx.mat('principal', { roughness: .9 });
    toro(.256, .02, ctx.mat('secundario', { roughness: .8 }), 0, .15, 0, t);
    elip(.34, .125, .34, P, 0, .25, 0, t, 28);
    cil(.014, .02, .05, P, 0, .38, 0, t, 10).rotation.z = .2;
  });

  R('cabeza', 'sombrero_vaquero', 'Sombrero de vaquero', 'Sombreros', { principal: '#9B6A3C', secundario: '#4A2C1D', acento: dorado }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .03, 0); t.rotation.x = -.08;
    const P = ctx.mat('principal', { roughness: .75, side: DS }), B = ctx.mat('secundario', { roughness: .6 });
    const pts = [[.265, .12], [.262, .2], [.25, .3], [.22, .37], [.15, .4], [.07, .395], [.0, .37]].map(([x, y]) => new T.Vector2(x, y));
    const cg = new T.LatheGeometry(pts, 36); deformar(cg, (x, y, z) => [x, y - (y > .3 ? .05 * Math.max(0, 1 - Math.abs(x) / .26) * Math.max(0, z + .1) * 4 : 0), z]);
    malla(cg, P, 0, 0, 0, t);
    ala(.25, .5, P, t, (x, y, z) => [x * 1.02, y + .55 * x * x - .08 * z * z + .03, z * 1.0]).position.y = .115;
    toro(.264, .017, B, 0, .17, 0, t);
    const c = elip(.032, .032, .01, ctx.mat('acento', brillo()), 0, .17, .278, t); c.rotation.x = 0;
  });

  R('cabeza', 'sombrero_paja', 'Sombrero de paja', 'Sombreros', { principal: '#E8CB84', secundario: '#D94F4F' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .03, 0); t.rotation.x = -.1;
    const tex = texCanvas(64, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(80,50,10,.28)'; c.lineWidth = 2; for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }, [1, 1]);
    const P = ctx.mat('principal', { roughness: .95, map: tex, side: DS }), S = ctx.mat('secundario', { roughness: .7 });
    domo(.285, .125, P, t, .78).position.y = .03;
    ala(.24, .56, P, t, (x, y, z) => { const r = Math.hypot(x, z); return [x, y - 1.1 * (r - .24) * (r - .24), z]; }).position.y = .12;
    toro(.272, .02, S, 0, .15, 0, t);
    for (const s of [-1, 1]) { const l = elip(.045, .018, .014, S, s * .052, .15, .275, t, 10); l.rotation.z = s * .5; }
    esfera(.02, S, 0, .15, .281, t, 10);
  }, { });

  R('cabeza', 'sombrero_copa', 'Sombrero de copa', 'Sombreros', { principal: '#1E1E26', secundario: '#8E2B3A', acento: dorado }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .02, 0); t.rotation.x = -.06;
    const P = ctx.mat('principal', { roughness: .35 });
    cil(.205, .225, .38, P, 0, .38, 0, t, 32);
    cil(.37, .37, .022, P, 0, .19, 0, t, 40).scale.z = 1.05;
    toro(.37, .014, P, 0, .2, 0, t).scale.set(1, 1.05, 1);
    cil(.2265, .2285, .075, ctx.mat('secundario', { roughness: .5 }), 0, .235, 0, t, 32);
    caja(.075, .068, .012, ctx.mat('acento', brillo()), 0, .235, .232, t); caja(.045, .04, .014, P, 0, .235, .232, t);
  }, { alto: true });

  function puntaBruja(ctx, mago) {
    const g = cab(ctx), t = grupo(g, 0, .03, 0); t.rotation.x = -.1;
    const P = ctx.mat('principal', { roughness: .7, side: DS }), B = ctx.mat('secundario', { roughness: .55 }), D = ctx.mat('acento', brillo({ roughness: .3 }));
    const h = mago ? .62 : .55;
    const c = conoCurvo(mago ? .23 : .215, h, P, t, { bz: -.26, by: .08, y0: .17 + h / 2 });
    ala(.2, mago ? .44 : .5, P, t, (x, y, z) => { const r = Math.hypot(x, z); return [x, y - .6 * (r - .2) * (r - .2), z]; }).position.y = .17;
    toro(.228, .026, B, 0, .22, 0, t); caja(.08, .075, .014, D, 0, .22, .245, t);
    if (mago) for (const [a, k, s] of [[.5, .3, .03], [-.4, .5, .024], [2.4, .35, .026], [3.6, .6, .02], [1.4, .62, .022]]) {
      const e = esfera(s, ctx.mat('acento', { emissive: ctx.col('acento'), emissiveIntensity: .6, roughness: .4 }), 0, 0, 0, t, 6); const rr = .225 * (1 - k * .8);
      e.position.set(Math.sin(a) * rr, .17 + h * k, Math.cos(a) * rr - c.punta.z * k * k + .005); e.scale.set(1, 1, .5); if (Math.cos(a) < 0) e.position.z = Math.cos(a) * rr; 
    }
  }
  R('cabeza', 'sombrero_bruja', 'Sombrero de bruja', 'Sombreros', { principal: '#2B2038', secundario: '#7B3FA0', acento: dorado }, (ctx) => puntaBruja(ctx, false), { alto: true });
  R('cabeza', 'sombrero_mago', 'Sombrero de mago', 'Sombreros', { principal: '#3B3A8E', secundario: '#F2C14E', acento: '#FFE680' }, (ctx) => puntaBruja(ctx, true), { alto: true });

  R('cabeza', 'gorro_navidad', 'Gorro navideño', 'Navidad', { principal: '#D32F2F', secundario: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = -.2;
    const P = ctx.mat('principal', { roughness: .85, side: DS }), S = ctx.mat('secundario', { roughness: 1 });
    const c = conoCurvo(.28, .5, P, t, { bz: -.42, by: .3, y0: .2 + .25 });
    toro(.272, .056, S, 0, .205, 0, t);
    esfera(.06, S, c.punta.x, c.punta.y - .015, c.punta.z, t);
  }, { alto: true });

  R('cabeza', 'gorro_elfo', 'Gorro de elfo', 'Navidad', { principal: '#2E8B57', secundario: '#D32F2F', acento: dorado }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = -.18;
    const P = ctx.mat('principal', { roughness: .85, side: DS }), S = ctx.mat('secundario', { roughness: .8 });
    const c = conoCurvo(.26, .55, P, t, { bx: .34, bz: -.12, by: .18, y0: .19 + .275 });
    toro(.262, .035, S, 0, .205, 0, t);
    for (let i = 0; i < 12; i++) { const a = 1.5 + i * (DOS - 3) / 11; cono(.032, .075, S, Math.sin(a) * .262, .155, Math.cos(a) * .262, t, 4).rotation.x = PI; }
    esfera(.034, ctx.mat('acento', brillo()), c.punta.x, c.punta.y - .02, c.punta.z, t);
  }, { alto: true });

  R('cabeza', 'cachos_reno', 'Cuernos de reno', 'Navidad', { principal: '#7A4B2A', secundario: '#5B3A29' }, (ctx) => {
    const g = cab(ctx), M1 = ctx.mat('principal', { roughness: .8 });
    const ban = toro(.296, .014, ctx.mat('secundario'), 0, 0, 0, g, -.22, PI); ban.rotation.x = -.22;
    for (const s of [-1, 1]) {
      const a = grupo(g, s * .15, .24, -.03); a.rotation.z = -s * .35;
      rama([V(0, 0, 0), V(0, .09, 0), V(s * .015, .19, -.02), V(s * .05, .3, -.03)], .028, .012, M1, a);
      for (const [y, dx, dz, l] of [[.1, s * .09, .05, .15], [.2, s * .1, -.06, .17], [.3, s * .03, .0, .1]]) {
        const b = V(dx, l, dz); rama([V(s * .01, y, 0), V(s * .01, y, 0).add(b.clone().multiplyScalar(.5)), V(s * .01, y, 0).add(b)], .016, .007, M1, a);
      }
    }
  }, { alto: true });

  function corona(ctx, n, alta) {
    const g = cab(ctx), t = grupo(g, 0, .2, 0); t.rotation.x = -.12;
    const O = ctx.mat('principal', brillo()), G = ctx.mat('secundario', { roughness: .15, metalness: .1, emissive: ctx.col('secundario'), emissiveIntensity: .35 }), Pe = ctx.mat('acento', { roughness: .2 });
    toro(.23, .016, O, 0, 0, 0, t);
    for (let i = 0; i < n; i++) {
      const a = i * DOS / n, x = Math.sin(a) * .23, z = Math.cos(a) * .23;
      const p = cono(.034, alta ? .13 : .095, O, x, (alta ? .13 : .095) / 2 + .01, z, t, 8);
      esfera(.018, Pe, x, (alta ? .13 : .095) + .02, z, t, 10);
      if (i % 2 === 0) esfera(.017, G, Math.sin(a + DOS / n / 2) * .232, .002, Math.cos(a + DOS / n / 2) * .232, t, 10);
    }
  }
  R('cabeza', 'corona_princesa', 'Corona de princesa', 'Realeza', { principal: dorado, secundario: '#E8559A', acento: '#FFFFFF' }, (ctx) => corona(ctx, 9, false));

  R('cabeza', 'tiara', 'Tiara', 'Realeza', { principal: '#D9DEE8', secundario: '#6FB7F2', acento: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = .62;
    const O = ctx.mat('principal', brillo()), G = ctx.mat('secundario', { roughness: .1, emissive: ctx.col('secundario'), emissiveIntensity: .4 }), W = ctx.mat('acento', { roughness: .1, emissive: '#FFFFFF', emissiveIntensity: .4 });
    toro(.292, .011, O, 0, 0, 0, t, 0, PI, 36);
    for (const [al, h] of [[PI / 2, .1], [PI / 2 + .3, .07], [PI / 2 - .3, .07], [PI / 2 + .58, .05], [PI / 2 - .58, .05]]) {
      const x = Math.cos(al) * .292, y = Math.sin(al) * .292;
      const c = cono(.026, h, O, x, y, 0, t, 4); c.rotation.z = al - PI / 2; c.translateY(h / 2);
      const e = esfera(.014, W, 0, 0, 0, t, 8); e.position.set(x, y, 0).add(V(Math.cos(al), Math.sin(al), 0).multiplyScalar(h + .01));
    }
    const j = esfera(.03, G, 0, 0, 0, t, 12); j.position.set(0, .292, 0); j.scale.set(1, 1.3, .8);
  });

  R('cabeza', 'corona_rey', 'Corona de rey', 'Realeza', { principal: dorado, secundario: '#B3262E', acento: '#2E7BD6' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .21, 0); t.rotation.x = -.06;
    const O = ctx.mat('principal', brillo({ side: DS })), Rj = ctx.mat('secundario', { roughness: .9, side: DS }), Z = ctx.mat('acento', { roughness: .1, emissive: ctx.col('acento'), emissiveIntensity: .4 });
    cil(.262, .238, .1, O, 0, .05, 0, t, 32);
    domo(.236, 0, Rj, t, .85).position.y = .09;
    for (let i = 0; i < 6; i++) {
      const a = i * DOS / 6, x = Math.sin(a) * .25, z = Math.cos(a) * .25;
      cono(.04, .11, O, x, .155, z, t, 6); esfera(.02, O, x, .225, z, t, 8);
      esfera(.018, i % 2 ? Z : ctx.mat('secundario', { roughness: .1, emissive: ctx.col('secundario'), emissiveIntensity: .3 }), Math.sin(a + .52) * .26, .05, Math.cos(a + .52) * .26, t, 10);
    }
    for (const r of [0, PI / 2]) { const gm = grupo(t, 0, .1, 0); gm.rotation.y = r; const a = toro(.238, .014, O, 0, 0, 0, gm, 0, PI); a.scale.y = .8; }
    esfera(.034, O, 0, .3, 0, t); caja(.014, .06, .014, O, 0, .35, 0, t); caja(.045, .014, .014, O, 0, .355, 0, t);
  }, { alto: true });

  R('cabeza', 'corona_hielo', 'Corona de hielo', 'Realeza', { principal: '#BFE9FF', secundario: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .2, 0); t.rotation.x = -.15;
    const Hh = ctx.mat('principal', { roughness: .1, metalness: .2, emissive: ctx.col('principal'), emissiveIntensity: .35, transparent: true, opacity: .85 });
    toro(.23, .014, ctx.mat('secundario', brillo()), 0, 0, 0, t);
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * .55, c = Math.abs(i - 4), h = .24 - c * .035, x = Math.sin(a) * .235, z = Math.cos(a) * .235;
      const m = cono(.032, h, Hh, x, h / 2, z, t, 6); m.rotation.set(0, a, Math.sin(a) * -.1);
      if (c < 2) esfera(.014, ctx.mat('secundario', { emissive: '#FFFFFF', emissiveIntensity: .6 }), x, h + .01, z, t, 6);
    }
  }, { alto: true });

  R('cabeza', 'casco_vikingo', 'Casco vikingo', 'Cascos', { principal: '#8E96A3', secundario: '#8B5A2B', acento: '#F4EAD0' }, (ctx) => {
    const g = cab(ctx);
    const Mt = ctx.mat('principal', brillo({ roughness: .4, metalness: .7, side: DS })), Br = ctx.mat('secundario', brillo({ roughness: .5, metalness: .6 })), Hn = ctx.mat('acento', { roughness: .45 });
    domo(.305, .15, Mt, g);
    toro(.272, .02, Br, 0, .15, 0, g);
    for (const r of [0, PI / 2]) { const gm = grupo(g); gm.rotation.y = r; toro(.309, .012, Br, 0, 0, 0, gm, 0, PI - 1.02).rotation.z = .51; }
    for (let i = 0; i < 8; i++) { const a = i * DOS / 8 + .2; if (Math.abs(Math.sin(a / 1)) < 2) esfera(.014, Br, Math.sin(a) * .275, .15, Math.cos(a) * .275, g, 8); }
    for (const s of [-1, 1]) {
      cil(.05, .06, .05, Br, s * .27, .125, 0, g, 12).rotation.z = PI / 2;
      rama([V(s * .29, .125, 0), V(s * .38, .13, 0), V(s * .45, .21, 0), V(s * .45, .34, 0), V(s * .4, .42, 0)], .048, .008, Hn, g);
    }
  }, { ocultaCabello: true });

  R('cabeza', 'gorro_chef', 'Gorro de chef', 'Gorros', { principal: '#FFFFFF', secundario: '#E7E2D8' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .02, 0); t.rotation.x = -.08;
    const P = ctx.mat('principal', { roughness: .85 }), S = ctx.mat('secundario', { roughness: .85 });
    cil(.268, .262, .1, P, 0, .19, 0, t, 32);
    for (let i = 0; i < 12; i++) { const a = i * DOS / 12; caja(.012, .09, .006, S, Math.sin(a) * .267, .19, Math.cos(a) * .267, t).rotation.y = a; }
    elip(.3, .17, .3, P, 0, .38, 0, t, 24);
    for (let i = 0; i < 6; i++) { const a = i * DOS / 6; elip(.12, .13, .12, P, Math.sin(a) * .2, .4, Math.cos(a) * .2, t, 14); }
    elip(.15, .12, .15, P, 0, .5, 0, t, 16);
  }, { alto: true, ocultaCabello: false });

  R('cabeza', 'gorro_pirata', 'Sombrero pirata', 'Piratas', { principal: '#1E1E26', secundario: '#FFF1DC', acento: '#D94F4F' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .02, 0); t.rotation.x = -.1;
    const P = ctx.mat('principal', { roughness: .6, side: DS });
    domo(.29, .13, P, t, .85).position.y = .045;
    ala(.25, .46, P, t, (x, y, z) => [x, y + .75 * x * x - .02 * z * z, z]).position.y = .13;
    toro(.29, .014, ctx.mat('secundario', brillo({ roughness: .4 })), 0, .15, 0, t);
    const tex = texCanvas(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.fillStyle = ctx.col('secundario'); c.strokeStyle = ctx.col('secundario'); c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(24, 92); c.lineTo(104, 112); c.moveTo(104, 92); c.lineTo(24, 112); c.stroke();
      c.beginPath(); c.arc(64, 50, 30, 0, DOS); c.fill(); c.fillRect(46, 66, 36, 22);
      c.fillStyle = '#1E1E26'; c.beginPath(); c.arc(52, 50, 8, 0, DOS); c.arc(76, 50, 8, 0, DOS); c.fill(); c.fillRect(60, 62, 8, 8);
    });
    pegatina(t, .295, .72, 0, .15, .15, tex);
    const pl = ctx.mat('acento', { roughness: .6 });
    rama([V(.2, .25, .0), V(.26, .35, -.05), V(.2, .46, -.12), V(.08, .46, -.2)], .02, .004, pl, t);
  });

  function orejasAnimal(ctx, lobo) {
    const g = cab(ctx), Pm = ctx.mat('principal', { roughness: .85 }), In = ctx.mat('secundario', { roughness: .8 });
    const ban = toro(.296, .011, M(tono(ctx.col('principal'), .8)), 0, 0, 0, g, -.2, PI); ban.rotation.x = -.2;
    for (const s of [-1, 1]) {
      const r = lobo ? .08 : .075, h = lobo ? .2 : .14;
      const e = grupo(g); clavar(ctx, e, lobo ? 1.0 : 1.05, s * (lobo ? .8 : .72), .014, -.015); e.rotation.z += 0;
      const o = cono(r, h, Pm, 0, h / 2, 0, e, 14); o.scale.z = .5;
      const i = cono(r * .62, h * .78, In, 0, h * .4, .018, e, 14); i.scale.z = .35;
      if (lobo) { for (let k = 0; k < 3; k++) cono(.02, .06, Pm, (k - 1) * .03, .01, .015, e, 6).rotation.x = PI; }
    }
  }
  R('cabeza', 'orejas_gato', 'Orejas de gato', 'Animales', { principal: '#5A4636', secundario: '#F4A7B9' }, (ctx) => orejasAnimal(ctx, false));
  R('cabeza', 'orejas_lobo', 'Orejas de lobo', 'Animales', { principal: '#8A8F9A', secundario: '#3B3F4A' }, (ctx) => orejasAnimal(ctx, true));

  R('cabeza', 'orejas_conejo', 'Orejas de conejo', 'Animales', { principal: '#FFFFFF', secundario: '#F4A7B9' }, (ctx) => {
    const g = cab(ctx), Pm = ctx.mat('principal', { roughness: .9 }), In = ctx.mat('secundario', { roughness: .9 });
    const ban = toro(.296, .011, M(tono(ctx.col('principal'), .85)), 0, 0, 0, g, -.2, PI); ban.rotation.x = -.2;
    for (const s of [-1, 1]) {
      const e = grupo(g, s * .1, .27, -.04); e.rotation.set(-.12, 0, -s * .22 - (s > 0 ? .0 : 0));
      const o = capsula(.05, .24, Pm, 0, .17, 0, e); o.scale.z = .5;
      const i = capsula(.03, .2, In, 0, .17, .018, e); i.scale.z = .4;
    }
  }, { alto: true });

  R('cabeza', 'cuernitos_diablo', 'Cuernitos de diablillo', 'Fantasía', { principal: '#D32F2F' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .35 });
    for (const s of [-1, 1]) {
      const e = grupo(g); clavar(ctx, e, 1.0, s * .6, .01, -.01);
      rama([V(0, 0, 0), V(0, .05, .008), V(s * .012, .1, .02), V(s * .035, .15, .02)], .04, .006, P, e);
    }
  });

  R('cabeza', 'aureola_angel', 'Aureola de ángel', 'Fantasía', { principal: '#FFD84A' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .46, -.04); t.rotation.x = -.15;
    const O = ctx.mat('principal', { roughness: .2, metalness: .5, emissive: ctx.col('principal'), emissiveIntensity: .55 });
    toro(.19, .022, O, 0, 0, 0, t);
    rama([V(0, -.02, -.19), V(0, -.12, -.2), V(0, -.2, -.17)], .007, .007, O, g);
    return { animar(tm) { t.position.y = .46 + Math.sin(tm * 2) * .012; } };
  }, { alto: true });

  R('cabeza', 'capucha_dino', 'Capucha de dinosaurio', 'Animales', { principal: '#4FAF5A', secundario: '#F2E7A8', acento: '#E8A33D' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .85, side: DS }), W = ctx.mat('secundario'), E = ctx.mat('acento', { roughness: .6 });
    domo(.31, .16, P, g);
    malla(new T.SphereGeometry(.31, 36, 14, PI / 2 + 1.05, DOS - 2.1, 1.0, 1.0), P, 0, 0, 0, g);
    for (let i = 0; i < 6; i++) {
      const ps = 1.25 + i * .27, n = V(0, Math.sin(ps), Math.cos(ps)), k = 1 - i * .1;
      const c = cono(.05 * k, .11 * k, E, 0, 0, 0, g, 4); c.position.copy(n.clone().multiplyScalar(.305 + .035 * k)); orient(c, n); c.scale.x = .55;
    }
    for (const s of [-1, 1]) {
      esfera(.05, W, s * .11, .245, .09, g).scale.z = .8; esfera(.026, M('#1B1B22'), s * .11, .25, .13, g, 10);
    }
  }, { ocultaCabello: true });

  R('cabeza', 'casco_astronauta', 'Casco de astronauta', 'Espacio', { principal: '#FFFFFF', secundario: '#E8742A', acento: '#CFE9FF' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .4 }), O = ctx.mat('secundario', { roughness: .5 });
    const vidrio = ctx.mat('acento', { roughness: .05, metalness: 0, transparent: true, opacity: .2, depthWrite: false });
    const bola = esfera(.37, vidrio, 0, -.01, 0, g, 36); bola.castShadow = false; bola.renderOrder = 2;
    const brill = esfera(.372, M('#FFFFFF', { transparent: true, opacity: .12, roughness: .1, depthWrite: false }), 0, -.01, 0, g, 24); brill.scale.set(1, 1, 1); brill.castShadow = false;
    cil(.2, .24, .1, P, 0, -.33, 0, g, 28); toro(.235, .028, O, 0, -.285, 0, g);
    toro(.364, .018, P, 0, -.17, 0, g, PI / 2, DOS, 36).scale.set(1, 1, 1);
    for (const s of [-1, 1]) { cil(.07, .07, .06, P, s * .37, -.01, 0, g, 16).rotation.z = PI / 2; esfera(.03, M('#8FE9FF', { emissive: '#8FE9FF', emissiveIntensity: .8 }), s * .405, -.01, 0, g, 10); }
    cil(.008, .008, .18, P, .12, .42, -.05, g, 8); esfera(.026, M('#E8403A', { emissive: '#E8403A', emissiveIntensity: .7 }), .12, .52, -.05, g, 10);
  }, { ocultaCabello: true, alto: true });

  R('cabeza', 'chullo_andino', 'Chullo andino', 'Gorros', { principal: '#C0392B', secundario: '#FFFFFF', acento: '#F2B640' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = -.12;
    const col = [ctx.col('principal'), ctx.col('secundario'), ctx.col('acento')];
    const tex = texCanvas(256, 128, (c, w, h) => {
      c.fillStyle = col[0]; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 8; k++) { const x0 = k * 32; c.fillStyle = col[1]; c.beginPath(); c.moveTo(x0, 50); c.lineTo(x0 + 16, 78); c.lineTo(x0 + 32, 50); c.lineTo(x0 + 16, 22); c.fill(); c.fillStyle = col[2]; c.beginPath(); c.moveTo(x0 + 16, 40); c.lineTo(x0 + 22, 50); c.lineTo(x0 + 16, 60); c.lineTo(x0 + 10, 50); c.fill(); }
      c.fillStyle = col[1]; c.fillRect(0, 96, w, 8); c.fillStyle = col[2]; c.fillRect(0, 104, w, 10);
    });
    const P = M('#FFFFFF', { map: tex, roughness: .95, side: DS }), C = ctx.mat('principal', { roughness: .95 }), Bl = ctx.mat('secundario', { roughness: .95 }), Ac = ctx.mat('acento', { roughness: .9 });
    domo(.31, .14, P, t, 1.05);
    const top = .31 * 1.05; cono(.07, .06, C, 0, top - .005, 0, t, 12); esfera(.045, Bl, 0, top + .05, 0, t);
    for (const s of [-1, 1]) {
      const f = grupo(g, s * .275, -.01, 0); f.rotation.z = -s * .12;
      const p = cono(.1, .24, P, 0, -.1, 0, f, 16); p.scale.set(.3, 1, 1.2); p.rotation.x = PI;
      const base = elip(.04, .06, .12, P, 0, .03, 0, f, 12);
      rama([V(s * .02, -.2, .01), V(s * .03, -.3, .02), V(s * .02, -.4, .015)], .012, .01, Bl, f);
      cil(.016, .016, .05, C, s * .02, -.43, .015, f, 8); for (let k = -1; k <= 1; k++) cil(.004, .004, .08, C, s * .02 + k * .008, -.5, .015, f, 4);
      esfera(.03, Ac, s * .02, -.4, .015, f, 10);
    }
  }, { ocultaCabello: true });

  R('cabeza', 'vincha_mono', 'Vincha con moño', 'Accesorios de pelo', { principal: '#E8559A', secundario: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .5 });
    const ban = toro(.294, .014, P, 0, 0, 0, g, -.28, PI); ban.rotation.x = -.28;
    const b = grupo(g); clavar(ctx, b, 1.05, .55, .035, .02); b.rotateZ(-.3);
    for (const s of [-1, 1]) { const l = cono(.075, .11, P, 0, 0, 0, b, 16); l.rotation.z = s * PI / 2; l.position.x = s * .055; l.scale.z = .45; }
    esfera(.026, ctx.mat('secundario', { roughness: .4 }), 0, 0, 0, b, 12);
  });

  R('cabeza', 'gorro_calabaza', 'Gorro de calabaza', 'Fiestas', { principal: '#F28A1E', secundario: '#3E8E3A' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .28, 0); t.rotation.x = -.1;
    const P = ctx.mat('principal', { roughness: .55 });
    for (let k = 0; k < 6; k++) { const a = k * PI / 6; const e = elip(.2, .2, .3, P, 0, 0, 0, t, 16); e.rotation.y = a; }
    cil(.2, .22, .05, P, 0, -.14, 0, t, 24);
    const S = ctx.mat('secundario', { roughness: .8 });
    cil(.026, .036, .1, S, 0, .22, 0, t, 8).rotation.z = .2;
    const ho = elip(.07, .012, .05, S, .1, .18, 0, t, 10); ho.rotation.z = -.4;
    toro(.04, .008, S, .03, .26, 0, t, 0, PI * 1.3);
  }, { ocultaCabello: true });

  R('cabeza', 'corona_flores', 'Corona de flores', 'Fiestas', { principal: '#F4A7B9', secundario: '#FFFFFF', acento: '#F2C14E' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .17, 0); t.rotation.x = -.14;
    toro(.255, .012, M('#3E8E3A', { roughness: .9 }), 0, 0, 0, t);
    const Ce = ctx.mat('acento', { roughness: .5 });
    for (let i = 0; i < 8; i++) {
      const a = i * DOS / 8, x = Math.sin(a) * .255, z = Math.cos(a) * .255, pt = ctx.mat(i % 2 ? 'secundario' : 'principal', { roughness: .6 });
      const f = grupo(t, x, .01, z); f.rotation.y = a; f.rotation.x = -.5;
      for (let k = 0; k < 4; k++) { const b = k * DOS / 4; elip(.026, .026, .012, pt, Math.cos(b) * .03, Math.sin(b) * .03, 0, f, 8); }
      esfera(.016, Ce, 0, 0, .006, f, 8);
      const l = elip(.03, .012, .006, M('#3E8E3A'), Math.sin(a + .4) * .255, -.005, Math.cos(a + .4) * .255, t, 6); l.rotation.y = a + .4;
    }
  });

  R('cabeza', 'gorro_dormir', 'Gorro de dormir', 'Navidad', { principal: '#D94F4F', secundario: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), t = grupo(g); t.rotation.x = -.2;
    const P = ctx.mat('principal', { roughness: .95, side: DS }), S = ctx.mat('secundario', { roughness: 1 });
    const c = conoCurvo(.28, .6, P, t, { bz: -.55, by: .45, y0: .18 + .3 });
    toro(.272, .04, S, 0, .205, 0, t);
    esfera(.055, S, c.punta.x, c.punta.y - .02, c.punta.z, t);
  }, { alto: true });

  R('cabeza', 'gorro_fiesta', 'Gorro de cumpleaños', 'Fiestas', { principal: '#7B4DD1', secundario: '#F2C14E', acento: '#E8559A' }, (ctx) => {
    const g = cab(ctx), t = grupo(g, 0, .02, 0); t.rotation.set(-.1, 0, .18);
    const col = [ctx.col('principal'), ctx.col('secundario'), ctx.col('acento')];
    const tex = texCanvas(128, 128, (c, w, h) => { c.fillStyle = col[0]; c.fillRect(0, 0, w, h); for (let y = 0; y < 128; y += 32) { c.fillStyle = col[1]; c.fillRect(0, y, w, 8); } for (let i = 0; i < 14; i++) { c.fillStyle = col[2]; c.beginPath(); c.arc((i * 47) % 128, (i * 29) % 128, 6, 0, DOS); c.fill(); } });
    cil(.012, .2, .5, M('#FFFFFF', { map: tex, roughness: .6 }), 0, .43, 0, t, 24);
    esfera(.05, ctx.mat('secundario', { roughness: .6 }), 0, .7, 0, t);
    toro(.2, .014, ctx.mat('acento'), 0, .185, 0, t);
  }, { alto: true });

  /* =================================================================
   * CARA: lentes, antifaces, narices, máscaras y maquillaje
   * ================================================================= */
  const corazon = (s, sh = new T.Shape()) => { sh.moveTo(0, -.6 * s); sh.bezierCurveTo(-.95 * s, .05 * s, -.55 * s, .75 * s, 0, .35 * s); sh.bezierCurveTo(.55 * s, .75 * s, .95 * s, .05 * s, 0, -.6 * s); return sh; };
  function rectRedondo(w, h, r, sh = new T.Shape()) {
    const x = -w / 2, y = -h / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh;
  }
  const extr = (sh, prof, mat, p) => malla(new T.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: false, curveSegments: 20 }), mat, 0, 0, 0, p);
  /** Gafas con aros según la forma (lente izquierda en +x). forma(s, escala) → Shape. */
  function gafas(ctx, forma, { sol = false, grosor = .013, escala = 1, dy = .02 } = {}) {
    const g = cab(ctx), F = ctx.mat('principal', brillo({ roughness: .35, metalness: .5 }));
    const lente = ctx.mat('secundario', { roughness: .08, metalness: 0, transparent: true, opacity: sol ? .55 : .16, depthWrite: false });
    for (const s of [-1, 1]) {
      const l = grupo(g, s * .1, dy, .262); l.rotation.y = s * .3;
      const aro = forma(1 * escala); const hueco = forma((1 - grosor / .07) * escala);
      const sh = aro; sh.holes.push(new T.Path(hueco.getPoints(20).reverse()));
      extr(sh, .012, F, l).position.z = -.006;
      const fondo = extr(forma((1 - grosor / .07 * .5) * escala), .004, lente, l); fondo.castShadow = false; fondo.renderOrder = 3;
      const arm = V(s * .167, dy + .01, .241);
      rama([arm, V(s * .185, dy + .01, .205), V(s * .262, dy + .01, .1), V(s * .284, dy, -.005)], .0055, .0055, F, g);
    }
    toro(.022, .006, F, 0, dy + .01, .27, g, 0, PI).rotation.z = 0;
  }
  const circ = (s) => { const sh = new T.Shape(); sh.absarc(0, 0, .066 * s, 0, DOS, false); return sh; };
  R('cara', 'lentes_redondos', 'Lentes redondos', 'Lentes', { principal: '#C9A227', secundario: '#CFE9FF' }, (ctx) => gafas(ctx, circ));
  R('cara', 'lentes_cuadrados', 'Lentes cuadrados', 'Lentes', { principal: '#1E1E26', secundario: '#CFE9FF' }, (ctx) => gafas(ctx, (s) => rectRedondo(.14 * s, .1 * s, .022 * s), { grosor: .016 }));
  R('cara', 'lentes_sol', 'Lentes de sol', 'Lentes', { principal: '#15151B', secundario: '#1B1B2A' }, (ctx) => gafas(ctx, (s) => rectRedondo(.15 * s, .095 * s, .04 * s), { sol: true, grosor: .018 }));
  R('cara', 'lentes_corazon', 'Lentes de corazón', 'Lentes', { principal: '#E8559A', secundario: '#FFC9E0' }, (ctx) => gafas(ctx, (s) => corazon(.13 * s), { grosor: .02, dy: .03 }));

  R('cara', 'antifaz', 'Antifaz', 'Antifaces', { principal: '#1B1B22', secundario: '#FFFFFF' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal');
      K.poli([[-.205, .06], [-.15, .075], [-.05, .065], [0, .045], [.05, .065], [.15, .075], [.205, .06], [.19, -.02], [.12, -.06], [.05, -.03], [0, -.02], [-.05, -.03], [-.12, -.06], [-.19, -.02]], c);
      K.hueco(-.1, .018, .052, .036, -.15).hueco(.1, .018, .052, .036, .15);
      K.linea([[-.18, .055], [-.1, .062], [-.03, .05]], 'rgba(255,255,255,.25)', .006);
    });
  });

  R('cara', 'antifaz_gala', 'Antifaz de gala', 'Antifaces', { principal: '#6B2D8C', secundario: '#F2C14E', acento: '#E8559A' }, (ctx) => {
    pintar(ctx, (K) => {
      const base = ctx.col('principal'), o = ctx.col('secundario');
      const sil = [[-.21, .05], [-.16, .1], [-.08, .085], [0, .06], [.08, .085], [.16, .1], [.21, .05], [.2, -.03], [.13, -.075], [.05, -.04], [0, -.03], [-.05, -.04], [-.13, -.075], [-.2, -.03]];
      K.poli(sil, base, o, .008);
      K.linea([[-.19, .03], [-.14, .075], [-.08, .065]], o, .005).linea([[.19, .03], [.14, .075], [.08, .065]], o, .005);
      for (const [x, y] of [[-.17, -.02], [-.12, -.05], [.12, -.05], [.17, -.02], [0, .045]]) K.ell(x, y, .008, .008, o);
      K.hueco(-.1, .018, .05, .034, -.15).hueco(.1, .018, .05, .034, .15);
      K.ell(-.1, .018, .052, .036, null, -.15, o, .006).ell(.1, .018, .052, .036, null, .15, o, .006);
    });
    const g = cab(ctx), p = [ctx.mat('acento', { roughness: .6 }), ctx.mat('secundario', { roughness: .5 }), ctx.mat('principal', { roughness: .6 })];
    const base = V(.2, .06, .12);
    [[.1, .22, .0], [.16, .17, -.07], [.04, .2, -.06]].forEach(([dx, dy, dz], i) => rama([base.clone(), base.clone().add(V(dx * .5, dy * .6, dz * .5 + .02)), base.clone().add(V(dx, dy, dz))], .01, .003, p[i], g));
    esfera(.018, ctx.mat('secundario', brillo()), .2, .06, .122, g, 10);
  });

  R('cara', 'mascara_heroe', 'Máscara de héroe', 'Antifaces', { principal: '#1F4FBF', secundario: '#FFFFFF' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), b = ctx.col('secundario');
      K.poli([[-.23, .0], [-.2, .09], [-.12, .15], [0, .125], [.12, .15], [.2, .09], [.23, .0], [.19, -.06], [.1, -.075], [.04, -.04], [0, -.02], [-.04, -.04], [-.1, -.075], [-.19, -.06]], c, '#0B1B4A', .005);
      K.hueco(-.1, .02, .055, .04, -.28).hueco(.1, .02, .055, .04, .28);
      K.ell(-.1, .02, .058, .043, null, -.28, b, .007).ell(.1, .02, .058, .043, null, .28, b, .007);
      K.linea([[-.18, .1], [-.1, .13], [-.03, .11]], 'rgba(255,255,255,.28)', .008);
    });
  });

  R('cara', 'parche_pirata', 'Parche de pirata', 'Piratas', { principal: '#15151B', secundario: '#3A3A44' }, (ctx) => {
    pintar(ctx, (K) => { K.linea([[.1, .02], [.2, .075], [.26, .09]], '#15151B', .011).linea([[.1, .02], [0, .12], [-.12, .14], [-.26, .08]], '#15151B', .011); });
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .5 });
    const p = elip(.072, .06, .018, P, .1, .018, .258, g, 20); p.rotation.y = .3; p.rotation.z = .25;
    const q = elip(.052, .04, .006, ctx.mat('secundario', { roughness: .6 }), .098, .02, .274, g, 14); q.rotation.y = .3; q.rotation.z = .25;
  });

  R('cara', 'nariz_payaso', 'Nariz de payaso', 'Narices', { principal: '#E53935' }, (ctx) => {
    const g = cab(ctx);
    esfera(.052, ctx.mat('principal', { roughness: .18 }), 0, -.032, .285, g, 20);
    esfera(.012, M('#FFFFFF', { roughness: .1, emissive: '#FFFFFF', emissiveIntensity: .5 }), -.018, -.012, .328, g, 8);
  });
  R('cara', 'nariz_reno', 'Nariz de reno', 'Narices', { principal: '#FF3B30' }, (ctx) => {
    const g = cab(ctx), mt = new T.MeshStandardMaterial({ color: ctx.col('principal'), roughness: .2, emissive: ctx.col('principal'), emissiveIntensity: .6 });
    esfera(.05, mt, 0, -.032, .284, g, 20);
    esfera(.012, M('#FFFFFF', { roughness: .1, emissive: '#FFFFFF', emissiveIntensity: .5 }), -.017, -.012, .327, g, 8);
    return { animar(t) { mt.emissiveIntensity = .5 + Math.sin(t * 4) * .35; } };
  });
  R('cara', 'nariz_zanahoria', 'Nariz de zanahoria', 'Narices', { principal: '#F28A1E' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .6 }), c = cono(.036, .17, P, 0, 0, 0, g, 12);
    c.position.set(0, -.035, .34); c.rotation.x = PI / 2 + .05;
    for (const z of [.31, .34, .37]) toro(.026 - (z - .31) * .12, .004, M(tono(ctx.col('principal'), .8)), 0, -.035, z, g, 0).scale.set(1, 1, 1);
  });

  R('cara', 'bigote_falso', 'Bigote falso', 'Pelo facial', { principal: '#3B2A20' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .9 });
    for (const s of [-1, 1]) rama([V(s * .008, -.082, .27), V(s * .05, -.092, .26), V(s * .1, -.09, .23), V(s * .135, -.07, .2), V(s * .14, -.048, .19)], .021, .007, P, g);
    esfera(.016, P, 0, -.082, .272, g, 10);
  });

  R('cara', 'barba_larga', 'Barba larga', 'Pelo facial', { principal: '#F2F2F2' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: 1 });
    elip(.2, .17, .13, P, 0, -.255, .145, g, 20);
    for (let i = 0; i < 5; i++) elip(.05, .06, .045, P, (i - 2) * .07, -.36 + Math.abs(i - 2) * .03, .2, g, 10);
    elip(.07, .08, .05, P, 0, -.4, .19, g, 10);
    for (const s of [-1, 1]) {
      elip(.06, .12, .07, P, s * .17, -.14, .1, g, 12); elip(.05, .09, .06, P, s * .225, -.05, .03, g, 12);
      rama([V(s * .008, -.085, .268), V(s * .06, -.1, .255), V(s * .115, -.085, .22)], .028, .012, P, g);
    }
  });

  R('cara', 'mascara_monstruo', 'Máscara de monstruo', 'Monstruos', { principal: '#7FC66B', secundario: '#1B1B22', acento: '#8D95A3' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), d = ctx.col('secundario');
      K.todo(tono(c, 1)); K.hueco(-.1, .02, .052, .045).hueco(.1, .02, .052, .045);
      K.ell(-.1, .02, .052, .045, null, 0, '#2E5A2A', .006).ell(.1, .02, .052, .045, null, 0, '#2E5A2A', .006);
      K.linea([[-.2, .105], [-.1, .13], [0, .115], [.1, .13], [.2, .105]], d, .018);
      K.linea([[-.07, .22], [-.05, .17]], '#2E5A2A', .008);
      K.linea([[.06, .165], [.1, .21]], '#B05A5A', .007);
      for (const y of [.185, .2, .215]) K.linea([[.08, y - .01], [.115, y + .005]], '#2B2B2B', .005);
      K.linea([[-.18, -.05], [-.12, -.02]], '#B05A5A', .008);
      for (const x of [-.17, -.155, -.14]) K.linea([[x, -.065], [x + .01, -.01]], '#2B2B2B', .005);
    });
    const g = cab(ctx), D = ctx.mat('secundario', { roughness: .8 }), Mt = ctx.mat('acento', brillo({ roughness: .4, metalness: .7 }));
    const cap = caja(.43, .09, .42, D, 0, .27, -.01, g); cap.rotation.x = -.06;
    for (const s of [-1, 1]) { cil(.016, .016, .09, Mt, s * .27, -.1, .01, g, 10).rotation.z = PI / 2; cil(.03, .03, .014, Mt, s * .3, -.1, .01, g, 12).rotation.z = PI / 2; cil(.03, .03, .014, Mt, s * .245, -.1, .01, g, 12).rotation.z = PI / 2; }
  }, { ocultaCabello: true });

  R('cara', 'mascara_calabaza', 'Máscara de calabaza', 'Monstruos', { principal: '#F28A1E', secundario: '#3B1F10', acento: '#FFD84A' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), d = ctx.col('secundario'), y = ctx.col('acento');
      K.todo(c);
      for (const x of [-.18, -.1, -.03, .03, .1, .18]) K.linea([[x * 1.0, .2], [x * 1.25, .0], [x * 1.1, -.2]], tono(c, .8), .012);
      K.hueco(-.1, .02, .052, .045).hueco(.1, .02, .052, .045);
      K.poli([[-.17, .02], [-.1, .09], [-.04, .02]], null, d, .012).poli([[.04, .02], [.1, .09], [.17, .02]], null, d, .012);
      K.poli([[-.025, -.07], [0, -.035], [.025, -.07]], d);
      K.poli([[-.13, -.115], [-.08, -.1], [-.05, -.13], [0, -.1], [.05, -.13], [.08, -.1], [.13, -.115], [.1, -.17], [.05, -.15], [0, -.18], [-.05, -.15], [-.1, -.17]], y, d, .008);
    });
    const g = cab(ctx);
    cil(.018, .026, .08, M('#3E8E3A', { roughness: .8 }), 0, .3, .02, g, 8).rotation.x = -.2;
  });

  R('cara', 'mascara_vampiro', 'Máscara de vampiro', 'Monstruos', { principal: '#E6DDE8', secundario: '#2A1030', acento: '#B3262E' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), d = ctx.col('secundario');
      K.todo(c); K.hueco(-.1, .02, .05, .044).hueco(.1, .02, .05, .044);
      K.poli([[-.25, .22], [-.1, .24], [0, .18], [.1, .24], [.25, .22], [.2, .2], [.08, .2], [0, .145], [-.08, .2], [-.2, .2]], d);
      for (const s of [-1, 1]) { K.linea([[s * .06, .09], [s * .12, .105], [s * .17, .09]], d, .016); K.ell(s * .1, -.015, .06, .016, 'rgba(120,60,130,.4)'); }
      K.ell(-.11, -.08, .03, .018, 'rgba(240,150,170,.45)').ell(.11, -.08, .03, .018, 'rgba(240,150,170,.45)');
    });
    const g = cab(ctx), F = M('#FFFFFF', { roughness: .3 });
    for (const s of [-1, 1]) cono(.011, .036, F, s * .033, -.128, .252, g, 8).rotation.x = PI;
  });

  R('cara', 'mascara_zombi', 'Máscara de zombi', 'Monstruos', { principal: '#9DB89A', secundario: '#4F5E52', acento: '#E8D9B8' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), d = ctx.col('secundario');
      K.todo(c); K.hueco(-.1, .02, .052, .045).hueco(.1, .02, .052, .045);
      for (const s of [-1, 1]) K.ell(s * .1, -.01, .062, .035, 'rgba(70,60,90,.45)').hueco(s * .1, .02, .052, .045);
      K.ell(-.15, -.085, .05, .035, 'rgba(110,60,60,.35)');
      K.linea([[.04, .2], [.1, .17]], d, .008); K.linea([[.05, .17], [.09, .2]], d, .008).linea([[.07, .165], [.07, .205]], d, .008);
      K.poli([[-.2, .12], [-.1, .17], [-.03, .12], [-.14, .09]], ctx.col('acento'), d, .005);
      K.linea([[-.2, .11], [-.03, .13]], 'rgba(60,70,60,.6)', .004);
      K.linea([[.13, -.09], [.2, -.05]], d, .006); for (const k of [0, 1, 2]) K.linea([[.14 + k * .022, -.1 + k * .014], [.15 + k * .022, -.05 + k * .014]], d, .005);
    });
  });

  R('cara', 'mascara_lobo', 'Máscara de lobo', 'Monstruos', { principal: '#8A7F78', secundario: '#E8DDD0', acento: '#2B2B30' }, (ctx) => {
    pintar(ctx, (K) => {
      const c = ctx.col('principal'), l = ctx.col('secundario'), d = ctx.col('acento');
      K.todo(c); K.hueco(-.1, .02, .052, .045).hueco(.1, .02, .052, .045);
      for (const s of [-1, 1]) K.ell(s * .1, .022, .068, .055, 'rgba(40,30,30,.55)').hueco(s * .1, .02, .052, .045);
      K.ell(0, -.1, .14, .1, l); K.linea([[-.04, .14], [0, .08], [.04, .14]], l, .03);
    });
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .95 }), L = ctx.mat('secundario', { roughness: .95 }), N = ctx.mat('acento', { roughness: .15 });
    elip(.065, .055, .09, L, 0, -.07, .295, g, 16); elip(.05, .03, .07, L, 0, -.135, .28, g, 12);
    esfera(.028, N, 0, -.045, .377, g, 12).scale.set(1.2, .9, 1);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) cono(.03, .08, P, s * (.19 + k * .004), -.12 + k * .035, .1 - k * .03, g, 6).rotation.z = -s * (PI / 2 + .3 - k * .2);
  }, { });

  R('cara', 'maquillaje_catrina', 'Maquillaje de catrina', 'Fiestas', { principal: '#FBF7F0', secundario: '#1B1B22', acento: '#E8559A' }, (ctx) => {
    pintar(ctx, (K) => {
      const w = ctx.col('principal'), d = ctx.col('secundario'), a = ctx.col('acento');
      K.ell(0, .0, .215, .27, w); K.hueco(-.1, .02, .05, .044).hueco(.1, .02, .05, .044);
      for (const s of [-1, 1]) {
        K.ell(s * .1, .02, .088, .075, null, 0, d, .01).hueco(s * .1, .02, .05, .044);
        K.ell(s * .1, .02, .088, .075, null, 0, d, .01);
        for (let k = 0; k < 8; k++) { const an = k * PI / 4 + .2; K.ell(s * .1 + Math.cos(an) * .085, .02 + Math.sin(an) * .072, .02, .012, a, an); }
        for (let k = 0; k < 8; k++) { const an = k * PI / 4; K.ell(s * .1 + Math.cos(an) * .13, .02 + Math.sin(an) * .115, .012, .007, d, an); }
        K.estrella(s * .1, .115, .02, a); K.ell(s * .1, .115, .006, .006, '#F2C14E');
        K.ell(s * .17, -.07, .025, .018, 'rgba(232,85,154,.45)');
      }
      K.poli([[-.02, -.03], [0, -.065], [.02, -.03]], d);
      K.linea([[-.1, -.158], [-.06, -.172], [0, -.176], [.06, -.172], [.1, -.158]], d, .006);
      for (let x = -.08; x <= .081; x += .02) K.linea([[x, -.165], [x, -.185]], d, .005);
      K.linea([[0, .21], [0, .15]], a, .008); K.ell(0, .15, .012, .012, '#F2C14E');
      for (const [x, y] of [[-.05, .19], [.05, .19], [-.09, .17], [.09, .17]]) K.ell(x, y, .01, .01, d);
    });
  });

  R('cara', 'pintura_gatito', 'Pintura de gatito', 'Fiestas', { principal: '#2B2B30', secundario: '#F4A7B9' }, (ctx) => {
    pintar(ctx, (K) => {
      const d = ctx.col('principal'), p = ctx.col('secundario');
      K.poli([[-.022, -.03], [.022, -.03], [0, -.055]], p, d, .004);
      K.linea([[0, -.055], [0, -.08]], d, .004).linea([[0, -.08], [-.03, -.095]], d, .004).linea([[0, -.08], [.03, -.095]], d, .004);
      for (const s of [-1, 1]) { for (const [dy, ang] of [[.02, .25], [.0, 0], [-.02, -.25]]) K.linea([[s * .09, -.065 + dy * .5], [s * .14, -.07 + dy + ang * .03], [s * .21, -.07 + dy * 1.8 + ang * .08]], d, .004); K.ell(s * .13, -.04, .03, .018, 'rgba(244,167,185,.45)'); }
    });
  });

  R('cara', 'pintura_peru', 'Pintura Perú', 'Fiestas', { principal: '#D91023', secundario: '#FFFFFF' }, (ctx) => {
    pintar(ctx, (K) => {
      const r = ctx.col('principal'), w = ctx.col('secundario'), w1 = w;
      for (const s of [-1, 1]) {
        const x0 = s * .1, w = s * .0175;
        for (let k = 0; k < 3; k++) K.poli([[x0 + w * k, -.055], [x0 + w * (k + 1), -.055], [x0 + w * (k + 1), -.125], [x0 + w * k, -.125]], k === 1 ? w1 : r);
        K.poli([[x0, -.055], [x0 + w * 3, -.055], [x0 + w * 3, -.125], [x0, -.125]], null, 'rgba(0,0,0,.2)', .003);
      }
      K.poli([[-.12, .17], [.12, .17], [.12, .2], [-.12, .2]], r); K.poli([[-.04, .17], [.04, .17], [.04, .2], [-.04, .2]], w);
    });
  });

  R('cara', 'orejas_puntiagudas', 'Orejas de elfo', 'Fantasía', { principal: '#F2C9A0' }, (ctx) => {
    const g = cab(ctx), P = M(ctx.col('principal'), { roughness: .55 });
    for (const s of [-1, 1]) { const c = cono(.05, .16, P, s * .31, .04, -.005, g, 14); c.rotation.z = -s * (PI / 2 - .55); c.scale.z = .35; }
  });

  R('cara', 'mascarilla', 'Mascarilla', 'Básico', { principal: '#8FCBE8', secundario: '#FFFFFF' }, (ctx) => {
    const g = cab(ctx), P = ctx.mat('principal', { roughness: .85, side: DS }), S = ctx.mat('secundario', { roughness: .9 });
    const geo = new T.BoxGeometry(.3, .15, .02, 10, 4, 1); deformar(geo, (x, y, z) => [x, y, z + .3 - 2.9 * x * x - 1.2 * (y + .03) * (y + .03) * (y > 0 ? 0 : 0)]);
    const m = malla(geo, P, 0, -.075, 0, g);
    for (const y of [-.03, .0, .03]) { const l = caja(.28, .004, .004, S, 0, -.075 + y, .289, g); }
    for (const s of [-1, 1]) rama([V(s * .15, -.07, .2), V(s * .22, -.02, .13), V(s * .262, .0, .0)], .004, .004, S, g);
  });

  /* =================================================================
   * ACCESORIOS: capas, alas, colas, objetos en la mano
   * ================================================================= */
  const cu = (ctx) => ctx.partes.cuerpo;
  /** Tira de capa que cuelga de los hombros; devuelve poner(t) para ondularla. */
  function capaTira(ctx, o, v0, v1, dr, mat) {
    const NU = 18, NV = Math.max(2, Math.round(12 * (v1 - v0) + 1));
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3), idx = [];
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const poner = (t) => {
      let k = 0;
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const u = i / NU * 2 - 1, v = v0 + (v1 - v0) * j / NV, y = o.y0 - v * (o.y0 - o.y1);
        const w = Math.sin(t * 2.2 + v * 5 + u * 3) * .012 * v + Math.sin(t * 1.3 + u * 7) * .006 * v;
        const r = ctx.H.radioTorso(Math.max(.5, y)) + .035 + o.vuelo * v * v + w + dr, a = u * o.ab * (1 + (o.ensancha || 0) * v);
        pos[k++] = Math.sin(a) * r * ctx.partes.ancho; pos[k++] = y; pos[k++] = -Math.cos(a) * r * .8 - v * (o.atras || .05);
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    };
    poner(0);
    const m = malla(geo, mat, 0, 0, 0, cu(ctx)); m.material.side = DS; return poner;
  }
  function capa(ctx, o) {
    const P = ctx.mat('principal', { roughness: .6, side: DS }), F = ctx.mat('secundario', { roughness: .65, side: DS });
    const f = [capaTira(ctx, o, 0, 1, 0, P), capaTira(ctx, o, 0, 1, -.007, F)];
    if (o.ribete) f.push(capaTira(ctx, o, .93, 1, .004, M(ctx.col(o.ribete), { roughness: .5, side: DS })));
    const c = cu(ctx);
    if (o.broche !== false) {
      for (const s of [-1, 1]) esfera(.028, ctx.mat('acento', brillo()), s * .075, 1.11, .075, c, 12);
      const ca = ctx.mat('acento', brillo()); rama([V(-.075, 1.11, .08), V(0, 1.075, .115), V(.075, 1.11, .08)], .005, .005, ca, c);
    }
    if (o.cuello) {
      const pts = [[.1, 1.1], [.15, 1.2], [.2, 1.32]].map(([x, y]) => new T.Vector2(x, y));
      const l = malla(new T.LatheGeometry(pts, 20, PI - 1.1, 2.2), ctx.mat('secundario', { roughness: .6, side: DS }), 0, 0, 0, c); l.scale.z = .8;
      const l2 = malla(new T.LatheGeometry(pts.map((p) => new T.Vector2(p.x + .006, p.y)), 20, PI - 1.1, 2.2), P, 0, 0, 0, c); l2.scale.z = .8;
    }
    return { animar(t) { f.forEach((p) => p(t)); } };
  }
  R('accesorio', 'capa_heroe', 'Capa de héroe', 'Capas', { principal: '#D32F2F', secundario: '#8E1B1B', acento: dorado }, (ctx) => capa(ctx, { y0: 1.1, y1: .42, vuelo: .2, ab: 1.05, atras: .09, ribete: 'acento' }));
  R('accesorio', 'capa_vampiro', 'Capa de vampiro', 'Capas', { principal: '#16161C', secundario: '#A3162A', acento: '#C9C9D2' }, (ctx) => capa(ctx, { y0: 1.1, y1: .12, vuelo: .3, ab: 1.05, atras: .1, cuello: true }));
  R('accesorio', 'capa_princesa', 'Capa de princesa', 'Capas', { principal: '#7B3FA0', secundario: '#F4E6FF', acento: '#FFFFFF' }, (ctx) => {
    const r = capa(ctx, { y0: 1.1, y1: .38, vuelo: .22, ab: 1.05, atras: .08, ribete: 'acento', broche: false }), c = cu(ctx);
    const F = ctx.mat('acento', { roughness: 1 });
    for (let i = 0; i < 12; i++) { const a = -1.1 + i * 2.2 / 11; elip(.045, .04, .04, F, Math.sin(a) * .15, 1.105, Math.cos(a) * .115 * .8 * 1.1, c, 10); }
    for (const s of [-1, 1]) esfera(.022, ctx.mat('acento', brillo()), s * .06, 1.1, .1, c, 10);
    return r;
  });

  function alaPluma(g, mat, mat2, L, ang, y, s) {
    const f = grupo(g, 0, y, 0); f.rotation.z = s * ang;
    const c = capsula(.032, L, mat, 0, L / 2 + .02, 0, f); c.scale.z = .35; c.scale.x = 1.1;
    return f;
  }
  R('accesorio', 'alas_angel', 'Alas de ángel', 'Alas', { principal: '#FFFFFF', secundario: '#EAF3FF' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .7 }), S = ctx.mat('secundario', { roughness: .75 }), wings = [];
    for (const s of [-1, 1]) {
      const w = grupo(cu(ctx), s * .06, .97, -.18), a = grupo(w); w.rotation.y = s * .45; wings.push([w, s]);
      for (let i = 0; i < 7; i++) { const f = grupo(a); f.rotation.z = -s * (.35 + i * .22); const L = .58 - i * .035; const c = capsula(.036, L, P, 0, L / 2 + .06, 0, f); c.scale.z = .3; }
      for (let i = 0; i < 6; i++) { const f = grupo(a, s * .02, -.04, .015); f.rotation.z = -s * (.5 + i * .24); const L = .36 - i * .025; const c = capsula(.032, L, S, 0, L / 2 + .04, 0, f); c.scale.z = .3; }
      for (let i = 0; i < 5; i++) { const f = grupo(a, s * .03, -.07, .03); f.rotation.z = -s * (.6 + i * .28); elip(.04, .09, .02, P, 0, .12, 0, f, 8); }
      elip(.05, .06, .03, P, s * .04, .06, 0, a, 8);
    }
    return { animar(t) { wings.forEach(([w, s]) => { w.rotation.y = s * (.45 + Math.sin(t * 3) * .1); }); } };
  });

  R('accesorio', 'alas_hada', 'Alas de hada', 'Alas', { principal: '#FF9BD2', secundario: '#8FD3FF' }, (ctx) => {
    const wings = [];
    const tex = (c1, c2) => texCanvas(128, 128, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, c1 + 'cc'); gr.addColorStop(1, c2 + '66');
      c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, DOS); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.stroke();
      for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * .4; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * 58, h / 2 + Math.sin(a) * 58); c.stroke(); }
    });
    const ta = tex(ctx.col('principal'), ctx.col('secundario')), tb = tex(ctx.col('secundario'), ctx.col('principal'));
    for (const s of [-1, 1]) {
      const w = grupo(cu(ctx), s * .05, .98, -.17); w.rotation.y = s * .5; wings.push([w, s]);
      const mk = (tx, sx, sy, cx, cy, rz) => { const m = malla(new T.CircleGeometry(1, 28), new T.MeshStandardMaterial({ map: tx, transparent: true, side: DS, roughness: .3, depthWrite: false, emissive: 0x442244, emissiveIntensity: .25 }), cx * s, cy, 0, w); m.scale.set(sx, sy, 1); m.rotation.z = rz * s; m.castShadow = false; };
      mk(ta, .17, .27, .2, .24, -.9); mk(tb, .11, .18, .14, -.14, -.5);
    }
    return { animar(t) { wings.forEach(([w, s]) => { w.rotation.y = s * (.5 + Math.sin(t * 9) * .18); }); } };
  });

  R('accesorio', 'alas_murcielago', 'Alas de murciélago', 'Alas', { principal: '#3B1C4A', secundario: '#6B2D7A' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .7, side: DS }), S = ctx.mat('secundario', { roughness: .5 }), wings = [];
    const W = V(.28, .2, 0), F = [V(.62, .34, 0), V(.68, .02, 0), V(.5, -.3, 0)];
    const sh = new T.Shape(); [[0, 0], [W.x, W.y], [F[0].x, F[0].y], [.46, .1], [F[1].x, F[1].y], [.5, -.12], [F[2].x, F[2].y], [.2, -.12]].forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
    for (const s of [-1, 1]) {
      const w = grupo(cu(ctx), s * .05, .98, -.17); w.rotation.y = s * .6; wings.push([w, s]);
      const a = grupo(w); a.scale.x = s;
      malla(new T.ShapeGeometry(sh), P, 0, 0, 0, a);
      rama([V(0, 0, 0), W.clone().multiplyScalar(.5), W], .02, .013, S, a);
      F.forEach((f) => rama([W.clone(), W.clone().lerp(f, .5), f], .011, .004, S, a));
      cono(.01, .04, S, F[0].x + .015, F[0].y + .015, 0, a, 6).rotation.z = -1;
    }
    return { animar(t) { wings.forEach(([w, s]) => { w.rotation.y = s * (.6 + Math.sin(t * 4) * .15); }); } };
  });

  R('accesorio', 'cola_dino', 'Cola de dinosaurio', 'Colas', { principal: '#4FAF5A', secundario: '#E8A33D' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .7 }), E = ctx.mat('secundario', { roughness: .6 });
    const t = grupo(cu(ctx), 0, .6, -.14), pts = [V(0, 0, 0), V(0, -.01, -.1), V(0, -.03, -.22), V(0, -.07, -.34), V(0, -.12, -.45), V(0, -.15, -.56), V(0, -.14, -.66)];
    rama(pts, .085, .012, P, t);
    pts.slice(0, 6).forEach((p, i) => { const k = 1 - i * .12; const c = cono(.04 * k, .09 * k, E, p.x, p.y + .08 * k + .01, p.z, t, 4); c.rotation.y = PI / 4; c.scale.x = .5; });
    return { animar(tm) { t.rotation.y = Math.sin(tm * 2) * .22; } };
  });

  R('accesorio', 'cola_diablo', 'Cola de diablillo', 'Colas', { principal: '#D32F2F' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .4 }), t = grupo(cu(ctx), 0, .6, -.15);
    const pts = [V(0, 0, 0), V(0, -.07, -.1), V(0, -.15, -.2), V(0, -.15, -.32), V(0, -.06, -.4), V(0, .05, -.42)];
    rama(pts, .02, .011, P, t);
    const a = cono(.045, .09, P, 0, 0, 0, t, 3); a.position.set(0, .1, -.42); a.scale.z = .35; a.rotation.y = 0;
    for (const s of [-1, 1]) { const b = cono(.03, .06, P, s * .028, .085, -.42, t, 3); b.scale.z = .35; b.rotation.z = -s * .6; }
    return { animar(tm) { t.rotation.y = Math.sin(tm * 3) * .25; } };
  });

  R('accesorio', 'cola_lobo', 'Cola de lobo', 'Colas', { principal: '#8A7F78', secundario: '#E8DDD0' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: 1 }), L = ctx.mat('secundario', { roughness: 1 }), t = grupo(cu(ctx), 0, .62, -.15);
    elip(.07, .1, .07, P, 0, -.04, -.07, t, 14).rotation.x = -.7; elip(.09, .13, .09, P, 0, -.17, -.15, t, 14).rotation.x = -.4; elip(.07, .11, .07, L, 0, -.3, -.19, t, 14).rotation.x = -.15;
    return { animar(tm) { t.rotation.y = Math.sin(tm * 2.5) * .25; } };
  });

  /** Objeto en la mano i (0 = derecha del avatar): grupo compensado para que quede vertical. */
  const mano = (ctx, i, dx = 0, dz = .01) => { const g = grupo(ctx.partes.codos[i], dx, -.195, dz); g.rotation.z = i === 0 ? .1 : -.1; return g; };

  R('accesorio', 'escoba_bruja', 'Escoba de bruja', 'En la mano', { principal: '#7A4B2A', secundario: '#D9B15A', acento: '#5B3A29' }, (ctx) => {
    const h = mano(ctx, 0, 0, .0), P = ctx.mat('principal', { roughness: .8 }), B = ctx.mat('secundario', { roughness: 1 });
    cil(.014, .016, 1.42, P, 0, .1, 0, h, 10);
    cil(.04, .115, .34, B, 0, -.46, 0, h, 16); cil(.0, .04, .08, B, 0, -.26, 0, h, 12);
    for (let k = 0; k < 10; k++) { const a = k * DOS / 10; cono(.012, .1, B, Math.sin(a) * .1, -.65, Math.cos(a) * .1, h, 5).rotation.z = Math.sin(a) * .3; }
    toro(.045, .014, ctx.mat('acento', { roughness: .7 }), 0, -.31, 0, h);
  });

  const estrella3D = (r, rin, prof) => { const sh = new T.Shape(); for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, rr = i % 2 ? rin : r; i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new T.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 1 }); };
  R('accesorio', 'varita_magica', 'Varita mágica', 'En la mano', { principal: '#2B2038', secundario: '#FFD84A' }, (ctx) => {
    const h = mano(ctx, 0), w = grupo(h); w.rotation.x = 1.1; w.position.z = .02;
    cil(.011, .013, .5, ctx.mat('principal', { roughness: .4 }), 0, .17, 0, w, 10);
    const gl = new T.MeshStandardMaterial({ color: ctx.col('secundario'), emissive: ctx.col('secundario'), emissiveIntensity: .7, roughness: .3 });
    const st = malla(estrella3D(.09, .038, .016), gl, 0, .47, -.008, w);
    cil(.016, .016, .05, ctx.mat('secundario', brillo()), 0, -.05, 0, w, 10);
    const ch = []; for (let k = 0; k < 4; k++) ch.push(esfera(.009, gl, 0, .47, 0, w, 6));
    return { animar(t) { gl.emissiveIntensity = .6 + Math.sin(t * 5) * .35; ch.forEach((c, k) => { const a = t * 2 + k * PI / 2; c.position.set(Math.cos(a) * .12, .47 + Math.sin(a * 1.3) * .07, Math.sin(a) * .03); }); } };
  });

  R('accesorio', 'baston_caramelo', 'Bastón de caramelo', 'En la mano', { principal: '#D32F2F', secundario: '#FFFFFF' }, (ctx) => {
    const h = mano(ctx, 0), mats = [ctx.mat('principal', { roughness: .25 }), ctx.mat('secundario', { roughness: .25 })];
    const pts = [V(0, -.3, 0)]; for (let y = -.2; y <= .3; y += .1) pts.push(V(0, y, 0));
    for (let k = 1; k <= 6; k++) { const a = k * PI / 6; pts.push(V(0, .3 + Math.sin(a) * .08, Math.cos(a) * .08 - .08 + .0)); }
    rama(pts.map((p) => V(p.x, p.y, p.z + (p.z === 0 ? 0 : 0))), .02, .02, mats[0], h, mats);
  });

  function calabaza3D(g, mat, r, sy = .85) {
    for (let k = 0; k < 6; k++) { const e = elip(r * .62, r * sy, r * .75, mat, 0, 0, 0, g, 14); e.rotation.y = k * PI / 6 * 1; }
  }
  R('accesorio', 'bolsa_calabaza', 'Bolsa de dulces de calabaza', 'En la mano', { principal: '#F28A1E', secundario: '#3E8E3A', acento: '#FFD84A' }, (ctx) => {
    const h = mano(ctx, 0, -.06, .05), P = ctx.mat('principal', { roughness: .5 }), S = ctx.mat('secundario', { roughness: .8 });
    const b = grupo(h, 0, -.17, 0); calabaza3D(b, P, .12, .9);
    cil(.016, .022, .04, S, 0, .115, 0, b, 8);
    toro(.1, .006, M('#444444', { metalness: .6, roughness: .4 }), 0, .02, 0, h, 0, PI);
    const ojo = M('#2B1608', { roughness: .8 });
    for (const s of [-1, 1]) cono(.02, .03, ojo, s * .045, .03, .112, b, 3).rotation.set(0, 0, 0);
    caja(.07, .015, .01, ojo, 0, -.04, .113, b);
    for (const [x, c] of [[-.03, '#E8559A'], [0, '#6FD3FF'], [.03, '#FFD84A']]) esfera(.016, M(c, { roughness: .3 }), x, .085, .0, b, 8);
  });

  R('accesorio', 'bufanda', 'Bufanda', 'Cuello', { principal: '#C0392B', secundario: '#FFFFFF' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: 1 }), S = ctx.mat('secundario', { roughness: 1 });
    toro(.09, .036, P, 0, 1.12, 0, c).rotation.x = PI / 2 + .12; toro(.092, .028, S, 0, 1.09, .01, c).rotation.x = PI / 2 - .1;
    elip(.05, .04, .04, P, .07, 1.075, .1, c, 10);
    const t = grupo(c, .075, 1.06, .115); t.rotation.set(-.05, 0, .06);
    caja(.085, .42, .024, P, 0, -.2, 0, t);
    for (const y of [-.12, -.22, -.32]) caja(.087, .04, .026, S, 0, y, 0, t);
    for (let k = -2; k <= 2; k++) caja(.012, .05, .01, P, k * .017, -.43, 0, t);
  });

  R('accesorio', 'mochila', 'Mochila', 'Espalda', { principal: '#2E7BD6', secundario: '#1B1B22', acento: '#F2C14E' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: .7 }), D = ctx.mat('secundario', { roughness: .7 });
    const b = caja(.28, .34, .12, P, 0, .88, -.21, c); b.geometry.dispose(); b.geometry = new T.BoxGeometry(.28, .34, .12, 1, 1, 1);
    elip(.15, .06, .07, P, 0, 1.04, -.21, c, 14); caja(.2, .14, .03, D, 0, .8, -.285, c); caja(.22, .016, .031, ctx.mat('acento'), 0, .82, -.285, c);
    for (const s of [-1, 1]) { rama([V(s * .09, 1.06, -.19), V(s * .1, 1.12, -.02), V(s * .09, 1.04, .14), V(s * .095, .86, .17)], .017, .017, D, c); caja(.04, .03, .02, D, s * .095, .86, .17, c); }
  });

  R('accesorio', 'lazo_pajarita', 'Pajarita', 'Cuello', { principal: '#B3262E', secundario: '#FFFFFF' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: .5 });
    const g = grupo(c, 0, 1.1, .1);
    for (const s of [-1, 1]) { const l = cono(.05, .08, P, s * .045, 0, 0, g, 4); l.rotation.z = s * PI / 2; l.rotation.y = PI / 4; l.scale.set(1, 1, .5); }
    esfera(.02, P, 0, 0, .006, g, 10);
  });

  R('accesorio', 'collar_perlas', 'Collar de perlas', 'Cuello', { principal: '#FFF7EC', secundario: '#E8559A' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: .15, metalness: .1 });
    for (let i = 0; i < 17; i++) { const a = -1.4 + i * 2.8 / 16, y = 1.085 - Math.sin(i / 16 * PI) * .08; esfera(.016, P, 0, 0, 0, c, 8).position.copy(ctx.H.sobreTorso(y, a, .03)); }
    esfera(.028, ctx.mat('secundario', { roughness: .1, emissive: ctx.col('secundario'), emissiveIntensity: .3 }), 0, 0, 0, c, 12).position.copy(ctx.H.sobreTorso(1.0, 0, .04));
  });

  R('accesorio', 'guitarra', 'Guitarra pequeña', 'Música', { principal: '#C9792B', secundario: '#4A2C1D', acento: '#1B1B22' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: .35 }), D = ctx.mat('secundario', { roughness: .5 }), N = ctx.mat('acento', { roughness: .5 });
    const g = grupo(c, -.02, .62, .2); g.rotation.set(.12, 0, -.95);
    elip(.095, .11, .035, P, 0, -.04, 0, g, 18); elip(.075, .08, .035, P, 0, .08, 0, g, 18);
    cil(.032, .032, .012, N, 0, 0, .033, g, 16).rotation.x = PI / 2; toro(.034, .006, D, 0, 0, .036, g, 0);
    caja(.04, .26, .02, D, 0, .27, .0, g); caja(.056, .09, .02, D, 0, .45, 0, g);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) cil(.006, .006, .02, N, s * .04, .42 + k * .03, 0, g, 6).rotation.z = PI / 2;
    for (let k = 0; k < 4; k++) caja(.002, .5, .002, M('#E8E8E8'), (k - 1.5) * .008, .1, .02, g);
    rama([V(.2, 1.07, -.02), V(.1, .98, .17), V(-.05, .8, .19), V(-.15, .62, .12)], .01, .01, D, c);
  });

  R('accesorio', 'bandera_peru', 'Bandera de Perú', 'En la mano', { principal: '#D91023', secundario: '#FFFFFF' }, (ctx) => {
    const h = mano(ctx, 1, 0, .0);
    cil(.012, .012, .8, ctx.mat('secundario', brillo({ roughness: .4 })), 0, .1, 0, h, 8); esfera(.02, ctx.mat('secundario', brillo()), 0, .51, 0, h, 8);
    const tex = texCanvas(120, 80, (c, w, hh) => { c.fillStyle = ctx.col('principal'); c.fillRect(0, 0, w, hh); c.fillStyle = ctx.col('secundario'); c.fillRect(w / 3, 0, w / 3, hh); c.strokeStyle = '#6B4A2A'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, hh / 2, 11, 0, DOS); c.stroke(); c.fillStyle = '#3E8E3A'; c.beginPath(); c.arc(w / 2, hh / 2, 6, 0, DOS); c.fill(); });
    const geo = new T.PlaneGeometry(.34, .22, 14, 6), pos = geo.attributes.position, base = Float32Array.from(pos.array);
    const f = malla(geo, new T.MeshStandardMaterial({ map: tex, side: DS, roughness: .8 }), .19, .38, 0, h);
    return { animar(t) { for (let i = 0; i < pos.count; i++) { const x = base[i * 3] + .17; pos.setZ(i, Math.sin(x * 22 - t * 6) * .014 * (x / .34)); } pos.needsUpdate = true; geo.computeVertexNormals(); } };
  });

  R('accesorio', 'mochila_cohete', 'Mochila cohete', 'Espacio', { principal: '#E6E9EE', secundario: '#E8742A', acento: '#8FE9FF' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: .4 }), O = ctx.mat('secundario', { roughness: .5 });
    caja(.3, .4, .14, P, 0, .86, -.22, c);
    for (const s of [-1, 1]) {
      cil(.05, .05, .5, O, s * .1, .72, -.3, c, 14); cono(.05, .09, O, s * .1, 1.0, -.3, c, 14);
      cil(.05, .035, .06, M('#555B66', { metalness: .6, roughness: .4 }), s * .1, .44, -.3, c, 14);
      cono(.035, .12, M('#FFB02E', { emissive: '#FF7A1E', emissiveIntensity: .9 }), s * .1, .35, -.3, c, 10).rotation.x = PI;
    }
    caja(.22, .05, .03, O, 0, .94, -.295, c); esfera(.015, ctx.mat('acento', { emissive: ctx.col('acento'), emissiveIntensity: .8 }), .06, .94, -.312, c, 8);
    for (const s of [-1, 1]) rama([V(s * .09, 1.06, -.19), V(s * .1, 1.12, -.02), V(s * .09, 1.04, .14), V(s * .095, .88, .17)], .016, .016, ctx.mat('secundario'), c);
  });

  R('accesorio', 'saco_regalos', 'Saco de regalos', 'Navidad', { principal: '#9B6A3C', secundario: '#D32F2F', acento: '#2E8B57' }, (ctx) => {
    const c = cu(ctx), P = ctx.mat('principal', { roughness: 1 });
    const g = grupo(c, -.02, .78, -.25); g.rotation.x = .1;
    elip(.2, .27, .17, P, 0, 0, 0, g, 18); elip(.1, .1, .08, P, 0, .27, 0, g, 12);
    toro(.07, .016, ctx.mat('secundario', { roughness: .6 }), 0, .21, 0, g);
    for (const [x, col] of [[-.04, 'secundario'], [.04, 'acento']]) caja(.07, .07, .07, ctx.mat(col, { roughness: .6 }), x, .36, .0, g).rotation.set(.3, x * 8, .2);
    rama([V(.12, 1.06, -.12), V(.2, 1.1, -.2), V(.12, 1.0, -.32)], .008, .008, P, c);
  });

  R('accesorio', 'espada_pirata', 'Espada pirata', 'En la mano', { principal: '#C9CED8', secundario: '#C9A227', acento: '#4A2C1D' }, (ctx) => {
    const h = mano(ctx, 0), w = grupo(h); w.rotation.x = 1.25; w.position.z = .02;
    cil(.014, .014, .1, ctx.mat('acento', { roughness: .6 }), 0, 0, 0, w, 8); esfera(.022, ctx.mat('secundario', brillo()), 0, -.06, 0, w, 10);
    caja(.14, .014, .04, ctx.mat('secundario', brillo()), 0, .06, 0, w);
    const b = caja(.034, .52, .008, ctx.mat('principal', brillo({ roughness: .2, metalness: .9 })), 0, .33, 0, w);
    cono(.017, .06, ctx.mat('principal', brillo({ roughness: .2, metalness: .9 })), 0, .62, 0, w, 4).scale.z = .25;
  });

  /* =================================================================
   * PRENDAS ESPECIALES dz_* (arriba, abajo, calzado) que usan los disfraces
   * ================================================================= */
  const torsoPar = (ctx, desde, hasta, hol, mat, phi0, phiLen, ensanche = 0) => {
    const pts = [];
    for (let k = 0; k <= 14; k++) { const y = desde + (hasta - desde) * k / 14; pts.push(new T.Vector2(ctx.H.radioTorso(y) + hol + ensanche * Math.pow(1 - k / 14, 2), y)); }
    const m = malla(new T.LatheGeometry(pts, 36, phi0, phiLen), mat, 0, 0, 0, ctx.partes.cuerpo); m.scale.set(ctx.partes.ancho, 1, .8); return m;
  };
  const abierta = (ctx, desde, hasta, hol, mat, gap = .3, ensanche = 0) => torsoPar(ctx, desde, hasta, hol, mat, gap, DOS - 2 * gap, ensanche);
  const sobre = (ctx, m, y, a = 0, hol = .01) => { const p = ctx.H.sobreTorso(y, a, hol); m.position.copy(p); m.rotation.y = a; return m; };
  function cinta(ctx, y0, a0, y1, a1, w, mat, hol = .012) {
    const N = 18, pos = [], idx = [];
    for (let k = 0; k <= N; k++) { const t = k / N, y = y0 + (y1 - y0) * t, a = a0 + (a1 - a0) * t, p = ctx.H.sobreTorso(y + w / 2, a, hol), q = ctx.H.sobreTorso(y - w / 2, a, hol); pos.push(p.x, p.y, p.z, q.x, q.y, q.z); if (k < N) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = malla(g, mat, 0, 0, 0, ctx.partes.cuerpo); m.material = mat; return m;
  }
  const botones = (ctx, ys, mat, r = .014, hol = .012) => ys.forEach((y) => sobre(ctx, esfera(r, mat, 0, 0, 0, ctx.partes.cuerpo, 10), y, 0, hol));
  const mangas = (ctx, hasta, slot, o = {}) => [0, 1].forEach((i) => ctx.H.manga(i, Object.assign({ hasta, mat: ctx.mat(slot, { roughness: .75 }) }, o)));
  const cintura = (ctx, y, mat, hol = .02, tubo = .016) => { const m = toro(ctx.H.radioTorso(y) + hol, tubo, mat, 0, y, 0, ctx.partes.cuerpo); m.scale.set(ctx.partes.ancho, .8, 1); return m; };
  const estrellaTorso = (ctx, y, a, r, mat) => { const m = malla(estrella3D(r, r * .45, .008), mat, 0, 0, 0, ctx.partes.cuerpo); return sobre(ctx, m, y, a, .002); };
  const cuadros = (c1, c2, c3) => texCanvas(64, 64, (c, w, h) => { c.fillStyle = c1; c.fillRect(0, 0, w, h); c.fillStyle = c2 + 'bb'; c.fillRect(0, 12, w, 14); c.fillRect(12, 0, 14, h); c.fillStyle = c3 + '88'; c.fillRect(0, 44, w, 4); c.fillRect(44, 0, 4, h); }, [3, 2]);
  const rayas = (c1, c2, n = 6) => texCanvas(16, 64, (c, w, h) => { c.fillStyle = c1; c.fillRect(0, 0, w, h); c.fillStyle = c2; for (let y = 0; y < h; y += h / n * 2) c.fillRect(0, y, w, h / n); }, [1, 3]);

  R('arriba', 'dz_corse_princesa', 'Corpiño de princesa', 'Disfraces', { principal: '#F48FB1', secundario: '#FFFFFF', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .45 }), S = ctx.mat('secundario', { roughness: .6 }), G = ctx.mat('acento', brillo());
    ctx.H.torso({ desde: .62, hasta: 1.07, mat: P, cerrado: false }); cintura(ctx, 1.07, S, .012, .014);
    cintura(ctx, .72, G, .018, .012);
    for (const s of [-1, 1]) { const b = ctx.partes.brazos[s < 0 ? 0 : 1]; esfera(.085, P, 0, -.02, 0, b, 16); toro(.062, .012, S, 0, -.11, 0, b); }
    esfera(.024, ctx.mat('secundario', { roughness: .15, emissive: ctx.col('secundario'), emissiveIntensity: .3 }), 0, 0, 0, c, 10).position.copy(ctx.H.sobreTorso(.93, 0, .012));
    const lazo = grupo(c); lazo.position.copy(ctx.H.sobreTorso(.74, 0, .028));
    for (const s of [-1, 1]) { const l = cono(.04, .07, G, s * .035, 0, 0, lazo, 4); l.rotation.z = s * PI / 2; l.scale.z = .5; }
    for (const [y, a] of [[.85, .4], [.85, -.4], [.78, .7], [.78, -.7]]) esfera(.011, S, 0, 0, 0, c, 8).position.copy(ctx.H.sobreTorso(y, a, .012));
  });

  R('arriba', 'dz_chaqueta_principe', 'Chaqueta de príncipe', 'Disfraces', { principal: '#1F4FBF', secundario: dorado, acento: '#B3262E' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .6 }), G = ctx.mat('secundario', brillo()), Rj = ctx.mat('acento', { roughness: .45, side: DS });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .05 }); mangas(ctx, 'larga', 'principal', { puño: G });
    ctx.H.cuello('alto', P); botones(ctx, [.7, .78, .86, .94, 1.02], G, .014, .056);
    cinta(ctx, 1.04, .85, .6, -.85, .075, Rj); cinta(ctx, 1.04, .85, .6, -.85, .012, G, .018);
    cintura(ctx, .64, ctx.mat('acento', { roughness: .5 }), .045, .014);
    for (let k = 0; k < 2; k++) { const b = ctx.partes.brazos[k]; caja(.1, .02, .09, G, 0, .06, 0, b); for (let q = -2; q <= 2; q++) cil(.004, .004, .04, G, q * .02, .04, .0, b, 4).position.z = .05; }
    esfera(.026, G, 0, 0, 0, c, 10).position.copy(ctx.H.sobreTorso(.92, .5, .016));
    for (const s of [-1, 1]) toro(.082, .012, G, 0, 1.14, 0, c).scale.set(1, 1, 1);
  });

  R('arriba', 'dz_corse_hielo', 'Corpiño de hielo', 'Disfraces', { principal: '#7FD4F5', secundario: '#FFFFFF', acento: '#DFF6FF' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .3, metalness: .2 }), S = ctx.mat('secundario', { roughness: .5 });
    ctx.H.torso({ desde: .6, hasta: 1.08, mat: P, cerrado: false });
    const gl = new T.MeshStandardMaterial({ color: ctx.col('acento'), emissive: ctx.col('acento'), emissiveIntensity: .7, roughness: .2 });
    cintura(ctx, 1.08, S, .012, .014);
    mangas(ctx, 'larga', 'acento', { mat: ctx.mat('acento', { roughness: .2, transparent: true, opacity: .55, depthWrite: false }) });
    for (let k = 0; k < 3; k++) { const l = caja(.07, .008, .004, gl, 0, 0, 0, c); sobre(ctx, l, .93, 0, .014); l.rotation.z = k * PI / 3; }
    for (const [y, a] of [[.7, .6], [.8, -.6], [.9, .9], [.72, -.2], [1.0, -.5], [1.0, .5], [.66, .2]]) sobre(ctx, esfera(.009, gl, 0, 0, 0, c, 6), y, a, .014);
  });

  R('arriba', 'dz_camisa_vaquero', 'Camisa y chaleco de vaquero', 'Disfraces', { principal: '#C0392B', secundario: '#8B5A2B', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo, tex = cuadros(ctx.col('principal'), '#FFFFFF', '#222222');
    const Ca = M('#FFFFFF', { map: tex, roughness: .9 }), Cu = ctx.mat('secundario', { roughness: .7, side: DS }), Y = ctx.mat('acento', brillo());
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: Ca }); mangas(ctx, 'larga', 'principal', { mat: Ca, puño: M(tono(ctx.col('principal'), .8)) }); ctx.H.cuello('camisa', Ca);
    abierta(ctx, .62, 1.07, .026, Cu, .33);
    for (const s of [-1, 1]) { const p = caja(.07, .012, .1, Cu, 0, 0, 0, c); p.position.copy(ctx.H.sobreTorso(1.07, s * 1.1, .03)); p.rotation.y = s * 1.1; }
    estrellaTorso(ctx, .9, .38, .04, Y);
    const b = caja(.13, .13, .008, ctx.mat('principal', { roughness: .8 }), 0, 1.04, .098, c); b.rotation.z = PI / 4; b.scale.set(.75, .75, 1); cil(.075, .075, .02, ctx.mat('principal', { roughness: .8 }), 0, 1.115, .02, c, 16).scale.z = .8;
    cintura(ctx, .62, ctx.mat('secundario', { roughness: .6 }), .028, .02);
  });

  R('arriba', 'dz_casaca_pirata', 'Casaca de pirata', 'Disfraces', { principal: '#B3262E', secundario: '#F4EAD0', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo, Rj = ctx.mat('principal', { roughness: .6, side: DS }), W = ctx.mat('secundario', { roughness: .9 }), G = ctx.mat('acento', brillo()), Bk = M('#1E1E26', { roughness: .6 });
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: W });
    abierta(ctx, .45, 1.08, .03, Rj, .42, .07); mangas(ctx, 'larga', 'principal', { puño: G, acampanada: .03 });
    for (const s of [-1, 1]) { const l = caja(.07, .02, .14, G, 0, 0, 0, c); l.position.copy(ctx.H.sobreTorso(1.0, s * .55, .04)); l.rotation.y = s * .55; l.rotation.x = .3; }
    for (const s of [-1, 1]) for (const y of [.62, .72, .82, .92]) esfera(.011, G, 0, 0, 0, c, 8).position.copy(ctx.H.sobreTorso(y, s * .42, .06));
    cintura(ctx, .66, Bk, .045, .022); caja(.06, .05, .014, G, 0, .66, ctx.H.radioTorso(.66) * .8 + .062, c);
    for (let k = 0; k < 4; k++) elip(.06 - k * .004, .028, .03, W, (k % 2 ? 1 : -1) * .01, 1.05 - k * .045, .1 + k * .008, c, 10);
    cinta(ctx, 1.03, .9, .6, -.9, .035, Bk, .075);
  });

  R('arriba', 'dz_vestido_bruja', 'Vestido de bruja', 'Disfraces', { principal: '#4B2A6B', secundario: '#1B1B22', acento: '#F28A1E' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .8 }), D = ctx.mat('secundario', { roughness: .7 }), O = ctx.mat('acento', { roughness: .7 });
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: P, ensanche: .02 }); mangas(ctx, 'larga', 'principal', { puño: D, acampanada: .04 });
    ctx.H.cuello('alto', D); cintura(ctx, .68, D, .028, .028); caja(.07, .06, .014, ctx.mat('acento', brillo()), 0, .68, ctx.H.radioTorso(.68) * .8 + .058, c);
    for (const [y, a, w] of [[.88, .5, .08], [.8, -.6, .06], [.95, -.3, .05]]) { const p = caja(w, w, .006, O, 0, 0, 0, c); sobre(ctx, p, y, a, .012); p.rotation.z = .3; }
    for (let k = 0; k < 6; k++) { const a = -.8 + k * .32, j = cono(.03, .08, P, 0, 0, 0, c, 3); sobre(ctx, j, .52, a, .03); j.rotation.x = PI; }
  });

  R('arriba', 'dz_tunica_mago', 'Túnica de mago', 'Disfraces', { principal: '#3B3A8E', secundario: '#F2C14E', acento: '#FFE680' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .7 }), G = ctx.mat('secundario', brillo()), St = new T.MeshStandardMaterial({ color: ctx.col('acento'), emissive: ctx.col('acento'), emissiveIntensity: .55, roughness: .4 });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .07 }); mangas(ctx, 'larga', 'principal', { puño: G, acampanada: .06 });
    ctx.H.cuello('redondo', G); cintura(ctx, .7, ctx.mat('secundario', { roughness: .6 }), .026, .02);
    rama([V(.045, .7, ctx.H.radioTorso(.7) * .8 + .035), V(.06, .6, ctx.H.radioTorso(.7) * .8 + .05), V(.055, .5, ctx.H.radioTorso(.7) * .8 + .05)], .008, .008, G, c);
    for (const [y, a, r] of [[.95, .5, .03], [.82, -.6, .03], [.9, -.2, .022], [.78, .35, .025], [.62, -.1, .028], [.58, .7, .02]]) estrellaTorso(ctx, y, a, r, St);
  });

  R('arriba', 'dz_frac_vampiro', 'Frac de vampiro', 'Disfraces', { principal: '#16161C', secundario: '#A3162A', acento: '#FFFFFF' }, (ctx) => {
    const c = ctx.partes.cuerpo, Bk = ctx.mat('principal', { roughness: .55, side: DS }), Rj = ctx.mat('secundario', { roughness: .5, side: DS }), W = ctx.mat('acento', { roughness: .7 });
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: W }); torsoPar(ctx, .62, 1.05, .02, Rj, -.5, 1);
    abierta(ctx, .5, 1.08, .034, Bk, .55, .02); mangas(ctx, 'larga', 'principal', { puño: W });
    const cola = caja(.17, .36, .02, Bk, 0, .4, -.15, c); cola.rotation.x = .12; const c2 = cola.clone(); c2.position.x = .06; cola.position.x = -.06;
    c.add(c2);
    for (const s of [-1, 1]) { const l = caja(.06, .02, .13, Bk, 0, 0, 0, c); l.position.copy(ctx.H.sobreTorso(1.0, s * .5, .045)); l.rotation.y = s * .5; l.rotation.x = .3; }
    for (let k = 0; k < 4; k++) elip(.055 - k * .006, .03, .03, W, 0, 1.06 - k * .05, .105 + k * .006, c, 10);
    esfera(.018, ctx.mat('secundario', { roughness: .15, emissive: ctx.col('secundario'), emissiveIntensity: .5 }), 0, 1.04, .13, c, 10);
    botones(ctx, [.75, .85], ctx.mat('acento', brillo()), .011, .04);
  });

  R('arriba', 'dz_chaqueta_monstruo', 'Chaqueta de monstruo', 'Disfraces', { principal: '#2A2A32', secundario: '#D9D9D9', acento: '#8D95A3' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .7 }), S = M('#E8E8E8', { roughness: .8 });
    ctx.H.torso({ desde: .6, hasta: 1.1, mat: P, ensanche: .03 }); mangas(ctx, 'codo', 'principal');
    for (let k = 0; k < 6; k++) { const m = caja(.014, .06, .006, ctx.mat('secundario', { roughness: .8 }), 0, 0, 0, c); sobre(ctx, m, .84, -.05 + k * .0, .02).position.x = (k - 2.5) * .028; m.position.z = ctx.H.radioTorso(.84) * .8 + .028; m.rotation.z = k % 2 ? .6 : -.6; m.rotation.y = 0; }
    for (const i of [0, 1]) { const co = ctx.partes.codos[i]; for (let k = 0; k < 5; k++) { const j = caja(.02, .05, .01, P, 0, 0, 0, co); j.position.set(Math.sin(k * 1.26) * .06, -.02, Math.cos(k * 1.26) * .06); j.rotation.y = k * 1.26; } }
    for (let k = 0; k < 7; k++) { const j = cono(.03, .07, P, 0, 0, 0, c, 3); sobre(ctx, j, .58, -.9 + k * .3, .04); j.rotation.x = PI; }
    cintura(ctx, 1.06, ctx.mat('acento', brillo({ roughness: .5 })), .01, .01);
  });

  R('arriba', 'dz_camisa_zombi', 'Camisa rasgada de zombi', 'Disfraces', { principal: '#6E7F78', secundario: '#4A3B30', acento: '#E8D9B8' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .95, side: DS }), Rg = ctx.mat('secundario', { roughness: 1, side: DS }), B = ctx.mat('acento', { roughness: .95 });
    ctx.H.torso({ desde: .64, hasta: 1.1, mat: P });
    ctx.H.manga(0, { hasta: 'larga', mat: P }); ctx.H.manga(1, { hasta: 'hombro', mat: P });
    for (let k = 0; k < 9; k++) { const a = -2.4 + k * .6, L = .1 + (k * 37 % 5) * .03; const j = caja(.07, L, .008, k % 3 ? P : Rg, 0, 0, 0, c); sobre(ctx, j, .64 - L / 2, a, .018); j.rotation.z = ((k * 13) % 5 - 2) * .08; }
    for (let k = 0; k < 4; k++) toro(.052, .012, B, 0, -.05 - k * .045, 0, ctx.partes.codos[1], PI / 2).scale.set(1, 1, 1);
    cinta(ctx, 1.02, -.9, .75, .9, .05, B, .026); caja(.05, .04, .01, Rg, 0, 0, 0, c).position.copy(ctx.H.sobreTorso(.9, -.5, .02));
  });

  R('arriba', 'dz_pelaje_lobo', 'Pelaje de lobo', 'Disfraces', { principal: '#8A7F78', secundario: '#E8DDD0', acento: '#5B4A3A' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: 1 }), L = ctx.mat('secundario', { roughness: 1 }), Rg = ctx.mat('acento', { roughness: .95, side: DS });
    ctx.H.torso({ desde: .62, hasta: 1.08, mat: Rg, cerrado: false }); mangas(ctx, 'corta', 'acento');
    abierta(ctx, .68, 1.1, .03, P, 1.0);
    for (let k = 0; k < 10; k++) { const a = -1.1 + k * .245, t = cono(.032, .08, P, 0, 0, 0, c, 5); sobre(ctx, t, 1.04 - (k % 2) * .06, a, .035); t.rotation.x = -.5; }
    for (let k = 0; k < 7; k++) elip(.05, .06, .04, L, (k - 3) * .028, .88 - Math.abs(k - 3) * .02, ctx.H.radioTorso(.88) * .8 + .03, c, 8);
    for (const i of [0, 1]) { const co = ctx.partes.codos[i]; cil(.07, .07, .06, P, 0, -.12, 0, co, 12); for (let k = 0; k < 6; k++) { const a = k * DOS / 6; cono(.022, .06, P, Math.sin(a) * .07, -.17, Math.cos(a) * .07, co, 5).rotation.x = PI; } }
  });

  R('arriba', 'dz_traje_calabaza', 'Traje de calabaza', 'Disfraces', { principal: '#F28A1E', secundario: '#3E8E3A', acento: '#FFD84A' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .5 }), V2 = ctx.mat('secundario', { roughness: .8, side: DS });
    ctx.H.torso({ desde: .85, hasta: 1.1, mat: V2 }); mangas(ctx, 'larga', 'secundario');
    const b = grupo(c, 0, .74, .02); for (let k = 0; k < 6; k++) { const e = elip(.11, .25, .2, P, 0, 0, 0, b, 16); e.rotation.y = k * PI / 6; }
    b.scale.set(1.3, 1, 1);
    for (let k = 0; k < 7; k++) { const a = k * DOS / 7, l = elip(.07, .02, .035, V2, Math.sin(a) * .1, 1.1, Math.cos(a) * .08, c, 8); l.rotation.set(-.4, a, 0); }
  });

  R('arriba', 'dz_mono_dino', 'Mono de dinosaurio', 'Disfraces', { principal: '#4FAF5A', secundario: '#F2E7A8', acento: '#E8A33D' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .8 }), W = ctx.mat('secundario', { roughness: .85 }), E = ctx.mat('acento', { roughness: .6 });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .03 }); mangas(ctx, 'larga', 'principal');
    elip(.13, .22, .03, W, 0, .8, ctx.H.radioTorso(.8) * .8 + .015, c, 14);
    for (let k = 0; k < 6; k++) { const y = 1.02 - k * .09, t = cono(.04 - k * .003, .09 - k * .007, E, 0, y, -(ctx.H.radioTorso(y) * .8 + .03), c, 4); t.rotation.x = -PI / 2 + .5; t.scale.x = .55; }
    for (const i of [0, 1]) { const co = ctx.partes.codos[i]; for (let k = -1; k <= 1; k++) cono(.012, .04, M('#FFFFFF'), k * .03, -.27, .0, co, 6).rotation.x = PI; }
  });

  R('arriba', 'dz_traje_astronauta', 'Traje de astronauta', 'Disfraces', { principal: '#F2F2F5', secundario: '#E8742A', acento: '#2E7BD6' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .5 }), O = ctx.mat('secundario', { roughness: .5 }), Az = ctx.mat('acento', { roughness: .5 });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .03 }); mangas(ctx, 'larga', 'principal', { puño: O }); ctx.H.cuello('alto', P);
    toro(.098, .03, O, 0, 1.12, 0, c);
    const f = caja(.15, .11, .02, M('#2B2F3A', { roughness: .4 }), 0, .9, 0, c); f.position.z = ctx.H.radioTorso(.9) * .8 + .018;
    [['#FF4D4D', -.05], ['#4DFF88', 0], ['#4DB8FF', .05]].forEach(([col, x]) => esfera(.011, M(col, { emissive: col, emissiveIntensity: .9 }), x, .93, ctx.H.radioTorso(.9) * .8 + .032, c, 8));
    caja(.1, .02, .008, O, 0, .88, ctx.H.radioTorso(.9) * .8 + .03, c);
    const b = ctx.partes.brazos[0]; caja(.06, .04, .012, Az, -.012, -.1, .062, b); caja(.06, .014, .013, M('#D32F2F'), -.012, -.1, .062, b);
    cintura(ctx, .62, O, .028, .018);
    for (const s of [-1, 1]) rama([V(s * .07, .86, ctx.H.radioTorso(.86) * .8 + .03), V(s * .17, .78, .16), V(s * .19, .66, .12)], .011, .011, M('#8D95A3', { metalness: .5, roughness: .4 }), c);
  });

  R('arriba', 'dz_traje_heroe', 'Traje de superhéroe', 'Disfraces', { principal: '#1F4FBF', secundario: '#F2C14E', acento: '#D32F2F' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .45 }), G = ctx.mat('secundario', brillo({ roughness: .35 })), Rj = ctx.mat('acento', { roughness: .45 });
    ctx.H.torso({ desde: .56, hasta: 1.1, mat: P, holgura: .01 }); mangas(ctx, 'larga', 'principal', { puño: Rj, holgura: .008 }); ctx.H.cuello('alto', P);
    const e = cil(.075, .075, .014, G, 0, .88, 0, c, 24); e.rotation.x = PI / 2; e.position.z = ctx.H.radioTorso(.88) * .8 + .018;
    const s = malla(estrella3D(.05, .022, .01), Rj, 0, .88, ctx.H.radioTorso(.88) * .8 + .022, c);
    cintura(ctx, .64, G, .018, .02);
  });

  R('arriba', 'dz_tunica_angel', 'Túnica de ángel', 'Disfraces', { principal: '#FFFFFF', secundario: '#F2C14E' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .8 }), G = ctx.mat('secundario', brillo());
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .07 }); mangas(ctx, 'larga', 'principal', { puño: G, acampanada: .06 });
    toro(.095, .014, G, 0, 1.1, 0, c); cintura(ctx, .7, G, .028, .016);
    rama([V(.05, .7, ctx.H.radioTorso(.7) * .8 + .03), V(.07, .6, ctx.H.radioTorso(.7) * .8 + .045), V(.06, .5, ctx.H.radioTorso(.7) * .8 + .045)], .008, .008, G, c); esfera(.02, G, .06, .48, ctx.H.radioTorso(.7) * .8 + .045, c, 8);
  });

  R('arriba', 'dz_traje_diablo', 'Traje de diablillo', 'Disfraces', { principal: '#C62828', secundario: '#1B1B22', acento: '#FFB300' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .5 }), D = ctx.mat('secundario', { roughness: .6 }), F = ctx.mat('acento', { roughness: .4, emissive: ctx.col('acento'), emissiveIntensity: .3 });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: P, ensanche: .03 }); mangas(ctx, 'larga', 'principal', { puño: D }); ctx.H.cuello('camisa', P, D);
    cintura(ctx, .64, D, .026, .02); caja(.06, .05, .014, F, 0, .64, ctx.H.radioTorso(.64) * .8 + .04, c);
    for (let k = 0; k < 12; k++) { const a = k * DOS / 12, t = cono(.032, .09, k % 2 ? F : D, 0, 0, 0, c, 3); sobre(ctx, t, .5, a, .04); t.rotation.x = PI; }
    cinta(ctx, 1.03, .35, .75, .1, .03, D, .016); cinta(ctx, 1.03, -.35, .75, -.1, .03, D, .016);
  });

  R('arriba', 'dz_traje_noel', 'Chaqueta de Papá Noel', 'Disfraces', { principal: '#D32F2F', secundario: '#FFFFFF', acento: '#1B1B22' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .85 }), W = ctx.mat('secundario', { roughness: 1 }), Bk = ctx.mat('acento', { roughness: .4 });
    ctx.H.torso({ desde: .45, hasta: 1.1, mat: P, ensanche: .1 }); mangas(ctx, 'larga', 'principal', { puño: W, holgura: .02 });
    torsoPar(ctx, .46, 1.1, .045, W, -.17, .34, .1); toro(.1, .03, W, 0, 1.115, 0, c);
    for (const i of [0, 1]) toro(.062, .028, W, 0, -.1, 0, ctx.partes.codos[i]).scale.set(1, 1, 1);
    cintura(ctx, .68, Bk, .045, .028); const h = caja(.08, .07, .016, M(dorado, brillo()), 0, .68, ctx.H.radioTorso(.68) * .8 + .08, c); caja(.045, .04, .018, Bk, 0, .68, ctx.H.radioTorso(.68) * .8 + .08, c);
    botones(ctx, [.9, .8], Bk, .014, .058);
  });

  R('arriba', 'dz_vestido_noel', 'Corpiño de Mamá Noel', 'Disfraces', { principal: '#D32F2F', secundario: '#FFFFFF', acento: '#1B1B22' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .8 }), W = ctx.mat('secundario', { roughness: 1 }), Bk = ctx.mat('acento', { roughness: .4 });
    ctx.H.torso({ desde: .6, hasta: 1.08, mat: P, cerrado: false }); toro(.1, .03, W, 0, 1.075, 0, c).scale.set(1.1, 1.1, 1.1);
    for (const i of [0, 1]) { const b = ctx.partes.brazos[i]; esfera(.08, P, 0, -.015, 0, b, 14); toro(.06, .028, W, 0, -.1, 0, b); }
    cintura(ctx, .7, Bk, .02, .02); caja(.07, .06, .014, M(dorado, brillo()), 0, .7, ctx.H.radioTorso(.7) * .8 + .035, c);
    botones(ctx, [.9, .82], W, .016, .016);
  });

  R('arriba', 'dz_jersey_elfo', 'Jersey de elfo', 'Disfraces', { principal: '#2E8B57', secundario: '#D32F2F', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .85 }), Rj = ctx.mat('secundario', { roughness: .7 }), G = ctx.mat('acento', brillo());
    ctx.H.torso({ desde: .56, hasta: 1.1, mat: P, ensanche: .05 }); mangas(ctx, 'larga', 'principal', { puño: Rj });
    for (let k = 0; k < 14; k++) { const a = k * DOS / 14, t = cono(.034, .08, k % 2 ? Rj : M('#FFFFFF'), 0, 0, 0, c, 3); sobre(ctx, t, .56, a, .05); t.rotation.x = PI; }
    for (let k = 0; k < 10; k++) { const a = k * DOS / 10, t = cono(.03, .06, k % 2 ? Rj : M('#FFFFFF'), Math.sin(a) * .11, 1.14, Math.cos(a) * .09, c, 3); t.rotation.set(-.4 * Math.cos(a), 0, .4 * Math.sin(a)); }
    cintura(ctx, .68, M('#1B1B22', { roughness: .5 }), .03, .02); caja(.06, .05, .014, G, 0, .68, ctx.H.radioTorso(.68) * .8 + .062, c);
    botones(ctx, [.85, .95], G, .013, .06);
  });

  R('arriba', 'dz_traje_reno', 'Suéter de reno', 'Disfraces', { principal: '#8B5A2B', secundario: '#F4E3C8', acento: '#D32F2F' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .95 }), W = ctx.mat('secundario', { roughness: 1 }), Rj = ctx.mat('acento', { roughness: .6 });
    ctx.H.torso({ desde: .52, hasta: 1.1, mat: P, ensanche: .03 }); mangas(ctx, 'larga', 'principal', { puño: W }); ctx.H.cuello('redondo', P);
    elip(.12, .2, .03, W, 0, .8, ctx.H.radioTorso(.8) * .8 + .015, c, 14);
    toro(.1, .016, Rj, 0, 1.1, 0, c); esfera(.03, M(dorado, brillo()), 0, 1.08, ctx.H.radioTorso(1.08) * .8 + .04, c, 12);
    for (let k = 0; k < 6; k++) { const a = k * DOS / 6; cono(.045, .06, P, Math.sin(a) * .2, .52, Math.cos(a) * .15, c, 8).rotation.x = PI; }
  });

  R('arriba', 'dz_traje_muneco_nieve', 'Traje de muñeco de nieve', 'Disfraces', { principal: '#FFFFFF', secundario: '#1B1B22', acento: '#F28A1E' }, (ctx) => {
    const c = ctx.partes.cuerpo, W = ctx.mat('principal', { roughness: .9 });
    ctx.H.torso({ desde: .5, hasta: 1.1, mat: W }); mangas(ctx, 'larga', 'principal');
    elip(.25, .3, .24, W, 0, .8, 0, c, 24);
    for (const y of [.92, .8, .68]) esfera(.026, ctx.mat('secundario', { roughness: .5 }), 0, y, 0.215, c, 10);
    for (const i of [0, 1]) { const co = ctx.partes.codos[i]; for (let k = -1; k <= 1; k++) esfera(.02, W, k * .03, -.26, 0, co, 8); }
    for (const [x, y] of [[-.07, 1.1], [.08, 1.08]]) elip(.03, .03, .01, ctx.mat('secundario'), x, y, .0, c, 6).position.z = 0;
  });

  R('arriba', 'dz_pijama_navidad', 'Pijama navideño', 'Disfraces', { principal: '#C62828', secundario: '#2E8B57', acento: '#FFFFFF' }, (ctx) => {
    const c = ctx.partes.cuerpo, tex = cuadros(ctx.col('principal'), ctx.col('secundario'), '#FFFFFF'), Pj = M('#FFFFFF', { map: tex, roughness: .9 }), W = ctx.mat('acento', { roughness: 1 });
    ctx.H.torso({ desde: .52, hasta: 1.1, mat: Pj, ensanche: .03 }); mangas(ctx, 'larga', 'principal', { mat: Pj, puño: W }); ctx.H.cuello('camisa', W);
    botones(ctx, [.7, .8, .9, 1.0], W, .013, .042);
    const b = caja(.08, .08, .01, ctx.mat('acento', { roughness: .9 }), -.09, .86, ctx.H.radioTorso(.86) * .8 + .03, c); cono(.025, .05, M('#2E8B57'), -.09, .87, ctx.H.radioTorso(.86) * .8 + .04, c, 3);
  });

  R('arriba', 'dz_camiseta_peru', 'Camiseta blanquirroja', 'Disfraces', { principal: '#FFFFFF', secundario: '#D91023' }, (ctx) => {
    const c = ctx.partes.cuerpo, W = ctx.mat('principal', { roughness: .8 }), Rj = ctx.mat('secundario', { roughness: .7, side: DS });
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: W, ensanche: .02 }); mangas(ctx, 'corta', 'principal'); ctx.H.cuello('redondo', Rj);
    cinta(ctx, 1.03, .95, .62, -.95, .12, Rj, .026);
  });

  R('arriba', 'dz_uniforme_caprichos', 'Uniforme Caprichos', 'Disfraces', { principal: '#E67929', secundario: '#0B2C3E', acento: '#FFF1DC' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .8 }), N = ctx.mat('secundario', { roughness: .75, side: DS }), Cr = ctx.mat('acento', { roughness: .8 });
    ctx.H.torso({ desde: .55, hasta: 1.1, mat: P, ensanche: .02 }); mangas(ctx, 'corta', 'principal'); ctx.H.cuello('camisa', P, Cr);
    torsoPar(ctx, .5, .88, .028, N, -.95, 1.9, .02); torsoPar(ctx, .86, 1.05, .028, N, -.5, 1);
    toro(.09, .008, N, 0, 1.12, 0, c, PI / 2 + .3);
    for (const s of [-1, 1]) rama([V(s * .075, 1.04, ctx.H.radioTorso(1.04) * .8 + .03), V(s * .06, 1.1, .08), V(s * .07, 1.12, 0)], .008, .008, N, c);
    const z = ctx.H.radioTorso(.68) * .8 + .036;
    caja(.13, .07, .01, M(tono(ctx.col('secundario'), 1.35), { roughness: .8 }), 0, .66, z, c);
    const tex = texCanvas(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = ctx.col('acento'); g.font = 'bold 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C.', w / 2, h / 2 + 3); });
    malla(new T.PlaneGeometry(.08, .08), new T.MeshStandardMaterial({ map: tex, transparent: true }), 0, .94, ctx.H.radioTorso(.94) * .8 + .033, c).castShadow = false;
    for (const s of [-1, 1]) caja(.05, .012, .01, N, s * .12, .6, -ctx.H.radioTorso(.6) * .8 - .03, c);
  });

  /* ---------- Abajo ---------- */
  const radioFalda = (ctx, desde, vuelo) => ctx.H.radioTorso(desde) + .014 + vuelo;
  const ribeteFalda = (ctx, desde, largo, vuelo, mat, tubo = .016) => { const m = toro(radioFalda(ctx, desde, vuelo), tubo, mat, 0, desde - largo, 0, ctx.partes.cuerpo); m.scale.set(ctx.partes.ancho, .9, 1); return m; };
  function pantalon(ctx, o = {}) {
    const P = ctx.mat('principal', { roughness: .8 }), S = ctx.mat('secundario', { roughness: .6 });
    ctx.H.cadera({ mat: P });
    [0, 1].forEach((i) => {
      ctx.H.pierna(i, { hasta: 'tobillo', mat: P, bota: o.bota || 0, basta: o.basta ? ctx.mat('acento', { roughness: .9 }) : null });
      if (o.rodilleras) esfera(.08, S, 0, -.02, .02, ctx.partes.rodillas[i], 14).scale.set(1, 1, .6);
    });
    cintura(ctx, .6, S, .02, .016);
  }
  R('abajo', 'dz_pantalon_liso', 'Pantalón liso', 'Disfraces', { principal: '#2B2B35', secundario: '#1B1B22' }, (ctx) => pantalon(ctx));
  R('abajo', 'dz_pantalon_astro', 'Pantalón de astronauta', 'Disfraces', { principal: '#F2F2F5', secundario: '#E8742A', acento: '#D0D4DC' }, (ctx) => pantalon(ctx, { rodilleras: true, basta: true }));
  R('abajo', 'dz_pantalon_noel', 'Pantalón de Papá Noel', 'Disfraces', { principal: '#D32F2F', secundario: '#1B1B22', acento: '#FFFFFF' }, (ctx) => pantalon(ctx, { basta: true, bota: .01 }));

  R('abajo', 'dz_falda_princesa', 'Falda de princesa', 'Disfraces', { principal: '#F48FB1', secundario: '#FFFFFF', acento: dorado }, (ctx) => {
    ctx.H.falda({ desdeY: .69, largo: .66, vuelo: .3, mat: ctx.mat('secundario', { roughness: .7 }) });
    ctx.H.falda({ desdeY: .7, largo: .58, vuelo: .34, mat: ctx.mat('principal', { roughness: .45 }), pliegues: 12 });
    ribeteFalda(ctx, .7, .58, .34, ctx.mat('acento', brillo()), .014);
    ctx.H.cadera({ mat: ctx.mat('principal') });
  });
  R('abajo', 'dz_falda_hielo', 'Falda de hielo', 'Disfraces', { principal: '#7FD4F5', secundario: '#EAF9FF', acento: '#FFFFFF' }, (ctx) => {
    ctx.H.falda({ desdeY: .7, largo: .66, vuelo: .3, mat: ctx.mat('principal', { roughness: .3, metalness: .2 }), pliegues: 10 });
    ctx.H.falda({ desdeY: .72, largo: .5, vuelo: .38, mat: ctx.mat('secundario', { roughness: .3, transparent: true, opacity: .55, depthWrite: false }), pliegues: 9 });
    ribeteFalda(ctx, .72, .5, .38, ctx.mat('acento', { roughness: .8 }), .02);
    const gl = new T.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#CFF3FF', emissiveIntensity: .8 });
    for (let k = 0; k < 9; k++) { const a = k * DOS / 9 + .3, y = .62 - (k % 3) * .12; esfera(.01, gl, Math.sin(a) * (ctx.H.radioTorso(.7) + .09 + (.7 - y) * .3) * ctx.partes.ancho, y, Math.cos(a) * (ctx.H.radioTorso(.7) + .09 + (.7 - y) * .3) * .9, ctx.partes.cuerpo, 6); }
    ctx.H.cadera({ mat: ctx.mat('principal') });
  });
  R('abajo', 'dz_falda_bruja', 'Falda de bruja', 'Disfraces', { principal: '#4B2A6B', secundario: '#1B1B22', acento: '#F28A1E' }, (ctx) => {
    ctx.H.falda({ desdeY: .68, largo: .52, vuelo: .16, mat: ctx.mat('principal', { roughness: .85 }), pliegues: 9 });
    ctx.H.falda({ desdeY: .69, largo: .38, vuelo: .2, mat: ctx.mat('secundario', { roughness: .85 }), pliegues: 7 });
    for (let k = 0; k < 8; k++) { const a = k * DOS / 8, r = radioFalda(ctx, .68, .2), j = cono(.04, .09, ctx.mat(k % 2 ? 'acento' : 'secundario', { roughness: .85 }), Math.sin(a) * r * ctx.partes.ancho, .27, Math.cos(a) * r * .9, ctx.partes.cuerpo, 3); j.rotation.x = PI; }
    ctx.H.cadera({ mat: ctx.mat('principal') });
  });
  R('abajo', 'dz_tunica_larga', 'Túnica larga', 'Disfraces', { principal: '#FFFFFF', secundario: '#F2C14E' }, (ctx) => {
    ctx.H.falda({ desdeY: .7, largo: .62, vuelo: .1, mat: ctx.mat('principal', { roughness: .85 }), pliegues: 8 });
    ribeteFalda(ctx, .7, .62, .1, ctx.mat('secundario', brillo()), .014); ctx.H.cadera({ mat: ctx.mat('principal') });
  });
  R('abajo', 'dz_falda_vaquera', 'Falda vaquera con flecos', 'Disfraces', { principal: '#A9743F', secundario: '#6B4423', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo; ctx.H.falda({ desdeY: .66, largo: .2, vuelo: .1, mat: ctx.mat('principal', { roughness: .7 }) });
    const r = radioFalda(ctx, .66, .1);
    for (let k = 0; k < 18; k++) { const a = k * DOS / 18; caja(.014, .08, .008, ctx.mat('secundario', { roughness: .7 }), Math.sin(a) * r * ctx.partes.ancho, .42, Math.cos(a) * r * .9, c).rotation.y = a; }
    cintura(ctx, .64, ctx.mat('secundario', { roughness: .6 }), .028, .02); caja(.07, .05, .014, ctx.mat('acento', brillo()), 0, .64, ctx.H.radioTorso(.64) * .8 + .05, c); ctx.H.cadera({ mat: ctx.mat('principal') });
  });
  R('abajo', 'dz_falda_noel', 'Falda de Mamá Noel', 'Disfraces', { principal: '#D32F2F', secundario: '#FFFFFF', acento: '#1B1B22' }, (ctx) => {
    ctx.H.falda({ desdeY: .72, largo: .5, vuelo: .2, mat: ctx.mat('principal', { roughness: .85 }), pliegues: 10 });
    ribeteFalda(ctx, .72, .5, .2, ctx.mat('secundario', { roughness: 1 }), .035); ctx.H.cadera({ mat: ctx.mat('principal') });
  });

  R('abajo', 'dz_pantalon_vaquero', 'Jeans con chaparreras', 'Disfraces', { principal: '#3F6EA8', secundario: '#8B5A2B', acento: dorado }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .85 }), Cu = ctx.mat('secundario', { roughness: .65 });
    ctx.H.cadera({ mat: P });
    [0, 1].forEach((i) => {
      ctx.H.pierna(i, { hasta: 'tobillo', mat: P }); ctx.H.pierna(i, { hasta: 'tobillo', mat: Cu, holgura: .03, bota: .004 });
      for (let k = 0; k < 6; k++) { const lado = i === 0 ? -1 : 1, f = caja(.01, .07, .006, Cu, lado * .095, 0, 0, ctx.partes.piernas[i]); f.position.set(lado * (MED.radioMuslo + .042), -.04 - k * .08, 0); f.rotation.z = lado * .1; }
    });
    cintura(ctx, .61, Cu, .02, .02); caja(.075, .055, .016, ctx.mat('acento', brillo()), 0, .61, ctx.H.radioTorso(.61) * .8 + .045, c);
  });

  R('abajo', 'dz_pantalon_pirata', 'Bombachos de pirata', 'Disfraces', { principal: '#3A2E2A', secundario: '#B3262E', acento: '#F4EAD0' }, (ctx) => {
    const c = ctx.partes.cuerpo, P = ctx.mat('principal', { roughness: .85 });
    ctx.H.cadera({ mat: P });
    const medias = M('#FFFFFF', { map: rayas('#F4EAD0', '#1E1E26', 5), roughness: .9 });
    [0, 1].forEach((i) => { ctx.H.pierna(i, { hasta: 'tobillo', mat: medias }); ctx.H.pierna(i, { hasta: 'rodilla', mat: P, holgura: .045 }); });
    cintura(ctx, .66, ctx.mat('secundario', { roughness: .6 }), .03, .03);
    for (const s of [-1, 1]) caja(.03, .12, .012, ctx.mat('secundario'), s * .08, .56, ctx.H.radioTorso(.66) * .8 + .04, c).rotation.z = s * .2;
  });

  R('abajo', 'dz_pantalon_roto', 'Pantalón roto', 'Disfraces', { principal: '#4A4F5C', secundario: '#2B2F3A', acento: '#8D8F98' }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .95, side: DS }), S = ctx.mat('secundario', { roughness: .95 });
    ctx.H.cadera({ mat: P });
    ctx.H.pierna(0, { hasta: 'tobillo', mat: P }); ctx.H.pierna(1, { hasta: 'rodilla', mat: P });
    for (let k = 0; k < 7; k++) { const a = k * DOS / 7, j = cono(.03, .07, P, Math.sin(a) * .08, -.2, Math.cos(a) * .08, ctx.partes.rodillas[0], 3); j.rotation.x = PI; const j2 = cono(.03, .08, P, Math.sin(a) * .08, -.05, Math.cos(a) * .08, ctx.partes.rodillas[1], 3); j2.rotation.x = PI; }
    caja(.07, .07, .01, S, .02, -.1, .075, ctx.partes.piernas[0]); caja(.06, .08, .01, ctx.mat('acento'), -.01, -.08, .07, ctx.partes.piernas[1]);
    cintura(ctx, .6, S, .02, .016);
  });

  R('abajo', 'dz_mallas_heroe', 'Mallas de superhéroe', 'Disfraces', { principal: '#1F4FBF', secundario: '#D32F2F', acento: dorado }, (ctx) => {
    const P = ctx.mat('principal', { roughness: .45 }), Rj = ctx.mat('secundario', { roughness: .45 });
    ctx.H.cadera({ mat: Rj, holgura: .03 }); [0, 1].forEach((i) => { ctx.H.pierna(i, { hasta: 'tobillo', mat: P, holgura: .008 }); ctx.H.pierna(i, { hasta: 'muslo', mat: Rj, holgura: .026 }); });
    cintura(ctx, .6, ctx.mat('acento', brillo({ roughness: .35 })), .026, .02);
  });

  R('abajo', 'dz_mallas_rayas', 'Mallas de rayas (elfo)', 'Disfraces', { principal: '#D32F2F', secundario: '#FFFFFF', acento: '#2E8B57' }, (ctx) => {
    const medias = M('#FFFFFF', { map: rayas(ctx.col('principal'), ctx.col('secundario'), 5), roughness: .85 });
    ctx.H.cadera({ mat: ctx.mat('acento', { roughness: .85 }) });
    [0, 1].forEach((i) => { ctx.H.pierna(i, { hasta: 'tobillo', mat: medias }); ctx.H.pierna(i, { hasta: 'muslo', mat: ctx.mat('acento', { roughness: .85 }), holgura: .03 }); });
    cintura(ctx, .6, M('#1B1B22'), .026, .018);
  });

  R('abajo', 'dz_pantalon_pijama', 'Pantalón de pijama', 'Disfraces', { principal: '#C62828', secundario: '#2E8B57', acento: '#FFFFFF' }, (ctx) => {
    const tex = cuadros(ctx.col('principal'), ctx.col('secundario'), '#FFFFFF'), Pj = M('#FFFFFF', { map: tex, roughness: .9 });
    ctx.H.cadera({ mat: Pj }); [0, 1].forEach((i) => ctx.H.pierna(i, { hasta: 'tobillo', mat: Pj, bota: .01, basta: ctx.mat('acento', { roughness: 1 }) }));
    cintura(ctx, .6, ctx.mat('acento', { roughness: 1 }), .02, .016);
  });

  /* ---------- Calzado ---------- */
  function calzado(ctx, o) {
    const P = ctx.mat('principal', { roughness: o.lustre ? .22 : .65, metalness: o.metal || 0 }), S = ctx.mat('secundario', { roughness: .7 }), A2 = ctx.mat('acento', { roughness: .5 });
    [0, 1].forEach((i) => {
      const r = ctx.partes.rodillas[i], L = o.punta || 0, z = .035 + L * .3;
      elip(.072, .047, .118 + L / 2, P, 0, -.232, z, r, 18);
      elip(.077, .014, .122 + L / 2, S, 0, -.262, z, r, 16);
      if (o.tacon) cil(.03, .034, .035, S, 0, -.255, -.04, r, 12);
      if (o.alto) cil(.071, .079, o.alto, P, 0, -.215 + o.alto / 2, 0, r, 18);
      if (o.cuello === 'peludo') toro(.077, .026, ctx.mat('acento', { roughness: 1 }), 0, -.215 + o.alto, 0, r);
      if (o.cuello === 'doblado') { cil(.1, .08, .07, P, 0, -.215 + o.alto, 0, r, 18); toro(.1, .01, S, 0, -.18 + o.alto, 0, r); }
      if (o.cuello === 'aro') toro(.08, .014, A2, 0, -.215 + o.alto, 0, r);
      if (o.cordones) { for (let k = 0; k < 3; k++) caja(.07, .008, .012, M('#F5F5F5'), 0, -.19 + k * .0 , .05 + k * .028, r).rotation.x = -.3; elip(.04, .02, .045, A2, 0, -.19, .085, r, 8); }
      if (o.espuela) { const e = cono(.018, .035, M('#C9CED8', brillo()), 0, -.245, -.1, r, 5); e.rotation.x = -PI / 2; }
      if (o.garras) for (let k = -1; k <= 1; k++) { const g = cono(.017, .05, M('#F5F5F5', { roughness: .4 }), k * .04, -.245, .15 + L, r, 6); g.rotation.x = PI / 2; }
      if (o.curva) rama([V(0, -.245, .15), V(0, -.24, .22), V(0, -.21, .28), V(0, -.16, .3)], .04, .012, P, r);
      if (o.cascabel) esfera(.022, M(dorado, brillo()), 0, -.145, .3, r, 10);
      if (o.pelo) for (let k = 0; k < 9; k++) { const a = k * DOS / 9; esfera(.034, P, Math.sin(a) * .06, -.2 + (k % 2) * .02, .02 + Math.cos(a) * .1, r, 8); }
      if (o.correas) { for (const y of [-.2, -.17]) toro(.066, .006, A2, 0, y, 0, r); toro(.045, .006, A2, 0, -.215, .05, r, 0, PI * 1.5); }
      if (o.pernos) for (const s of [-1, 1]) { cil(.012, .012, .02, M('#8D95A3', brillo()), s * .08, -.18, .02, r, 8).rotation.z = PI / 2; }
      if (o.puntera) elip(.06, .036, .05, A2, 0, -.238, .1 + L, r, 12);
    });
  }
  const K = (id, nombre, col, o) => R('calzado', id, nombre, 'Disfraces', col, (ctx) => calzado(ctx, o));
  K('dz_zapatos_formal', 'Zapatos de gala', { principal: '#1B1B22', secundario: '#0E0E12', acento: '#C9CED8' }, { lustre: true, tacon: true });
  K('dz_zapatillas', 'Zapatillas', { principal: '#FFFFFF', secundario: '#E8E2D8', acento: '#D32F2F' }, { cordones: true, alto: .03, cuello: 'aro', puntera: true });
  K('dz_botas_vaquero', 'Botas vaqueras', { principal: '#8B5A2B', secundario: '#4A2C1D', acento: dorado }, { alto: .22, punta: .05, tacon: true, espuela: true, lustre: true });
  K('dz_botas_pirata', 'Botas de pirata', { principal: '#4A2C1D', secundario: '#2B1A10', acento: dorado }, { alto: .2, cuello: 'doblado', tacon: true });
  K('dz_botas_noel', 'Botas de Papá Noel', { principal: '#1B1B22', secundario: '#0E0E12', acento: '#FFFFFF' }, { alto: .17, cuello: 'peludo', lustre: true });
  K('dz_botas_cortas', 'Botines', { principal: '#6B4423', secundario: '#3B2414', acento: '#E8E2D8' }, { alto: .1, cuello: 'peludo', tacon: true });
  K('dz_zapatos_punta', 'Zapatos de punta curva', { principal: '#2B2038', secundario: '#1B1B22', acento: dorado }, { curva: true, cascabel: true, tacon: true });
  K('dz_botas_astro', 'Botas de astronauta', { principal: '#F2F2F5', secundario: '#E8742A', acento: '#8D95A3' }, { alto: .14, cuello: 'aro', puntera: true });
  K('dz_botas_heroe', 'Botas de superhéroe', { principal: '#D32F2F', secundario: '#8E1B1B', acento: dorado }, { alto: .26, cuello: 'aro', lustre: true });
  K('dz_patas_dino', 'Patas con garras', { principal: '#4FAF5A', secundario: '#3A8A44', acento: '#F2E7A8' }, { garras: true, punta: .03 });
  K('dz_pantuflas', 'Pantuflas esponjosas', { principal: '#F4A7B9', secundario: '#FFFFFF', acento: '#E8559A' }, { pelo: true, punta: .02 });
  K('dz_sandalias', 'Sandalias', { principal: '#F2C14E', secundario: '#C9A227', acento: '#F2C14E' }, { correas: true });
  K('dz_botas_monstruo', 'Botas de monstruo', { principal: '#25252C', secundario: '#15151A', acento: '#8D95A3' }, { alto: .14, punta: .03, pernos: true, puntera: true });

  /* =================================================================
   * DISFRACES (presets)
   * ================================================================= */
  const a = (id, colores) => ({ id, colores });
  const N0 = { id: 'ninguno' };
  const D = (id, nombre, grupoN, aplica) => A.registrar('disfraz', { id, nombre, grupo: grupoN, colores: [], construir() {}, aplica: Object.assign({ accesorio: N0, cabeza: N0, cara: N0 }, aplica) });
  D('dz_princesa', 'Princesa', 'Cuentos', { arriba: a('dz_corse_princesa'), abajo: a('dz_falda_princesa'), calzado: a('dz_zapatos_formal', { principal: '#F48FB1' }), cabeza: a('corona_princesa'), accesorio: a('varita_magica') });
  D('dz_principe', 'Príncipe', 'Cuentos', { arriba: a('dz_chaqueta_principe'), abajo: a('dz_pantalon_liso', { principal: '#F4F1EA', secundario: '#C9A227' }), calzado: a('dz_zapatos_formal'), cabeza: a('corona_rey'), accesorio: a('capa_heroe', { principal: '#B3262E', secundario: '#F4E6C8', acento: dorado }) });
  D('dz_reina_hielo', 'Reina de hielo', 'Cuentos', { arriba: a('dz_corse_hielo'), abajo: a('dz_falda_hielo'), calzado: a('dz_zapatos_formal', { principal: '#CFEFFF' }), cabeza: a('corona_hielo'), accesorio: a('capa_princesa', { principal: '#9ADBF5', secundario: '#EAF9FF', acento: '#FFFFFF' }) });
  D('dz_vaquero', 'Vaquero', 'Aventura', { arriba: a('dz_camisa_vaquero'), abajo: a('dz_pantalon_vaquero'), calzado: a('dz_botas_vaquero'), cabeza: a('sombrero_vaquero'), cara: a('bigote_falso') });
  D('dz_vaquera', 'Vaquera', 'Aventura', { arriba: a('dz_camisa_vaquero', { principal: '#E8559A', secundario: '#C9792B' }), abajo: a('dz_falda_vaquera'), calzado: a('dz_botas_vaquero', { principal: '#C9792B' }), cabeza: a('sombrero_vaquero', { principal: '#F2D6A2' }) });
  D('dz_pirata', 'Pirata', 'Aventura', { arriba: a('dz_casaca_pirata'), abajo: a('dz_pantalon_pirata'), calzado: a('dz_botas_pirata'), cabeza: a('gorro_pirata'), cara: a('parche_pirata'), accesorio: a('espada_pirata') });
  D('dz_bruja', 'Bruja', 'Halloween', { arriba: a('dz_vestido_bruja'), abajo: a('dz_falda_bruja'), calzado: a('dz_zapatos_punta'), cabeza: a('sombrero_bruja'), accesorio: a('escoba_bruja') });
  D('dz_mago', 'Mago', 'Cuentos', { arriba: a('dz_tunica_mago'), abajo: a('dz_tunica_larga', { principal: '#3B3A8E' }), calzado: a('dz_botas_cortas', { principal: '#5B3A29' }), cabeza: a('sombrero_mago'), cara: a('barba_larga', { principal: '#D8D8E0' }), accesorio: a('varita_magica') });
  D('dz_vampiro', 'Vampiro', 'Halloween', { arriba: a('dz_frac_vampiro'), abajo: a('dz_pantalon_liso'), calzado: a('dz_zapatos_formal'), cara: a('mascara_vampiro'), accesorio: a('capa_vampiro'), piel: '#EDE3E8' });
  D('dz_monstruo', 'Monstruo verde', 'Halloween', { arriba: a('dz_chaqueta_monstruo'), abajo: a('dz_pantalon_liso', { principal: '#3B3B48' }), calzado: a('dz_botas_monstruo'), cara: a('mascara_monstruo'), cabello: { id: 'calvo' }, piel: '#8CCB6B' });
  D('dz_zombi', 'Zombi', 'Halloween', { arriba: a('dz_camisa_zombi'), abajo: a('dz_pantalon_roto'), calzado: a('dz_zapatillas', { principal: '#8D8F98', secundario: '#5A5C64', acento: '#6E6A60' }), cara: a('mascara_zombi'), piel: '#A8C5A0' });
  D('dz_lobo', 'Hombre lobo', 'Halloween', { arriba: a('dz_pelaje_lobo'), abajo: a('dz_pantalon_roto', { principal: '#5B4A3A', secundario: '#3A2E24', acento: '#8A7F78' }), calzado: a('dz_patas_dino', { principal: '#8A7F78', secundario: '#6E645E' }), cabeza: a('orejas_lobo'), cara: a('mascara_lobo'), accesorio: a('cola_lobo') });
  D('dz_calabaza', 'Calabaza', 'Halloween', { arriba: a('dz_traje_calabaza'), abajo: a('dz_pantalon_liso', { principal: '#3E8E3A' }), calzado: a('dz_zapatillas', { principal: '#3E8E3A', secundario: '#2E6E2A', acento: '#F28A1E' }), cabeza: a('gorro_calabaza'), accesorio: a('bolsa_calabaza') });
  D('dz_dinosaurio', 'Dinosaurio', 'Animales', { arriba: a('dz_mono_dino'), abajo: a('dz_pantalon_liso', { principal: '#4FAF5A' }), calzado: a('dz_patas_dino'), cabeza: a('capucha_dino'), accesorio: a('cola_dino') });
  D('dz_astronauta', 'Astronauta', 'Aventura', { arriba: a('dz_traje_astronauta'), abajo: a('dz_pantalon_astro'), calzado: a('dz_botas_astro'), cabeza: a('casco_astronauta'), accesorio: a('mochila_cohete') });
  D('dz_superheroe', 'Superhéroe', 'Aventura', { arriba: a('dz_traje_heroe'), abajo: a('dz_mallas_heroe'), calzado: a('dz_botas_heroe'), cara: a('mascara_heroe'), accesorio: a('capa_heroe') });
  D('dz_angel', 'Ángel', 'Fantasía', { arriba: a('dz_tunica_angel'), abajo: a('dz_tunica_larga'), calzado: a('dz_sandalias'), cabeza: a('aureola_angel'), accesorio: a('alas_angel') });
  D('dz_diablito', 'Diablito', 'Fantasía', { arriba: a('dz_traje_diablo'), abajo: a('dz_pantalon_liso', { principal: '#C62828' }), calzado: a('dz_zapatos_punta', { principal: '#1B1B22' }), cabeza: a('cuernitos_diablo'), accesorio: a('cola_diablo') });
  D('dz_catrina', 'Catrina', 'Fiestas', { arriba: a('dz_corse_princesa', { principal: '#1B1B22', secundario: '#E8559A', acento: '#F2C14E' }), abajo: a('dz_falda_princesa', { principal: '#1B1B22', secundario: '#8E1B3A', acento: '#F2C14E' }), calzado: a('dz_zapatos_formal'), cabeza: a('corona_flores', { principal: '#E8559A', secundario: '#F28A1E', acento: '#F2C14E' }), cara: a('maquillaje_catrina'), accesorio: a('collar_perlas') });
  D('dz_papa_noel', 'Papá Noel', 'Navidad', { arriba: a('dz_traje_noel'), abajo: a('dz_pantalon_noel'), calzado: a('dz_botas_noel'), cabeza: a('gorro_navidad'), cara: a('barba_larga'), accesorio: a('saco_regalos') });
  D('dz_mama_noel', 'Mamá Noel', 'Navidad', { arriba: a('dz_vestido_noel'), abajo: a('dz_falda_noel'), calzado: a('dz_botas_noel'), cabeza: a('gorro_navidad'), accesorio: a('baston_caramelo') });
  D('dz_elfo', 'Elfo', 'Navidad', { arriba: a('dz_jersey_elfo'), abajo: a('dz_mallas_rayas'), calzado: a('dz_zapatos_punta', { principal: '#D32F2F', secundario: '#8E1B1B' }), cabeza: a('gorro_elfo'), cara: a('orejas_puntiagudas'), accesorio: a('baston_caramelo') });
  D('dz_reno', 'Reno', 'Navidad', { arriba: a('dz_traje_reno'), abajo: a('dz_pantalon_liso', { principal: '#7A4B2A' }), calzado: a('dz_botas_cortas'), cabeza: a('cachos_reno'), cara: a('nariz_reno'), accesorio: a('bufanda', { principal: '#D32F2F', secundario: '#FFFFFF' }) });
  D('dz_muneco_nieve', 'Muñeco de nieve', 'Navidad', { arriba: a('dz_traje_muneco_nieve'), abajo: a('dz_pantalon_liso', { principal: '#F4F8FC' }), calzado: a('dz_botas_cortas', { principal: '#1B1B22', secundario: '#0E0E12' }), cabeza: a('sombrero_copa'), cara: a('nariz_zanahoria'), accesorio: a('bufanda', { principal: '#2E8B57', secundario: '#D32F2F' }), piel: '#F4F8FC' });
  D('dz_pijama_navidad', 'Pijama navideño', 'Navidad', { arriba: a('dz_pijama_navidad'), abajo: a('dz_pantalon_pijama'), calzado: a('dz_pantuflas', { principal: '#C62828', secundario: '#FFFFFF' }), cabeza: a('gorro_dormir') });
  D('dz_hincha_peru', 'Hincha de Perú', 'Fiestas Patrias', { arriba: a('dz_camiseta_peru'), abajo: a('dz_pantalon_liso', { principal: '#FFFFFF', secundario: '#D91023' }), calzado: a('dz_zapatillas', { acento: '#D91023' }), cabeza: a('chullo_andino'), cara: a('pintura_peru'), accesorio: a('bandera_peru') });
  D('dz_equipo_caprichos', 'Equipo Caprichos', 'Caprichos', { arriba: a('dz_uniforme_caprichos'), abajo: a('dz_pantalon_liso', { principal: '#0B2C3E', secundario: '#E67929' }), calzado: a('dz_zapatillas', { principal: '#1B1B22', secundario: '#F5F5F5', acento: '#E67929' }), cabeza: a('gorro_chef') });
}
