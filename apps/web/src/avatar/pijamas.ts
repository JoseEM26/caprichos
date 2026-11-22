/* eslint-disable -- piezas 3D del avatar: mismo estilo que disfraces.ts (geometría a mano, sin tipos finos) */
// @ts-nocheck
import { AVATAR } from './nucleo';

/*
 * Pijamas enteras «kigurumi» de Caprichos (grupo DESTACADOS de Disfraces).
 * Personajes ORIGINALES de la cafetería (postres y café), sin parecido con personajes de terceros:
 *   Conejita Fresa, Michi Caramelo, Diablito Arándano, Perrito Nube de Leche y Osito Latte.
 * Cada pijama son 3 piezas que el disfraz junta: «arriba» (cuerpo entero: torso, mangas, pantalón, puños,
 * patitas y cola; cubreAbajo), «cabeza» (capucha con orejas; esconde el cabello) y «calzado» (pantuflas).
 * Todo comparte geometrías, texturas y materiales (caché) para no pesar más que los disfraces actuales.
 */
export function registrarPijamas() {
  const A = AVATAR, T = A.T;
  const { M, malla, texCanvas, tono } = A;
  const PI = Math.PI, DOS = PI * 2, DS = T.DoubleSide;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const grupo = (p, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); if (p) p.add(g); return g; };

  /* ---------- Caché de geometrías, texturas y materiales ---------- */
  const geos = new Map();
  const geo = (clave, fabrica) => { let g = geos.get(clave); if (!g) { g = fabrica(); g.name = clave; geos.set(clave, g); } return g; };
  const esf = (seg = 18) => geo('esf' + seg, () => new T.SphereGeometry(1, seg, Math.max(8, seg * .75 | 0)));
  const elip = (sx, sy, sz, mat, x, y, z, p, seg = 18) => { const m = malla(esf(seg), mat, x, y, z, p); m.scale.set(sx, sy, sz); return m; };

  const texs = new Map();
  const tex = (clave, w, h, dibujar, rep = [1, 1]) => {
    let t = texs.get(clave);
    if (!t) {
      if (texs.size > 60) { texs.forEach((x) => x.dispose()); texs.clear(); mats.clear(); }
      t = texCanvas(w, h, dibujar, rep); texs.set(clave, t);
    }
    return t;
  };
  const mats = new Map();
  const rng = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /** Relieve suave compartido (pelusa): una sola textura gris para todos los materiales. */
  const relieve = () => tex('relieve', 128, 128, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 700; i++) { const v = 90 + r() * 90 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 2.2, 0, DOS); c.fill(); }
  }, [6, 6]);

  /* ---------- Estampados (se dibujan sobre el color base; baldosa de 256 px que repite sin costura) ---------- */
  const PAT = {
    liso: () => () => {},
    semillas: (c0) => (c, w, h, r) => {
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
        const x = gx * 32 + (gy % 2) * 16 + 8 + r() * 6, y = gy * 32 + 10 + r() * 6, a = r() * .8 - .4;
        c.fillStyle = c0; c.globalAlpha = .85;
        for (const dx of [0, -w]) { c.beginPath(); c.ellipse(x + dx, y, 2.4, 4, a, 0, DOS); c.fill(); }
      }
      c.globalAlpha = 1;
    },
    barras: (c0) => (c, w, h, r) => {
      c.fillStyle = c0;
      for (let fila = 0; fila < 3; fila++) for (let k = 0; k < 3; k++) {
        const x = (k + .5) * (w / 3) + (fila % 2) * 24 + r() * 10 - 5, y = fila * 86 + 28 + r() * 10;
        for (const dx of [0, -w]) { c.beginPath(); c.ellipse(x + dx, y, 6.5, 24 + r() * 8, r() * .3 - .15, 0, DOS); c.fill(); }
      }
    },
    anillos: (c0) => (c, w, h) => {
      c.fillStyle = c0;
      for (const y of [30, 94, 158, 222]) { c.beginPath(); c.roundRect(0, y, w, 22, 11); c.fill(); }
    },
    estrellas: (c0) => (c, w, h, r) => {
      for (let i = 0; i < 9; i++) {
        const x = 24 + r() * (w - 48), y = 24 + r() * (h - 48), R = 8 + r() * 7, rot = r() * 1.2;
        c.fillStyle = c0; c.beginPath();
        for (let k = 0; k < 10; k++) { const a = -PI / 2 + rot + k * PI / 5, rr = k % 2 ? R * .46 : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(r() * w, r() * h, 1.6, 0, DOS); c.fill(); }
    },
    nubes: (c0) => (c, w, h) => {
      c.fillStyle = c0; c.globalAlpha = .92;
      for (const [x, y, s] of [[58, 58, 1], [192, 98, .85], [96, 196, .95], [222, 224, .7], [20, 150, .6]]) {
        for (const dx of [0, -w, w]) {
          c.beginPath();
          c.arc(x + dx - 12 * s, y + 3 * s, 11 * s, 0, DOS); c.arc(x + dx + 2 * s, y - 6 * s, 14 * s, 0, DOS); c.arc(x + dx + 16 * s, y + 3 * s, 10 * s, 0, DOS);
          c.rect(x + dx - 12 * s, y + 3 * s, 28 * s, 10 * s); c.fill();
        }
      }
      c.globalAlpha = 1;
    },
  };

  /** Material de felpa: color base + pelusa + estampado, brillo de terciopelo (sheen) y relieve suave. */
  function felpa(color, patron = 'liso', c0 = '#FFFFFF', rep = [1, 1], o = {}) {
    const clave = [color, patron, c0, rep.join('x'), JSON.stringify(o)].join('|');
    let m = mats.get(clave);
    if (m) return m;
    const mapa = tex('f|' + clave, 256, 256, (c, w, h) => {
      c.fillStyle = color; c.fillRect(0, 0, w, h);
      const r = rng(11);
      c.lineCap = 'round';
      for (let i = 0; i < 1100; i++) {
        const x = r() * w, y = r() * h, a = r() * DOS, l = 3 + r() * 4;
        c.strokeStyle = r() < .55 ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.06)'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
      (PAT[patron] || PAT.liso)(c0)(c, w, h, rng(5));
    }, rep);
    m = new T.MeshPhysicalMaterial(Object.assign({
      map: mapa, roughness: .94, metalness: 0, sheen: 1, sheenRoughness: .5,
      sheenColor: new T.Color(color).lerp(new T.Color('#ffffff'), .55),
      bumpMap: relieve(), bumpScale: .5,
    }, o));
    mats.set(clave, m);
    return m;
  }

  /* ---------- Formas redondeadas de peluche (orejas, alas, corazón) ---------- */
  const SHAPES = {
    conejo: (k = 1, cy = .075) => { const s = new T.Shape(); s.absellipse(0, cy, .056 * k, .088 * k, 0, DOS, false); return s; },
    gato: (k = 1, cy = .06) => {
      const X = (x) => x * k, Y = (y) => y * k + (1 - k) * cy, s = new T.Shape();
      s.moveTo(X(-.066), Y(.006)); s.lineTo(X(-.014), Y(.122)); s.quadraticCurveTo(X(0), Y(.15), X(.014), Y(.122)); s.lineTo(X(.066), Y(.006)); s.quadraticCurveTo(X(0), Y(-.022), X(-.066), Y(.006));
      return s;
    },
    oso: (k = 1, cy = .05) => { const s = new T.Shape(); s.absellipse(0, cy, .058 * k, .058 * k, 0, DOS, false); return s; },
    perro: (k = 1, cy = -.075) => {
      const X = (x) => x * k, Y = (y) => y * k + (1 - k) * cy, s = new T.Shape();
      s.moveTo(X(-.046), Y(0)); s.lineTo(X(.046), Y(0)); s.quadraticCurveTo(X(.078), Y(-.07), X(.046), Y(-.13)); s.quadraticCurveTo(X(0), Y(-.17), X(-.046), Y(-.13)); s.quadraticCurveTo(X(-.078), Y(-.07), X(-.046), Y(0));
      return s;
    },
    ala: () => {
      const s = new T.Shape();
      s.moveTo(0, 0); s.quadraticCurveTo(.05, .12, .2, .1); s.quadraticCurveTo(.2, .06, .175, .045); s.quadraticCurveTo(.175, .012, .145, .003);
      s.quadraticCurveTo(.14, -.025, .108, -.03); s.quadraticCurveTo(.085, -.04, .06, -.02); s.quadraticCurveTo(.03, -.012, 0, 0);
      return s;
    },
    corazon: () => { const s = new T.Shape(); s.moveTo(0, -.6); s.bezierCurveTo(-.95, -.1, -.5, .72, 0, .3); s.bezierCurveTo(.5, .72, .95, -.1, 0, -.6); return s; },
  };
  const extruida = (clave, forma, prof, bisel) => geo(clave, () => {
    const g = new T.ExtrudeGeometry(forma(), { depth: prof, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 4, curveSegments: 14 });
    g.translate(0, 0, -prof / 2); return g;
  });
  /** Oreja de peluche: devuelve el pivote (se anima) con la oreja y su interior. dir = hacia dónde mira la base sobre la capucha. */
  function oreja(p, tipo, dir, mat, matIn, { roll = 0, pitch = 0, yaw = 0, interior = .62, escala = 1, cyIn } = {}) {
    const base = grupo(p), d = dir.clone().normalize();
    base.position.copy(d.clone().multiplyScalar(RC * .985));
    base.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    const piv = grupo(base); piv.rotation.set(pitch, yaw, roll); piv.scale.setScalar(escala);
    const g = malla(extruida('o_' + tipo, SHAPES[tipo], .02, .009), mat, 0, 0, 0, piv);
    if (matIn) {
      const gi = malla(extruida('oi_' + tipo, () => SHAPES[tipo](interior, cyIn), .004, .004), matIn, 0, 0, .02 / 2 + .007, piv);
      gi.castShadow = false;
    }
    return piv;
  }

  /* =================================================================
   * CAPUCHA: cáscara con abertura para la cara (una sola geometría para las 5)
   * ================================================================= */
  const RC = .3, CX = .205, CY = .225, CC = -.03;
  const PERFIL = (() => {
    const p = [];
    for (let i = 0; i <= 14; i++) { const th = i / 14 * 1.72; p.push([Math.max(.002, RC * Math.sin(th)), RC * Math.cos(th)]); }
    p.push([.286, -.12], [.248, -.212], [.2, -.278], [.168, -.332]);
    return p;
  })();
  const radioEn = (y) => {
    for (let i = 0; i < PERFIL.length - 1; i++) {
      const [r0, y0] = PERFIL[i], [r1, y1] = PERFIL[i + 1];
      if (y <= y0 && y >= y1) return r0 + (r1 - r0) * ((y0 - y) / (y0 - y1 || 1));
    }
    return y > PERFIL[0][1] ? .002 : PERFIL[PERFIL.length - 1][0];
  };
  const dentroDeLaAbertura = (x, y, z) => z > .02 && (x / CX) ** 2 + ((y - CC) / CY) ** 2 < 1;
  const geoCapucha = () => geo('capucha', () => {
    const NU = 120, NV = PERFIL.length - 1, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const f = i / NU * DOS, [r, y] = PERFIL[j];
      pos.push(Math.sin(f) * r, y, Math.cos(f) * r); uv.push(i / NU, 1 - j / NV);
    }
    const P = (i, j) => { const k = (j * (NU + 1) + i) * 3; return [pos[k], pos[k + 1], pos[k + 2]]; };
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cy = (a[1] + b[1] + c[1] + d[1]) / 4, cz = (a[2] + b[2] + c[2] + d[2]) / 4;
      if (dentroDeLaAbertura(cx, cy, cz)) continue;
      const ia = j * (NU + 1) + i, ib = ia + 1, ic = ia + NU + 1, id = ic + 1;
      idx.push(ia, ic, ib, ib, ic, id);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
  /** Ribete mullido que sigue el borde de la abertura (tubo sobre la cáscara). */
  const geoRibete = () => geo('ribete', () => {
    const pts = [];
    for (let k = 0; k < 72; k++) {
      const t = k / 72 * DOS, x = CX * Math.sin(t), y = CC + CY * Math.cos(t);
      pts.push(V(x, y, Math.sqrt(Math.max(.0004, radioEn(y) ** 2 - x * x)) + .002));
    }
    return new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 110, .017, 10, true);
  });
  /** Pone un objeto sobre la cáscara en la dirección d (su +y mira hacia afuera). */
  function sobreCasco(p, m, d, hond = .002) {
    const n = d.clone().normalize();
    m.position.copy(n.clone().multiplyScalar(RC + hond));
    m.quaternion.setFromUnitVectors(V(0, 1, 0), n); p.add(m); return m;
  }

  /** Puntadas: una sola malla instanciada (1 llamada de dibujo) sobre una curva dada por f(t) → [x,y,z]. */
  function puntadas(p, f, n, mat, largo = .011, grueso = .0028) {
    const im = new T.InstancedMesh(esf(8), mat, n), m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(largo, grueso, grueso);
    for (let k = 0; k < n; k++) {
      const a = f(k / n), b = f((k + .02) / n), pa = V(...a), t = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      q.setFromUnitVectors(V(1, 0, 0), t); m4.compose(pa, q, s); im.setMatrixAt(k, m4);
    }
    im.castShadow = false; p.add(im); return im;
  }

  /* =================================================================
   * ESPECIES (colores y rasgos de cada personaje)
   * ================================================================= */
  const ESP = {
    conejita: { id: 'conejita', nombre: 'Conejita Fresa', col: { principal: '#F27C9B', secundario: '#FFF0E0', acento: '#FFB8CC' }, cuerpo: 'semillas', miembro: 'semillas', c0: (c) => c.secundario, desc: 'Pijama rosa fresa con capucha de conejita' },
    michi: { id: 'michi', nombre: 'Michi Caramelo', col: { principal: '#E8A55B', secundario: '#FFF1DC', acento: '#F4A3B5' }, cuerpo: 'barras', miembro: 'anillos', c0: (c) => tono(c.principal, .76), desc: 'Pijama de gatito atigrado color caramelo' },
    diablito: { id: 'diablito', nombre: 'Diablito Arándano', col: { principal: '#6D4C9F', secundario: '#CDB6F0', acento: '#FF9BCB' }, cuerpo: 'estrellas', miembro: 'liso', c0: () => '#FFE27A', desc: 'Pijama lila con cuernitos, alitas y estrellas' },
    perrito: { id: 'perrito', nombre: 'Perrito Nube de Leche', col: { principal: '#9CD3F2', secundario: '#FFF6E8', acento: '#6FAEE0' }, cuerpo: 'nubes', miembro: 'liso', c0: () => '#FFFFFF', desc: 'Pijama celeste con nubecitas y orejas caídas' },
    osito: { id: 'osito', nombre: 'Osito Latte', col: { principal: '#C69C72', secundario: '#F6E7D2', acento: '#8B5E3C' }, cuerpo: 'liso', miembro: 'liso', c0: () => '#FFFFFF', desc: 'Pijama café con leche con corazón de espuma' },
  };

  /** Materiales de una pijama según los colores que eligió el cliente. */
  function juego(ctx, e) {
    const C = { principal: ctx.col('principal'), secundario: ctx.col('secundario'), acento: ctx.col('acento') };
    const c0 = e.c0(C);
    return {
      C,
      P: felpa(C.principal, e.cuerpo, c0, [3, 2]),          // torso y pantalón
      Pm: felpa(C.principal, e.miembro, c0, e.miembro === 'anillos' ? [1, 3] : [1, 1]),  // mangas y piernas
      Pl: felpa(C.principal, 'liso', c0),                   // cola, manoplas, pantuflas
      Ph: felpa(C.principal, e.cuerpo, c0, [5, 2], { side: DS }),   // capucha
      Po: felpa(C.principal, e.id === 'conejita' ? 'semillas' : 'liso', c0, [3, 3]),  // orejas por fuera
      S: felpa(C.secundario, 'liso'),
      A: felpa(C.acento, 'liso'),
      H: M('#FFF7EA', { roughness: .4 }),                  // cierre
      hilo: M(tono(C.secundario, .86), { roughness: .8 }),
    };
  }

  /** Elástico/puño mullido: anillo horizontal de radio R. */
  const aro = (p, y, R, mat) => { const m = malla(geo('puno', () => new T.TorusGeometry(1, .26, 10, 24)), mat, 0, y, 0, p); m.scale.setScalar(R); m.rotation.x = PI / 2; return m; };

  /* ---------- Colas ---------- */
  function cola(e, J, cuerpo, ctx) {
    const g = grupo(cuerpo, 0, .56, -.17);
    if (e.id === 'conejita') {
      elip(.082, .082, .082, J.S, 0, .0, -.05, g, 20);
      for (let k = 0; k < 8; k++) { const a = k * DOS / 8; elip(.034, .034, .034, J.S, Math.sin(a) * .058, Math.cos(a) * .05, -.05 + Math.cos(a * 2) * .02, g, 8); }
      return (t) => { g.rotation.z = Math.sin(t * 2.4) * .12; };
    }
    if (e.id === 'michi') {
      const curva = new T.CatmullRomCurve3([V(0, 0, -.01), V(0, -.02, -.12), V(.02, .03, -.22), V(.05, .13, -.27), V(.03, .24, -.25), V(-.02, .3, -.2)]);
      const pts = curva.getPoints(12), r0 = .046, r1 = .038;
      const oscuro = felpa(tono(J.C.principal, .76), 'liso');
      for (let i = 0; i < 12; i++) {
        const a = pts[i], b = pts[i + 1], d = b.clone().sub(a), mt = i % 3 === 1 ? oscuro : J.Pl;
        const m = malla(geo('cil10', () => new T.CylinderGeometry(1, 1, 1, 12)), mt, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, g);
        m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize()); m.scale.set(r1 + (r0 - r1) * (1 - i / 12), d.length() * 1.04, r1 + (r0 - r1) * (1 - i / 12));
        elip(r1 + (r0 - r1) * (1 - i / 12), r1 + (r0 - r1) * (1 - i / 12), r1 + (r0 - r1) * (1 - i / 12), mt, a.x, a.y, a.z, g, 10);
      }
      const u = pts[12]; elip(.03, .03, .03, J.Pl, u.x, u.y, u.z, g, 10);
      return (t) => { g.rotation.z = Math.sin(t * 1.6) * .16; g.rotation.x = Math.sin(t * 1.1 + 1) * .05; };
    }
    if (e.id === 'diablito') {
      const curva = new T.CatmullRomCurve3([V(0, 0, -.01), V(0, -.03, -.1), V(.02, .0, -.2), V(.07, .06, -.26), V(.12, .14, -.26)]);
      const tubo = malla(geo('colaDiablo', () => new T.TubeGeometry(curva, 24, .014, 8, false)), J.P, 0, 0, 0, g);
      const corazon = malla(extruida('corazon', SHAPES.corazon, .3, .12), felpa(J.C.acento, 'liso'), .125, .16, -.26, g);
      corazon.scale.setScalar(.07); corazon.rotation.set(0, 0, -.55);
      return (t) => { g.rotation.z = Math.sin(t * 2.2) * .14; corazon.rotation.y = Math.sin(t * 2.2) * .3; };
    }
    if (e.id === 'perrito') {
      const m = elip(.036, .075, .036, J.Pl, 0, .035, -.04, g, 14); m.rotation.x = -.7;
      elip(.034, .034, .034, J.S, 0, .095, -.085, g, 10);
      return (t) => { g.rotation.z = Math.sin(t * 8) * .3; };
    }
    elip(.07, .07, .07, J.Pl, 0, .0, -.05, g, 16);
    return (t) => { g.rotation.z = Math.sin(t * 1.5) * .06; };
  }

  /** Alitas de diablito (van a la espalda del cuerpo). */
  function alitas(cuerpo, J) {
    const mat = felpa(J.C.secundario, 'liso', '#fff', [1, 1], { side: DS });
    const ps = [];
    for (const s of [-1, 1]) {
      const g = grupo(cuerpo, s * .07, .92, -.15);
      g.scale.set(s * 1.6, 1.6, 1.6);
      malla(extruida('ala', SHAPES.ala, .008, .006), mat, 0, 0, 0, g);
      ps.push([g, s]);
    }
    return (t) => ps.forEach(([g, s]) => { g.rotation.set(-.15, s * (.4 + Math.sin(t * 5) * .16), s * .25); });
  }

  /* ---------- Emblema bordado sobre la panza ---------- */
  const EMBLEMA = {
    conejita: (c, C) => { // fresita
      c.fillStyle = '#E8456B'; c.beginPath(); c.moveTo(128, 84); c.bezierCurveTo(70, 90, 78, 168, 128, 196); c.bezierCurveTo(178, 168, 186, 90, 128, 84); c.fill();
      c.fillStyle = '#FFE9C9'; for (const [x, y] of [[108, 118], [148, 118], [128, 136], [104, 154], [152, 154], [128, 172]]) { c.beginPath(); c.ellipse(x, y, 3, 5, 0, 0, DOS); c.fill(); }
      c.fillStyle = '#5BBF6A'; for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * .62; c.beginPath(); c.ellipse(128 + Math.cos(a) * 17, 84 + Math.sin(a) * 9, 15, 6, a, 0, DOS); c.fill(); }
    },
    michi: (c) => { // pescadito
      c.fillStyle = '#7FB6E8'; c.beginPath(); c.ellipse(120, 140, 44, 26, 0, 0, DOS); c.fill();
      c.beginPath(); c.moveTo(158, 140); c.lineTo(194, 112); c.lineTo(194, 168); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(98, 133, 7, 0, DOS); c.fill(); c.fillStyle = '#2B2B3A'; c.beginPath(); c.arc(97, 133, 3.4, 0, DOS); c.fill();
      c.strokeStyle = '#5E97CF'; c.lineWidth = 3; c.beginPath(); c.arc(128, 140, 14, -1, 1); c.stroke();
    },
    diablito: (c) => { // estrella y corazón
      c.fillStyle = '#FFD84A'; c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, rr = k % 2 ? 22 : 50; c.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
      c.closePath(); c.fill();
      c.fillStyle = '#FF7FB8'; c.beginPath(); c.moveTo(128, 172); c.bezierCurveTo(88, 150, 108, 126, 128, 142); c.bezierCurveTo(148, 126, 168, 150, 128, 172); c.fill();
    },
    perrito: (c) => { // huesito
      c.fillStyle = '#FFFFFF'; c.strokeStyle = '#8DB4D8'; c.lineWidth = 4;
      c.beginPath(); c.roundRect(88, 120, 80, 22, 10); c.fill(); c.stroke();
      for (const [x, y] of [[88, 118], [88, 144], [168, 118], [168, 144]]) { c.beginPath(); c.arc(x, y, 14, 0, DOS); c.fill(); c.stroke(); }
      c.beginPath(); c.roundRect(90, 122, 76, 18, 8); c.fill();
    },
    osito: (c, C) => { // corazón de espuma de latte
      c.fillStyle = C.acento; c.beginPath(); c.moveTo(128, 196); c.bezierCurveTo(52, 150, 78, 76, 128, 112); c.bezierCurveTo(178, 76, 204, 150, 128, 196); c.fill();
      c.fillStyle = '#FFF4E4'; c.beginPath(); c.moveTo(128, 178); c.bezierCurveTo(78, 146, 94, 100, 128, 124); c.bezierCurveTo(162, 100, 178, 146, 128, 178); c.fill();
      c.fillStyle = tono(C.acento, 1.15); c.beginPath(); c.moveTo(128, 160); c.bezierCurveTo(104, 142, 112, 122, 128, 134); c.bezierCurveTo(144, 122, 152, 142, 128, 160); c.fill();
    },
  };

  /* =================================================================
   * ARRIBA: cuerpo entero de la pijama
   * ================================================================= */
  function cuerpoEntero(ctx, e) {
    const J = juego(ctx, e), c = ctx.partes.cuerpo, H = ctx.H;
    H.torso({ desde: .5, hasta: 1.1, mat: J.P, ensanche: .045, holgura: .032 });
    H.cadera({ mat: J.P, holgura: .032 });
    [0, 1].forEach((i) => {
      H.manga(i, { hasta: 'larga', mat: J.Pm, holgura: .02 });
      const co = ctx.partes.codos[i];
      aro(co, -.152, .066, J.S);
      // manopla (patita) que tapa la mano
      elip(.07, .08, .064, J.Pl, 0, -.21, .008, co, 16);
      const b = felpa(J.C.acento, 'liso');
      if (e.id !== 'diablito') {
        elip(.024, .018, .01, b, 0, -.226, .066, co, 10);
        for (const [x, y] of [[-.034, -.19], [0, -.178], [.034, -.19]]) elip(.0115, .0115, .008, b, x, y, .066, co, 8);
      } else {
        for (const k of [-1, 0, 1]) elip(.0125, .02, .012, J.A, k * .033, -.268, .035, co, 8);
        elip(.022, .016, .009, J.A, 0, -.2, .069, co, 8);
      }
      H.pierna(i, { hasta: 'tobillo', mat: J.Pm, holgura: .02, bota: .012 });
      malla(geo('muslo2', () => new T.CylinderGeometry(.102, .09, .1, 18)), J.Pm, 0, -.19, 0, ctx.partes.piernas[i]);  // cubre la piel entre muslo y rodilla
      const r = ctx.partes.rodillas[i];
      aro(r, -.2, .099, J.S);
    });
    // cintura suave y cierre frontal
    const zon = (y, hol = .04) => { const p = H.sobreTorso(y, 0, hol); return [p.x, p.y, p.z]; };
    const cierre = new T.CatmullRomCurve3(Array.from({ length: 14 }, (_, k) => V(...zon(1.07 - k * .036))));
    malla(geo('cierre', () => new T.TubeGeometry(cierre, 26, .0042, 6, false)), J.H, 0, 0, 0, c).castShadow = false;
    const tirador = elip(.012, .022, .007, J.H, 0, 1.06, H.sobreTorso(1.06, 0, .042).z, c, 8);
    // panza con costura bordada y emblema
    const yP = e.id === 'diablito' ? .8 : .78, zP = (H.radioTorso(yP) + .032) * .8 - .018;
    const panza = elip(.122, .158, .05, J.S, 0, yP, zP, c, 24);
    puntadas(c, (t) => { const a = t * DOS; return [Math.cos(a) * .108, yP + Math.sin(a) * .139, zP + .05 * Math.sqrt(Math.max(0, 1 - .78 ** 2 * 1)) + .003]; }, 30, J.hilo);
    const dec = tex('emb|' + e.id + J.C.acento + J.C.principal, 256, 256, (cx) => { cx.clearRect(0, 0, 256, 256); EMBLEMA[e.id](cx, J.C); });
    const dm = malla(new T.PlaneGeometry(.1, .1), new T.MeshStandardMaterial({ map: dec, transparent: true, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2 }), 0, yP - .005, zP + .0505, c);
    dm.castShadow = false;
    // sombra de la costura central de la espalda y colita
    const animC = cola(e, J, c, ctx);
    const animA = e.id === 'diablito' ? alitas(c, J) : null;
    return { animar(t) { animC(t); animA && animA(t); } };
  }

  /* =================================================================
   * CABEZA: capucha con orejas (esconde el cabello)
   * ================================================================= */
  function capucha(ctx, e) {
    const J = juego(ctx, e), cab = ctx.partes.cabeza, g = grupo(cab);
    malla(geoCapucha(), J.Ph, 0, 0, 0, g);
    malla(geoRibete(), J.S, 0, 0, 0, g);
    // borde de abajo (cuello de la capucha)
    const bajo = malla(geo('cuelloCap', () => new T.TorusGeometry(1, .09, 10, 40)), J.S, 0, PERFIL[PERFIL.length - 1][1] + .004, 0, g);
    bajo.rotation.x = PI / 2; bajo.scale.set(.166, .166, 1); bajo.scale.z = 1;
    const anim = [];
    const ear = (tipo, dir, mat, mi, o) => {
      const p = oreja(g, tipo, dir, mat, mi, o); return p;
    };
    const retoque = (p, base, amp, f, ph, eje = 'z') => anim.push((t) => { const tw = Math.pow(Math.max(0, Math.sin(t * .8 + ph)), 14); p.rotation[eje] = base + Math.sin(t * f + ph) * amp + tw * .16 * Math.sign(base || 1); });
    if (e.id === 'conejita') {
      for (const s of [-1, 1]) retoque(ear('conejo', V(s * .34, .93, -.14), J.Po, J.A, { roll: s * -.25, pitch: -.12, interior: .62, cyIn: .078, escala: 1.5 }), s * -.25, .03, 1.2, s, 'z');
    } else if (e.id === 'michi') {
      for (const s of [-1, 1]) retoque(ear('gato', V(s * .66, .74, .04), J.Po, J.A, { roll: s * -.4, pitch: -.1, interior: .62, cyIn: .055, escala: 1.4 }), s * -.55, .025, 1.5, s * 2, 'z');
      // tres rayitas de gatito en la coronilla
      const rr = felpa(tono(J.C.principal, .74), 'liso');
      for (const [x, z, rot] of [[0, .2, 0], [-.2, .12, .5], [.2, .12, -.5]]) {
        const m = elip(.012, .006, .042, rr, 0, 0, 0, null, 10); sobreCasco(g, m, V(x, .95, z), .001); m.rotateY(rot);
      }
      // bigotes bordados en las mejillas de la capucha
      const hilo = M(tono(J.C.principal, .55), { roughness: .8 });
      for (const s of [-1, 1]) for (const [dy, ang] of [[.02, .3], [0, 0], [-.022, -.3]]) {
        const pts = [0, 1, 2, 3, 4].map((k) => { const x = s * (.2 + k * .022), y = -.075 + dy + ang * k * .012, r = radioEn(y) + .004; return V(x, y, Math.sqrt(Math.max(.001, r * r - x * x))); });
        malla(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 8, .0032, 5, false), hilo, 0, 0, 0, g).castShadow = false;
      }
    } else if (e.id === 'diablito') {
      const cuerno = (s) => geo('cuerno' + s, () => {
        const pts = [[0, 0], [.046, 0], [.049, .016], [.042, .05], [.028, .086], [.012, .11], [0, .116]].map(([x, y]) => new T.Vector2(x, y));
        const gm = new T.LatheGeometry(pts, 20), p = gm.attributes.position;
        for (let i = 0; i < p.count; i++) { const k = p.getY(i) / .116; p.setX(i, p.getX(i) - s * .035 * k * k); }
        gm.computeVertexNormals(); return gm;
      });
      for (const s of [-1, 1]) {
        const base = grupo(g), d = V(s * .36, .9, .24).normalize();
        base.position.copy(d.clone().multiplyScalar(RC * .99)); base.quaternion.setFromUnitVectors(V(0, 1, 0), d);
        const m = malla(cuerno(s), J.S, 0, 0, 0, base); m.rotation.x = -.15; m.scale.setScalar(1.35);
        const ri = M(tono(J.C.secundario, .85), { roughness: .8 });
        malla(geo('anilloCuerno', () => new T.TorusGeometry(.047, .008, 8, 20)), felpa(J.C.acento, 'liso'), 0, .012, 0, base).rotation.x = PI / 2;
      }
    } else if (e.id === 'perrito') {
      for (const s of [-1, 1]) {
        const p = grupo(g, s * .19, .205, -.02);
        p.rotation.z = s * .6;
        const q = grupo(p); q.rotation.y = s * PI / 2;
        malla(extruida('o_perro', SHAPES.perro, .02, .009), felpa(J.C.acento, 'liso'), 0, 0, 0, q).scale.setScalar(1.3);
        anim.push((t) => { p.rotation.z = s * (.6 + Math.sin(t * 1.4 + s) * .035 + Math.pow(Math.max(0, Math.sin(t * .9 + s * 3)), 12) * .14); });
      }
      // manchita en un ojo, sobre la capucha
      const parche = elip(.062, .01, .05, felpa(J.C.acento, 'liso'), 0, 0, 0, null, 14);
      sobreCasco(g, parche, V(.5, .72, .46), -.004); parche.rotateY(.6);
    } else {
      for (const s of [-1, 1]) retoque(ear('oso', V(s * .62, .76, -.04), J.Po, J.S, { roll: s * -.6, interior: .62, cyIn: .05, escala: 1.15 }), s * -.6, .02, 1.3, s * 3, 'z');
    }
    return { animar(t) { anim.forEach((f) => f(t)); } };
  }

  /* =================================================================
   * CALZADO: pantuflas a juego
   * ================================================================= */
  function pantuflas(ctx, tipo) {
    const C = { principal: ctx.col('principal'), secundario: ctx.col('secundario'), acento: ctx.col('acento') };
    const P = felpa(C.principal, tipo === 'fresa' ? 'semillas' : 'liso', C.secundario, [1, 1]), S = felpa(C.secundario, 'liso'), Ac = felpa(C.acento, 'liso');
    const suela = M(tono(C.secundario, .92), { roughness: .9 });
    [0, 1].forEach((i) => {
      const r = ctx.partes.rodillas[i];
      elip(.082, .062, .138, P, 0, -.228, .05, r, 20);
      elip(.087, .014, .142, S, 0, -.263, .05, r, 16);
      if (tipo === 'fresa') {
        const hoja = felpa(C.acento, 'liso');
        for (let k = 0; k < 5; k++) { const a = k * DOS / 5; const h = elip(.02, .006, .036, hoja, Math.sin(a) * .03, -.171, .09 + Math.cos(a) * .03, r, 8); h.rotation.set(-.2, a, 0); }
        elip(.012, .012, .012, hoja, 0, -.168, .09, r, 8);
      } else {
        for (const x of [-.042, 0, .042]) {
          elip(.029, .027, .029, P, x, -.222, .176 - Math.abs(x) * .25, r, 12);
          elip(.0125, .012, .007, Ac, x, -.222, .205 - Math.abs(x) * .25, r, 8);
        }
        elip(.026, .01, .022, Ac, 0, -.169, .1, r, 10).rotation.x = -.35;
      }
    });
  }

  /* =================================================================
   * REGISTRO
   * ================================================================= */
  const R = (cat, id, nombre, porDefecto, construir, extra) => A.registrar(cat, Object.assign({ id, nombre, grupo: 'Pijamas', colores: Object.keys(porDefecto), porDefecto, construir }, extra));
  for (const e of Object.values(ESP)) {
    R('arriba', 'dz_kig_' + e.id, 'Pijama ' + e.nombre, e.col, (ctx) => cuerpoEntero(ctx, e), { cubreAbajo: true });
    R('cabeza', 'dz_capucha_' + e.id, 'Capucha ' + e.nombre, e.col, (ctx) => capucha(ctx, e), { ocultaCabello: true, sinCabello: true, orejasAltas: true });
  }
  R('calzado', 'dz_pantufla_fresa', 'Pantuflas de fresa', { principal: '#F27C9B', secundario: '#FFF0E0', acento: '#6CC57C' }, (ctx) => pantuflas(ctx, 'fresa'));
  R('calzado', 'dz_pantufla_patita', 'Pantuflas de patita', { principal: '#E8A55B', secundario: '#FFF1DC', acento: '#F4A3B5' }, (ctx) => pantuflas(ctx, 'patita'));

  const a = (id, colores) => ({ id, colores });
  const N0 = { id: 'ninguno' };
  const D = (e, calzado, notas) => A.registrar('disfraz', {
    id: 'dz_kig_' + e.id, nombre: e.nombre, grupo: 'Destacados ✨', destacado: true, nuevo: true, descripcion: e.desc, colores: [], construir() {},
    aplica: { accesorio: N0, cara: N0, arriba: a('dz_kig_' + e.id), cabeza: a('dz_capucha_' + e.id), calzado },
  });
  D(ESP.conejita, a('dz_pantufla_fresa'));
  D(ESP.michi, a('dz_pantufla_patita'));
  D(ESP.diablito, a('dz_pantufla_patita', { principal: '#6D4C9F', secundario: '#CDB6F0', acento: '#FF9BCB' }));
  D(ESP.perrito, a('dz_pantufla_patita', { principal: '#9CD3F2', secundario: '#FFF6E8', acento: '#F5A9C2' }));
  D(ESP.osito, a('dz_pantufla_patita', { principal: '#C69C72', secundario: '#F6E7D2', acento: '#8B5E3C' }));
}
