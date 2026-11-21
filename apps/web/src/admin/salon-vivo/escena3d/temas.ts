import * as THREE from 'three';
import { formaCorazon, liberar, type Ctx } from './base';

/** Temáticas: solo decoran la escena 3D (Capri, luces y adornos). Los colores de Caprichos no cambian. */
export interface Tema {
  nombre: string; desc: string; uni: string; del: string; rib: string; gorro: string; gc: string; acc: string[]; luz: string; mues: string[];
  part: { colores: string[]; dir: number; vel: number; tam: number } | null; saludo: string;
}

export const TEMAS: Record<string, Tema> = {
  normal: { nombre: 'Clásico', desc: 'Plantas, luces cálidas', uni: '#E67929', del: '#1C1C22', rib: '#D99E39', gorro: 'chef', gc: '#FBF4EC', acc: [], luz: '#FFD9A8', mues: ['#0B2C3E', '#E67929', '#D99E39'], part: null, saludo: '¡Hola! Soy Capri, hoy te atiendo yo 😊' },
  navidad: { nombre: 'Navidad', desc: 'Árbol, nieve y guirnaldas', uni: '#B2500F', del: '#1F6B3A', rib: '#D99E39', gorro: 'navideno', gc: '#C5221F', acc: ['bufanda'], luz: '#FFE2B0', mues: ['#C5221F', '#1F6B3A', '#FFFFFF'], part: { colores: ['#FFFFFF', '#E8F4FF'], dir: -1, vel: 0.6, tam: 0.12 }, saludo: '¡Feliz Navidad! 🎄' },
  halloween: { nombre: 'Halloween', desc: 'Calabazas, murciélagos', uni: '#E67929', del: '#2B1B3F', rib: '#D99E39', gorro: 'bruja', gc: '#2B1B3F', acc: ['calabaza'], luz: '#C9A0FF', mues: ['#2B1B3F', '#FF7A1A', '#9B5DE5'], part: { colores: ['#FF8A1F', '#9B5DE5'], dir: 1, vel: 0.3, tam: 0.09 }, saludo: '¡Dulce o truco! 🎃' },
  patrias: { nombre: 'Fiestas Patrias', desc: 'Banderines rojiblancos', uni: '#FFFFFF', del: '#C5221F', rib: '#D99E39', gorro: 'chef', gc: '#FBF4EC', acc: ['bandera'], luz: '#FFE6E6', mues: ['#D91023', '#FFFFFF', '#D91023'], part: { colores: ['#D91023', '#FFFFFF'], dir: -1, vel: 0.5, tam: 0.1 }, saludo: '¡Felices Fiestas Patrias! 🇵🇪' },
  valentin: { nombre: 'San Valentín', desc: 'Corazones flotando', uni: '#E84A7F', del: '#4A1525', rib: '#FFD1DC', gorro: 'corona', gc: '#D99E39', acc: ['corazon'], luz: '#FFC2D6', mues: ['#E84A7F', '#FFD1DC', '#4A1525'], part: { colores: ['#FF6B9A', '#FFD1DC'], dir: 1, vel: 0.3, tam: 0.1 }, saludo: '¡Feliz San Valentín! 💗' },
  anonuevo: { nombre: 'Año Nuevo', desc: 'Globos dorados, confeti', uni: '#0B2C3E', del: '#D99E39', rib: '#FFFFFF', gorro: 'sombrero', gc: '#15151C', acc: ['estrellas'], luz: '#FFF1C9', mues: ['#0B2C3E', '#D99E39', '#7BE0C3'], part: { colores: ['#D99E39', '#7BE0C3', '#FF6B9A', '#FFFFFF'], dir: -1, vel: 0.55, tam: 0.1 }, saludo: '¡Feliz Año Nuevo! ✨' },
};

export interface Particulas {
  puntos: THREE.Points;
  tema: (p: Tema['part']) => void;
  mover: (t: number, dt: number) => void;
}

