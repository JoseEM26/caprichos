/* eslint-disable -- piezas pasadas tal cual de la maqueta aprobada (no se reescriben a mano) */
/*
 * Núcleo del avatar de Caprichos: cuerpo base con medidas fijas, ayudas para prendas que calzan con el cuerpo
 * y el registro de piezas. Cada archivo de piezas (cabello.js, ropa.js, disfraces.js) solo llama a AVATAR.registrar.
 *
 * CONTRATO (no cambiar sin avisar a quienes escriben piezas):
 *  - Unidades: el avatar mide ~1.75 de alto, pies en y = 0, mira hacia +z.
 *  - Grupos animables en ctx.partes: cuerpo, cabeza (centro de la cabeza), brazos[0|1] (hombro; 0 = derecho del avatar, x < 0),
 *    codos[0|1], piernas[0|1] (cadera), rodillas[0|1]. Las prendas que van en brazos o piernas se agregan DENTRO de esos grupos.
 *  - Medidas en AVATAR.MED. Nada de cabello, gorro ni máscara puede tapar los ojos salvo que sea una máscara (categoría cara).
 *    Regla de la frente: en la cara (z > 0.12 dentro de la cabeza) nada del cabello baja de MED.frenteY.
 */
// @ts-nocheck
/* Pasado de la maqueta aprobada (three 0.147) a módulo: sin window.THREE ni window.AVATAR. */
import * as T from 'three';

let _A;

{

  const MED = {
    caderaY: .52, hombroY: 1.02, cuelloY: 1.13, cabezaY: 1.44, cabezaR: .27,
    ojoY: .02, ojoX: .1, ojoZ: .222, cejaY: .125, bocaY: -.118, orejaX: .262,
    frenteY: .16,          // borde inferior permitido del cabello en la frente (coordenada local de la cabeza)
    muslo: .26, pierna: .25, brazo: .22, antebrazo: .2,
    radioMuslo: .078, radioPierna: .064, radioBrazo: .056, radioAntebrazo: .048,
    holgura: .014,         // espesor mínimo de una prenda sobre la piel
  };

  /* ---------- Materiales y mallas ---------- */
  const cacheMat = new Map();
  function M(color, o = {}) {
    const clave = color + JSON.stringify(o);
    if (!o.map && cacheMat.has(clave)) return cacheMat.get(clave);
    const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: .62, metalness: 0 }, o));
    if (!o.map) cacheMat.set(clave, m);
    return m;
  }
  function malla(geo, mat, x = 0, y = 0, z = 0, padre) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (padre) padre.add(m);
    return m;
  }
  const caja = (w, h, d, mat, x, y, z, p) => malla(new T.BoxGeometry(w, h, d), mat, x, y, z, p);
  const esfera = (r, mat, x, y, z, p, seg = 20) => malla(new T.SphereGeometry(r, seg, Math.max(8, seg * .75 | 0)), mat, x, y, z, p);
  const capsula = (r, largo, mat, x, y, z, p) => malla(new T.CapsuleGeometry(r, largo, 6, 16), mat, x, y, z, p);
  function texCanvas(w, h, dibujar, repetir = [1, 1]) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    dibujar(cv.getContext('2d'), w, h);
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repetir); t.anisotropy = 4;
    return t;
  }
  /** Color más oscuro o claro (f < 1 oscurece). */
  const tono = (color, f) => '#' + new T.Color(color).multiplyScalar(f).getHexString();

  /* ---------- Perfil del torso (radio por altura) ---------- */
  function perfilTorso(genero) {
    // [radio, y] de abajo hacia arriba; el torso se escala en z (.8) para no ser un cilindro
    if (genero === 'hombre') return [[.0, .47], [.15, .48], [.18, .55], [.178, .66], [.172, .78], [.19, .9], [.22, .99], [.2, 1.06], [.12, 1.11], [.0, 1.125]];
    if (genero === 'mujer') return [[.0, .47], [.152, .48], [.19, .56], [.178, .65], [.15, .76], [.172, .86], [.19, .94], [.188, 1.0], [.17, 1.06], [.1, 1.11], [.0, 1.125]];
    return [[.0, .47], [.15, .48], [.185, .56], [.176, .66], [.162, .77], [.18, .88], [.2, .97], [.195, 1.04], [.11, 1.11], [.0, 1.125]];
  }
  const ESCALA_Z_TORSO = .8;
  function radioEn(perfil, y) {
    for (let i = 0; i < perfil.length - 1; i++) {
      const [r0, y0] = perfil[i], [r1, y1] = perfil[i + 1];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0 || 1));
    }
    return y < perfil[0][1] ? perfil[0][0] : perfil[perfil.length - 1][0];
  }

  /* =================================================================
   * AYUDAS PARA PRENDAS (todas usan las medidas del cuerpo construido)
   * ================================================================= */
  function ayudas(partes) {
    const { perfil } = partes;
    return {
      /**
       * Prenda del torso que sigue la forma del cuerpo. desde/hasta en y del cuerpo (0.47..1.12).
       * holgura: cuánto se separa de la piel. cierreArriba: si true cierra en el cuello (cafarena/cuello alto usa cuello()).
       * mat: material. lados: 'DoubleSide' para prendas abiertas.
       */
      torso({ desde = .5, hasta = 1.1, holgura = MED.holgura, mat, ensanche = 0, cerrado = true } = {}) {
        const pts = [];
        const n = 18;
        for (let i = 0; i <= n; i++) {
          const y = desde + (hasta - desde) * (i / n);
          const extra = ensanche * Math.pow(1 - i / n, 2); // ensanche abajo (blusas, chaquetas sueltas)
          pts.push(new T.Vector2(Math.max(.001, radioEn(perfil, y) + holgura + extra), y));
        }
        if (cerrado && hasta >= 1.1) pts.push(new T.Vector2(.001, hasta + .01));
        const m = malla(new T.LatheGeometry(pts, 40), mat, 0, 0, 0, partes.cuerpo);
        m.scale.set(partes.ancho, 1, ESCALA_Z_TORSO);
        return m;
      },
      /** Radio del torso (sin escala) a una altura dada: útil para colocar botones, bolsillos, logos sobre el pecho. */
      radioTorso: (y) => radioEn(perfil, y),
      /** Punto sobre la superficie del torso: ángulo 0 = frente (+z), positivo hacia la izquierda del avatar (+x). */
      sobreTorso(y, angulo = 0, holgura = MED.holgura + .004) {
        const r = radioEn(perfil, y) + holgura;
        return new T.Vector3(Math.sin(angulo) * r * partes.ancho, y, Math.cos(angulo) * r * ESCALA_Z_TORSO);
      },
      /** Manga sobre el brazo i (0 = derecho). hasta: 'hombro' (sin manga, solo hombrera) | 'corta' | 'codo' | 'larga'. */
      manga(i, { hasta = 'corta', holgura = MED.holgura, mat, puño = null, acampanada = 0 } = {}) {
        const h = partes.brazos[i], c = partes.codos[i];
        esfera(MED.radioBrazo + .022 + holgura, mat, 0, 0, 0, h);
        if (hasta === 'hombro') return;
        const largoArriba = hasta === 'corta' ? .1 : .16;
        capsula(MED.radioBrazo + holgura, largoArriba, mat, 0, -largoArriba / 2 - .02, 0, h);
        if (hasta === 'larga') {
          const g = acampanada ? new T.CylinderGeometry(MED.radioAntebrazo + holgura, MED.radioAntebrazo + holgura + acampanada, .17, 16) : new T.CapsuleGeometry(MED.radioAntebrazo + holgura, .12, 6, 14);
          malla(g, mat, 0, -.09, 0, c);
          if (puño) malla(new T.CylinderGeometry(MED.radioAntebrazo + holgura + .006, MED.radioAntebrazo + holgura + .006, .035, 16), puño, 0, -.16, 0, c);
        } else if (hasta === 'codo') {
          capsula(MED.radioAntebrazo + holgura, .02, mat, 0, -.01, 0, c);
        }
      },
      /** Pierna de pantalón o media en la pierna i. hasta: 'muslo' (short) | 'rodilla' (bermuda) | 'tobillo'. */
      pierna(i, { hasta = 'tobillo', holgura = MED.holgura, mat, bota = 0, basta = null } = {}) {
        const p = partes.piernas[i], r = partes.rodillas[i];
        const largoMuslo = hasta === 'muslo' ? .13 : .2;
        malla(new T.CylinderGeometry(MED.radioMuslo + holgura + .004, MED.radioMuslo + holgura, largoMuslo, 18), mat, 0, -largoMuslo / 2 + .02, 0, p);
        if (hasta === 'muslo') return;
        if (hasta === 'rodilla') { esfera(MED.radioPierna + holgura + .006, mat, 0, -.02, 0, r); return; }
        esfera(MED.radioPierna + holgura + .006, mat, 0, 0, 0, r);
        malla(new T.CylinderGeometry(MED.radioPierna + holgura, MED.radioPierna + holgura + bota, .21, 18), mat, 0, -.1, 0, r);
        if (basta) malla(new T.CylinderGeometry(MED.radioPierna + holgura + bota + .004, MED.radioPierna + holgura + bota + .004, .03, 18), basta, 0, -.2, 0, r);
      },
      /** Pelvis/calzón que une las dos piernas del pantalón con el torso. */
      cadera({ holgura = MED.holgura, mat } = {}) {
        const m = esfera(.17 + holgura, mat, 0, .54, 0, partes.cuerpo, 24);
        m.scale.set(partes.ancho * 1.08, .62, .86);
        return m;
      },
      /** Falda o parte baja de vestido: tronco de cono abierto desde la cintura. largo hacia abajo, vuelo = radio extra abajo. */
      falda({ desdeY = .66, largo = .26, vuelo = .1, mat, pliegues = 0 } = {}) {
        const r0 = radioEn(perfil, desdeY) + MED.holgura;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          pts.push(new T.Vector2(r0 + vuelo * Math.pow(k, .85) + (pliegues ? 0 : 0), desdeY - largo * k));
        }
        const g = new T.LatheGeometry(pts.reverse(), Math.max(24, pliegues * 4 || 40));
        if (pliegues) {
          const pos = g.attributes.position;
          for (let j = 0; j < pos.count; j++) {
            const x = pos.getX(j), z = pos.getZ(j), a = Math.atan2(z, x), y = pos.getY(j);
            const f = 1 + Math.sin(a * pliegues) * .035 * ((desdeY - y) / largo);
            pos.setX(j, x * f); pos.setZ(j, z * f);
          }
          g.computeVertexNormals();
        }
        const mat2 = mat.clone(); mat2.side = T.DoubleSide;
        const m = malla(g, mat2, 0, 0, 0, partes.cuerpo);
        m.scale.set(partes.ancho, 1, .9);
        return m;
      },
      /** Cuello de prenda: 'redondo' | 'v' | 'alto' (cafarena) | 'camisa' | 'capucha'. */
      cuello(tipo, mat, mat2) {
        const cu = partes.cuerpo;
        if (tipo === 'redondo') malla(new T.TorusGeometry(.078, .016, 8, 24), mat2 || mat, 0, 1.105, 0, cu).rotation.x = Math.PI / 2;
        if (tipo === 'alto') malla(new T.CylinderGeometry(.074, .084, .1, 24), mat, 0, 1.16, 0, cu);
        if (tipo === 'v') {
          const v = caja(.07, .1, .01, M(partes.c.piel), 0, 1.07, ESCALA_Z_TORSO * (radioEn(perfil, 1.07) + MED.holgura) + .003, cu);
          v.rotation.z = Math.PI / 4; v.scale.set(.7, .7, 1);
        }
        if (tipo === 'camisa') for (const s of [-1, 1]) {
          const c = caja(.085, .045, .012, mat2 || mat, s * .055, 1.105, .1, cu);
          c.rotation.set(-.5, 0, s * .55);
        }
        if (tipo === 'capucha') {
          const h = malla(new T.SphereGeometry(.17, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 1.12, -.14, cu);
          h.rotation.x = -1.45; h.scale.set(1, 1, .7);
        }
      },
      /** Casquete de cabello sobre la cabeza. Respeta la frente (MED.frenteY) con la inclinación por defecto. */
      casquete({ radio = MED.cabezaR + .014, inclinacion = -.7, cobertura = .507, mat }) {
        const m = malla(new T.SphereGeometry(radio, 40, 24, 0, Math.PI * 2, 0, Math.PI * cobertura), mat, 0, 0, 0, partes.cabeza);
        m.rotation.x = inclinacion;
        return m;
      },
      /** Punto sobre la cabeza: elev = ángulo vertical (0 = altura de los ojos, π/2 = coronilla), azim = 0 frente, + hacia la izquierda. */
      sobreCabeza(elev, azim = 0, extra = .01) {
        const r = MED.cabezaR + extra;
        return new T.Vector3(Math.sin(azim) * Math.cos(elev) * r, Math.sin(elev) * r, Math.cos(azim) * Math.cos(elev) * r);
      },
    };
  }

  /* =================================================================
   * CUERPO BASE
   * ================================================================= */
  function cuerpoBase(c) {
    const raiz = new T.Group(), cuerpo = new T.Group(); raiz.add(cuerpo);
    const piel = M(c.piel, { roughness: .55 });
    const pielOsc = M(tono(c.piel, .9), { roughness: .55 });
    const ancho = c.genero === 'hombre' ? 1.06 : c.genero === 'mujer' ? .94 : 1;
    const perfil = perfilTorso(c.genero);
    const partes = { raiz, cuerpo, c, perfil, ancho, brazos: [], codos: [], piernas: [], rodillas: [], animables: [] };
    // Torso (piel; la ropa va encima)
    const pts = perfil.map(([r, y]) => new T.Vector2(Math.max(.001, r), y));
    const torso = malla(new T.LatheGeometry(pts, 40), piel, 0, 0, 0, cuerpo);
    torso.scale.set(ancho, 1, ESCALA_Z_TORSO);
    partes.torso = torso;
    // Cuello
    malla(new T.CylinderGeometry(.058, .066, .12, 18), piel, 0, MED.cuelloY + .03, 0, cuerpo);
    // Piernas con rodilla y pie descalzo (el calzado lo tapa)
    for (const s of [-1, 1]) {
      const p = new T.Group(); p.position.set(s * .094, MED.caderaY, 0); cuerpo.add(p);
      capsula(MED.radioMuslo, .12, piel, 0, -.12, 0, p);
      const r = new T.Group(); r.position.y = -MED.muslo; p.add(r);
      capsula(MED.radioPierna, .14, piel, 0, -.1, 0, r);
      const pie = esfera(.06, piel, 0, -.235, .03, r); pie.scale.set(1, .55, 1.6);
      partes.piernas.push(p); partes.rodillas.push(r);
    }
    // Brazos con codo y manos
    for (const s of [-1, 1]) {
      const h = new T.Group(); h.position.set(s * (.205 * ancho + .02), MED.hombroY, 0); h.rotation.z = s * .1; cuerpo.add(h);
      esfera(MED.radioBrazo + .012, piel, 0, 0, 0, h);
      capsula(MED.radioBrazo, .14, piel, 0, -.1, 0, h);
      const co = new T.Group(); co.position.y = -MED.brazo; h.add(co);
      capsula(MED.radioAntebrazo, .12, piel, 0, -.085, 0, co);
      const mano = esfera(.056, piel, 0, -.195, .005, co); mano.scale.set(.85, 1.05, .7);
      const pulgar = esfera(.022, piel, -s * -.035, -.18, .03, co); pulgar.scale.set(1, 1.4, 1);
      partes.brazos.push(h); partes.codos.push(co);
    }
    // Cabeza
    const cabeza = new T.Group(); cabeza.position.set(0, MED.cabezaY, 0); cuerpo.add(cabeza);
    partes.cabeza = cabeza;
    const craneo = esfera(MED.cabezaR, piel, 0, 0, 0, cabeza, 40); craneo.scale.set(1, .97, .95);
    const mandibula = esfera(.2, piel, 0, -.09, .045, cabeza, 32); mandibula.scale.set(1.08, .78, .9);
    for (const s of [-1, 1]) {
      const o = esfera(.055, piel, s * MED.orejaX, -.01, -.005, cabeza); o.scale.set(.55, 1, .8);
      esfera(.03, pielOsc, s * (MED.orejaX + .006), -.01, .004, cabeza).scale.set(.4, .7, .6);
    }
    const nariz = esfera(.03, pielOsc, 0, -.035, .262, cabeza); nariz.scale.set(1.1, .9, .9);
    partes.nariz = nariz;
    // Ojos con párpado (parpadeo escalando el grupo)
    partes.ojos = [];
    for (const s of [-1, 1]) {
      const o = new T.Group(); o.position.set(s * MED.ojoX, MED.ojoY, MED.ojoZ); cabeza.add(o);
      esfera(.056, M('#FFFFFF', { roughness: .25 }), 0, 0, 0, o).scale.z = .45;
      esfera(.039, M(c.ojos, { roughness: .2 }), 0, -.004, .022, o).scale.z = .35;
      esfera(.02, M('#0A0A0E', { roughness: .1 }), 0, -.004, .034, o).scale.z = .35;
      esfera(.011, M('#FFFFFF', { emissive: 0xffffff, emissiveIntensity: .8 }), .014, .014, .04, o);
      esfera(.006, M('#FFFFFF', { emissive: 0xffffff, emissiveIntensity: .8 }), -.012, -.016, .04, o);
      if (c.genero === 'mujer') for (let k = 0; k < 3; k++) caja(.011, .028, .005, M('#14141A'), s * (.022 + k * .017), .05, .018, o).rotation.z = s * (-.35 - k * .28);
      partes.ojos.push(o);
    }
    // Cejas (color del cabello)
    const colCeja = (c.cabello && c.cabello.colores && c.cabello.colores.principal) || '#4A2C1D';
    partes.cejas = [];
    for (const s of [-1, 1]) {
      const ce = capsula(c.genero === 'hombre' ? .012 : .009, .055, M(colCeja), s * MED.ojoX, MED.cejaY, .243, cabeza);
      ce.rotation.z = Math.PI / 2 + s * .12;
      partes.cejas.push(ce);
      const mej = esfera(.042, M('#F28C7A', { transparent: true, opacity: .4 }), s * .155, -.07, .208, cabeza);
      mej.scale.z = .3; mej.rotation.y = s * .65;
    }
    // Boca según expresión
    const boca = new T.Group(); boca.position.set(0, MED.bocaY, .245); cabeza.add(boca);
    const labio = M('#8E3B2E', { roughness: .4 });
    if (c.expresion === 'sorpresa') { malla(new T.TorusGeometry(.024, .011, 8, 18), labio, 0, 0, 0, boca); esfera(.02, M('#5A1F18'), 0, 0, -.004, boca).scale.z = .3; partes.cejas.forEach((ce) => { ce.position.y += .022; }); }
    else {
      const r = c.expresion === 'feliz' ? .055 : .042;
      malla(new T.TorusGeometry(r, .011, 8, 20, Math.PI), labio, 0, .012, 0, boca).rotation.z = Math.PI;
      if (c.expresion === 'feliz') { const d = malla(new T.CircleGeometry(r - .006, 20, Math.PI, Math.PI), M('#FFFFFF'), 0, .013, -.003, boca); d.scale.y = .5; }
    }
    partes.boca = boca;
    return partes;
  }

  /* =================================================================
   * REGISTRO DE PIEZAS
   * ================================================================= */
  const CATEGORIAS = ['cabello', 'arriba', 'abajo', 'calzado', 'accesorio', 'cabeza', 'cara', 'disfraz', 'mascota'];
  const REG = Object.fromEntries(CATEGORIAS.map((k) => [k, []]));
  /**
   * def = { id, nombre, grupo, colores: ['principal', 'secundario'?, 'acento'?], porDefecto: { principal: '#hex', ... },
   *         construir(ctx) → opcional { animar(t, dt) } ; ocultaCabello?: true (cascos, gorros cerrados) ; alto?: true (gorros altos)
   *         // solo disfraz: aplica: { arriba: { id, colores }, cabeza: {...}, piel?: '#hex', ... } }
   */
  function registrar(cat, def) {
    if (!REG[cat]) throw new Error('Categoría desconocida: ' + cat);
    if (REG[cat].some((d) => d.id === def.id)) { console.warn('Pieza repetida', cat, def.id); return; }
    REG[cat].push(def);
  }
  const buscar = (cat, id) => REG[cat].find((d) => d.id === id);
  // Piezas vacías (siempre existen)
  for (const cat of ['accesorio', 'cabeza', 'cara']) registrar(cat, { id: 'ninguno', nombre: 'Nada', grupo: 'Básico', colores: [], construir() {} });
  registrar('cabello', { id: 'calvo', nombre: 'Sin cabello', grupo: 'Corto', colores: [], construir() {} });

  /** Orden de construcción: lo de abajo primero. */
  const ORDEN = ['abajo', 'arriba', 'calzado', 'accesorio', 'cabello', 'cabeza', 'cara'];

  function construir(c) {
    const partes = cuerpoBase(c);
    const H = ayudas(partes);
    const defCabeza = c.cabeza && buscar('cabeza', c.cabeza.id);
    const animadores = [];
    const defArriba = c.arriba && buscar('arriba', c.arriba.id);
    for (const cat of ORDEN) {
      if (cat === 'abajo' && defArriba && defArriba.cubreAbajo) continue; // vestidos y enterizos tapan lo de abajo
      const sel = c[cat];
      if (!sel) continue;
      const def = buscar(cat, sel.id);
      if (!def) continue;
      const colores = Object.assign({}, def.porDefecto || {}, sel.colores || {});
      const ctx = {
        T, c, sel, partes, H, MED, M, malla, caja, esfera, capsula, texCanvas, tono,
        col: (slot) => colores[slot] || '#888888',
        mat: (slot, o) => M(colores[slot] || '#888888', o),
        conGorro: Boolean(defCabeza && defCabeza.id !== 'ninguno'),
        gorroOcultaCabello: Boolean(defCabeza && defCabeza.ocultaCabello),
      };
      try {
        const r = def.construir(ctx);
        if (r && typeof r.animar === 'function') animadores.push(r.animar);
      } catch (e) { console.error('Falló la pieza', cat, sel.id, e); }
    }
    // Mascota: grupo aparte AL LADO del avatar (a su izquierda de cámara, +x), en el piso; las voladoras flotan a la altura del hombro.
    // Mira hacia +z. Los consumidores pueden sacarla de partes.raiz (escena del editor, salón) y moverla.
    const selM = c.mascota && c.mascota.id !== 'ninguno' && buscar('mascota', c.mascota.id);
    if (selM) {
      try {
        const g = new T.Group();
        const colM = Object.assign({}, selM.porDefecto || {}, c.mascota.colores || {});
        g.userData = { base: selM.volador ? .95 : 0, volador: Boolean(selM.volador), alegria: 0, descanso: false };
        g.scale.setScalar(1.3);
        g.position.set(.6, g.userData.base, .05);
        g.rotation.y = -.25;
        partes.raiz.add(g);
        const ctxM = { T, g, M, tono, col: (s) => colM[s] || '#888888' };
        const r = selM.construir(ctxM);
        g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        partes.mascota = g;
        partes.mascotaNombre = String(c.mascota.nombre || '').slice(0, 14);
        partes.mascotaAlegrar = (s = 2) => { g.userData.alegria = Math.max(g.userData.alegria, s); };
        if (r && typeof r.animar === 'function') animadores.push((t, dt) => {
          g.userData.alegria = Math.max(0, g.userData.alegria - dt);
          r.animar(t, dt, Math.min(1, g.userData.alegria));
        });
      } catch (e) { console.error('Falló la mascota', c.mascota.id, e); }
    }
    partes.animar = (t, dt) => animadores.forEach((f) => { try { f(t, dt); } catch (e) { /* una pieza rota no frena al resto */ } });
    return partes;
  }

  _A = { T, MED, M, malla, caja, esfera, capsula, texCanvas, tono, registrar, buscar, construir, REG, CATEGORIAS };
}

export const AVATAR = _A;