export function crearParticulas(ctx: Ctx, n: number): Particulas {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), fase = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * ctx.ancho; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * ctx.alto; fase[i] = Math.random() * 6.3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.1, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false });
  const puntos = new THREE.Points(geo, mat);
  puntos.visible = false;
  let cfg = { dir: -1, vel: 0.5 };
  return {
    puntos,
    tema(p) {
      puntos.visible = !!p && !ctx.reducir && !ctx.ligero;
      if (!p) return;
      cfg = p; mat.size = p.tam;
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) { c.set(p.colores[i % p.colores.length]); col.set([c.r, c.g, c.b], i * 3); }
      geo.attributes.color.needsUpdate = true;
    },
    mover(t, dt) {
      if (!puntos.visible) return;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        pos[k + 1] += cfg.dir * cfg.vel * dt * (0.6 + (i % 5) * 0.15);
        pos[k] += Math.sin(t * 0.7 + fase[i]) * dt * 0.2;
        if (pos[k + 1] > 6) pos[k + 1] = 0; else if (pos[k + 1] < 0) pos[k + 1] = 6;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

interface Animado { o: THREE.Object3D; tipo: string; f?: number }

export interface Decoracion {
  decorar: (tema: Tema, clave: string) => void;
  animar: (t: number) => void;
}

/** Decoración por temática: centros de mesa, árbol, calabazas, banderines, globos... en los rincones libres del plano. */
export function crearDecoracion(
  ctx: Ctx,
  luces: { hemi: THREE.HemisphereLight; calida: THREE.PointLight },
  centros: THREE.Group[],
  spots: THREE.Vector3[],
  particulas: Particulas,
): Decoracion {
  const { escena, M, malla } = ctx;
  let deco = new THREE.Group(); escena.add(deco);
  const animados: Animado[] = [];
  const zNorte = -ctx.alto / 2 + 0.55;

  function decorar(tema: Tema, clave: string) {
    escena.remove(deco); liberar(deco);
    deco = new THREE.Group(); escena.add(deco);
    animados.length = 0;
    const d = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => malla(geo, mat, x, y, z, deco);
    const sp = (i: number) => spots[i % Math.max(1, spots.length)] ?? new THREE.Vector3(0, 0, 0);
    for (const centro of centros) {
      centro.clear();
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; o.castShadow = true; centro.add(o); return o; };
      if (clave === 'navidad') { add(new THREE.ConeGeometry(0.12, 0.3, 12), M('#1F6B3A'), 0.15); add(new THREE.OctahedronGeometry(0.04), M('#F2C14E', { emissive: 0xD99E39, emissiveIntensity: 0.8 }), 0.33); }
      else if (clave === 'halloween') { add(new THREE.SphereGeometry(0.12, 14, 10), M('#FF7A1A'), 0.1).scale.y = 0.8; add(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 6), M('#2F7A45'), 0.2); }
      else if (clave === 'patrias') { add(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), M('#D99E39'), 0.2); ['#D91023', '#FFFFFF', '#D91023'].forEach((c, i) => { const f = add(new THREE.BoxGeometry(0.06, 0.12, 0.01), M(c), 0.33); f.position.x = 0.04 + i * 0.06; }); }
      else if (clave === 'valentin') { const h = add(new THREE.ExtrudeGeometry(formaCorazon(), { depth: 0.08, bevelEnabled: false }).center(), M('#E84A7F'), 0.18); h.scale.setScalar(0.35); animados.push({ o: h, tipo: 'late' }); }
      else if (clave === 'anonuevo') { add(new THREE.OctahedronGeometry(0.1), M('#D99E39', { metalness: 0.7, roughness: 0.2, emissive: 0xD99E39, emissiveIntensity: 0.3 }), 0.15); }
      else { add(new THREE.CylinderGeometry(0.05, 0.07, 0.14, 12), M('#FBF4EC'), 0.07); for (let k = 0; k < 3; k++) { const f = add(new THREE.SphereGeometry(0.045, 8, 6), M(['#E67929', '#D99E39', '#E84A7F'][k]), 0.19); f.position.x = (k - 1) * 0.045; } }
    }
    luces.calida.color.set(tema.luz);
    luces.hemi.color.set(tema.luz);
    const guirnalda = (colores: string[]) => {
      const n = Math.floor(ctx.ancho * 2);
      for (let i = 0; i < n; i++) {
        const x = -ctx.ancho / 2 + 0.6 + (i * (ctx.ancho - 1.2)) / n, c = colores[i % colores.length];
        const b = d(new THREE.SphereGeometry(0.07, 8, 6), M(c, { emissive: c, emissiveIntensity: 0.9 }), x, 1.55 - Math.abs(Math.sin(i * 0.6)) * 0.18, zNorte);
        animados.push({ o: b, tipo: 'brilla', f: i });
      }
    };
    const banderines = () => {
      const n = Math.floor(ctx.ancho * 1.8);
      for (let i = 0; i < n; i++) {
        const b = d(new THREE.ConeGeometry(0.16, 0.3, 3), M(i % 2 ? '#FFFFFF' : '#D91023', { side: THREE.DoubleSide }), -ctx.ancho / 2 + 0.7 + (i * (ctx.ancho - 1.4)) / n, 1.5 - Math.abs(Math.sin(i * 0.5)) * 0.15, zNorte);
        b.rotation.x = Math.PI; b.scale.z = 0.15;
        animados.push({ o: b, tipo: 'ondea', f: i });
      }
    };
    if (clave === 'normal') {
      for (const i of [0, 1, 2]) { const p = sp(i); d(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 14), M('#E67929'), p.x, 0.2, p.z); d(new THREE.SphereGeometry(0.35, 14, 10), M('#3E7B4F'), p.x, 0.7, p.z); }
    }
    if (clave === 'navidad') {
      const arbol = new THREE.Group(); arbol.position.copy(sp(0)); deco.add(arbol);
      [[0.7, 1.1, 0.7], [0.55, 0.9, 1.25], [0.38, 0.7, 1.7]].forEach(([r, h, y]) => malla(new THREE.ConeGeometry(r, h, 18), M('#1F6B3A'), 0, y, 0, arbol));
      malla(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10), M('#5B3A29'), 0, 0.15, 0, arbol);
      animados.push({ o: malla(new THREE.OctahedronGeometry(0.16), M('#F2C14E', { emissive: 0xF2C14E, emissiveIntensity: 1 }), 0, 2.15, 0, arbol), tipo: 'gira' });
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4, y = 0.5 + (k % 7) * 0.22, r = 0.65 - y * 0.25, c = ['#C5221F', '#F2C14E', '#3BB4E7'][k % 3];
        animados.push({ o: malla(new THREE.SphereGeometry(0.06, 8, 6), M(c, { emissive: c, emissiveIntensity: 0.6 }), Math.cos(a) * r, y, Math.sin(a) * r, arbol), tipo: 'brilla', f: k });
      }
      for (let i = 0; i < 4; i++) { const r = malla(new THREE.BoxGeometry(0.3, 0.25, 0.3), M(['#C5221F', '#D99E39', '#3BB4E7', '#1F6B3A'][i]), (i - 1.5) * 0.35, 0.12, 0.75, arbol); r.rotation.y = i; }
      guirnalda(['#C5221F', '#F2C14E', '#1F6B3A', '#3BB4E7']);
    }
    if (clave === 'halloween') {
      for (const i of [0, 1, 2, 3]) {
        const p = sp(i);
        const c = d(new THREE.SphereGeometry(0.3, 16, 12), M('#FF7A1A', { emissive: 0xFF7A1A, emissiveIntensity: 0.25 }), p.x, 0.25, p.z); c.scale.y = 0.8;
        d(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), M('#2F7A45'), p.x, 0.5, p.z);
      }
      for (let k = 0; k < 6; k++) {
        const m = new THREE.Group(); deco.add(m);
        for (const s of [-1, 1]) { const a = malla(new THREE.ConeGeometry(0.18, 0.35, 3), M('#1C1C22'), s * 0.18, 0, 0, m); a.rotation.z = (s * Math.PI) / 2; a.scale.z = 0.2; }
        malla(new THREE.SphereGeometry(0.08, 8, 6), M('#1C1C22'), 0, 0, 0, m);
        animados.push({ o: m, tipo: 'murcielago', f: k * 1.05 });
      }
      const morada = new THREE.PointLight(0x9B5DE5, 14, 14, 1); morada.position.set(4, 3, 2); deco.add(morada);
      guirnalda(['#FF7A1A', '#9B5DE5']);
    }
    if (clave === 'patrias') {
      banderines();
      const asta = new THREE.Group(); asta.position.copy(sp(0)); deco.add(asta);
      malla(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), M('#D99E39'), 0, 1.2, 0, asta);
      ['#D91023', '#FFFFFF', '#D91023'].forEach((c, i) => animados.push({ o: malla(new THREE.BoxGeometry(0.3, 0.55, 0.02), M(c, { side: THREE.DoubleSide }), 0.17 + i * 0.3, 2.1, 0, asta), tipo: 'ondea', f: i }));
    }
    if (clave === 'valentin') {
      for (let k = 0; k < 10; k++) {
        const h = d(new THREE.ExtrudeGeometry(formaCorazon(), { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).center(), M(k % 2 ? '#E84A7F' : '#FFD1DC', { emissive: 0xE84A7F, emissiveIntensity: 0.2 }), -ctx.ancho * 0.35 + k * (ctx.ancho * 0.08), 2.6, -1 + (k % 3) * 2);
        h.scale.setScalar(0.6); animados.push({ o: h, tipo: 'flota', f: k });
      }
      guirnalda(['#E84A7F', '#FFD1DC']);
    }
    if (clave === 'anonuevo') {
      for (const i of [0, 1, 2]) {
        const p = sp(i);
        for (let k = 0; k < 4; k++) {
          const b = d(new THREE.SphereGeometry(0.22, 16, 12), M(['#D99E39', '#E2E8EC', '#0B2C3E', '#D99E39'][k], { metalness: 0.6, roughness: 0.2 }), p.x + ((k % 2) - 0.5) * 0.35, 1.6 + k * 0.25, p.z + (k > 1 ? 0.2 : -0.2));
          b.scale.y = 1.15; animados.push({ o: b, tipo: 'flota', f: k + i });
          d(new THREE.CylinderGeometry(0.004, 0.004, 1.5, 4), M('#FFFFFF'), p.x, 0.75, p.z);
        }
      }
      guirnalda(['#D99E39', '#FFFFFF', '#7BE0C3']);
    }
    particulas.tema(tema.part);
  }

  function animar(t: number) {
    if (ctx.reducir) return;
    for (const a of animados) {
      const o = a.o as any;
      if (a.tipo === 'gira') o.rotation.y = t * 1.5;
      else if (a.tipo === 'brilla') o.material.emissiveIntensity = 0.3 + (Math.sin(t * 3 + (a.f ?? 0)) * 0.5 + 0.5) * 0.9;
      else if (a.tipo === 'ondea') o.rotation.y = Math.sin(t * 3 + (a.f ?? 0)) * 0.4;
      else if (a.tipo === 'late') o.scale.setScalar(0.35 + Math.sin(t * 4) * 0.04);
      else if (a.tipo === 'flota') { o.position.y += Math.sin(t * 1.4 + (a.f ?? 0)) * 0.004; o.rotation.y = Math.sin(t + (a.f ?? 0)) * 0.6; }
      else if (a.tipo === 'murcielago') {
        const f = a.f ?? 0, r = 4 + (f % 2), ang = t * 0.5 + f;
        o.position.set(Math.cos(ang) * r + 2, 2.8 + Math.sin(t * 2 + f) * 0.3, Math.sin(ang) * r * 0.5 + 2);
        o.rotation.y = -ang;
        o.children[0].rotation.x = Math.sin(t * 14 + f) * 0.5; o.children[1].rotation.x = -Math.sin(t * 14 + f) * 0.5;
      }
    }
  }
  return { decorar, animar };
}
