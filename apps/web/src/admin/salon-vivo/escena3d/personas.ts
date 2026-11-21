import * as THREE from 'three';
import { azar, type Ctx } from './base';
import type { Tema } from './temas';

/** Personas, Capri, bandejas y moto: las piezas vivas de la escena (portadas de la maqueta aprobada). */
const PIELES = ['#F1C9A5', '#E0AC80', '#C68B5E', '#8D5A3B', '#FFD9B5'];
const PELOS = ['#2B1B14', '#4A2C1D', '#14141A', '#7A4A2A', '#B07A45'];
const ROPAS = ['#5B7C99', '#E9D8C4', '#3E6B55', '#8E2856', '#D99E39', '#A9B7C2', '#6B4E9B', '#C25B3A'];
const ESTILOS = ['corto', 'largo', 'cola', 'mono', 'rizado'];
const PANTALONES = ['#2E3A46', '#3B4F6B', '#5A4636', '#1C1C22', '#6B7C8A'];

export interface Persona {
  raiz: THREE.Group;
  cuerpo: THREE.Group;
  piernas: THREE.Group[];
  rodillas: THREE.Group[];
  brazos: THREE.Group[];
  codos: THREE.Group[];
  cabeza: THREE.Group;
  ojos: THREE.Mesh[];
  boca: THREE.Mesh;
  cola: THREE.Group | null;
  tel: THREE.Mesh;
  rol: string;
  semilla: number;
  usaCel: boolean;
  ritmo: number;
  paso: number;
  sentado?: boolean;
  manoArriba?: boolean;
  carga?: boolean;
  enMoto?: boolean;
  trabajando?: number;
  saludaHasta?: number;
  anotaHasta?: number;
  limpiaHasta?: number;
  zona?: { carga?: number } | null;
  fase?: number;
  mesaId?: string;
  mesaCx?: number;
  mesaCz?: number;
  /** Cliente dibujado con su avatar real (cuenta para el tope de avatares a la vez) */
  avatarReal?: boolean;
  /** Animación propia de las piezas del avatar (se llama en cada cuadro) */
  animarExtra?: (t: number, dt: number) => void;
}

export interface OpcionesPersona {
  piel?: string; pelo?: string; ropa?: string; pantalon?: string; gorro?: string | null; mandil?: string | null;
  largo?: boolean; estilo?: string; lentes?: boolean; rol?: string;
}

export function persona(ctx: Ctx, gente: Set<Persona>, o: OpcionesPersona = {}): Persona {
  const { M, malla } = ctx;
  const piel = o.piel ?? azar(PIELES), pelo = o.pelo ?? azar(PELOS), ropa = o.ropa ?? azar(ROPAS), pantalon = o.pantalon ?? azar(PANTALONES);
  const gorro = o.gorro ?? null, mandil = o.mandil ?? null, rol = o.rol ?? 'cliente';
  const estilo = o.estilo ?? (o.largo ? 'largo' : azar(ESTILOS));
  const lentes = o.lentes ?? Math.random() < 0.2;
  const raiz = new THREE.Group(), cuerpo = new THREE.Group();
  raiz.add(cuerpo);
  const mp = M(piel), mr = M(ropa), mpa = M(pantalon), zap = M('#1C1C22', { roughness: 0.4 }), mpe = M(pelo, { roughness: 0.9 });
  const piernas: THREE.Group[] = [], rodillas: THREE.Group[] = [], brazos: THREE.Group[] = [], codos: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const muslo = new THREE.Group(); muslo.position.set(s * 0.095, 0.5, 0); cuerpo.add(muslo);
    malla(new THREE.CapsuleGeometry(0.075, 0.13, 4, 10), mpa, 0, -0.12, 0, muslo);
    const rod = new THREE.Group(); rod.position.y = -0.25; muslo.add(rod);
    malla(new THREE.CapsuleGeometry(0.064, 0.13, 4, 10), mpa, 0, -0.1, 0, rod);
    malla(new THREE.BoxGeometry(0.11, 0.07, 0.21), zap, 0, -0.22, 0.04, rod);
    piernas.push(muslo); rodillas.push(rod);
  }
  malla(new THREE.SphereGeometry(0.17, 16, 12), mpa, 0, 0.53, 0, cuerpo).scale.set(1.12, 0.62, 0.85);
  malla(new THREE.CapsuleGeometry(0.18, 0.25, 6, 16), mr, 0, 0.8, 0, cuerpo).scale.z = 0.78;
  malla(new THREE.TorusGeometry(0.085, 0.022, 8, 16), mr, 0, 1.08, 0, cuerpo).rotation.x = Math.PI / 2;
  if (mandil) {
    malla(new THREE.BoxGeometry(0.3, 0.44, 0.025), M(mandil), 0, 0.66, 0.145, cuerpo);
    malla(new THREE.BoxGeometry(0.18, 0.12, 0.02), M(mandil), 0, 0.97, 0.135, cuerpo);
  }
  malla(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 10), mp, 0, 1.12, 0, cuerpo);
  for (const s of [-1, 1]) {
    const hombro = new THREE.Group(); hombro.position.set(s * 0.225, 1.0, 0); cuerpo.add(hombro);
    malla(new THREE.SphereGeometry(0.07, 10, 8), mr, 0, 0, 0, hombro);
    malla(new THREE.CapsuleGeometry(0.055, 0.13, 4, 10), mr, 0, -0.1, 0, hombro);
    const codo = new THREE.Group(); codo.position.y = -0.21; hombro.add(codo);
    malla(new THREE.CapsuleGeometry(0.047, 0.12, 4, 10), mp, 0, -0.09, 0, codo);
    malla(new THREE.SphereGeometry(0.055, 10, 8), mp, 0, -0.19, 0, codo);
    hombro.rotation.z = s * 0.1;
    brazos.push(hombro); codos.push(codo);
  }
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.28, 0); cuerpo.add(cabeza);
  malla(new THREE.SphereGeometry(0.2, 24, 18), mp, 0, 0, 0, cabeza);
  for (const s of [-1, 1]) malla(new THREE.SphereGeometry(0.045, 8, 6), mp, s * 0.2, -0.01, 0, cabeza);
  malla(new THREE.SphereGeometry(0.03, 8, 6), M(new THREE.Color(piel).multiplyScalar(0.9)), 0, -0.03, 0.2, cabeza);
  const ojos: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const ojo = malla(new THREE.SphereGeometry(0.027, 10, 8), M('#14141A', { roughness: 0.2 }), s * 0.072, 0.035, 0.182, cabeza);
    malla(new THREE.SphereGeometry(0.009, 6, 4), M('#FFFFFF', { emissive: 0xffffff, emissiveIntensity: 0.5 }), 0.009, 0.01, 0.022, ojo);
    ojos.push(ojo);
    malla(new THREE.BoxGeometry(0.06, 0.012, 0.012), mpe, s * 0.072, 0.085, 0.185, cabeza).rotation.z = s * -0.12;
    const mej = malla(new THREE.SphereGeometry(0.035, 8, 6), M('#F78D74', { transparent: true, opacity: 0.5 }), s * 0.12, -0.05, 0.16, cabeza);
    mej.scale.z = 0.3; mej.rotation.y = s * 0.6;
  }
  const boca = malla(new THREE.TorusGeometry(0.038, 0.009, 6, 14, Math.PI), M('#8E3B2E'), 0, -0.085, 0.182, cabeza);
  boca.rotation.z = Math.PI;
  const cap = malla(new THREE.SphereGeometry(0.212, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mpe, 0, 0, 0, cabeza);
  cap.rotation.x = -0.4;
  let cola: THREE.Group | null = null;
  if (estilo === 'largo') malla(new THREE.CapsuleGeometry(0.14, 0.18, 4, 10), mpe, 0, -0.13, -0.11, cabeza).scale.set(1.35, 1, 0.7);
  if (estilo === 'cola') {
    malla(new THREE.SphereGeometry(0.06, 10, 8), mpe, 0, 0.05, -0.22, cabeza);
    cola = new THREE.Group(); cola.position.set(0, 0.05, -0.24); cabeza.add(cola);
    malla(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), mpe, 0, -0.1, -0.02, cola);
    malla(new THREE.TorusGeometry(0.04, 0.012, 6, 12), M('#E67929'), 0, 0, 0, cola).rotation.x = Math.PI / 2;
  }
  if (estilo === 'mono') malla(new THREE.SphereGeometry(0.09, 12, 10), mpe, 0, 0.17, -0.09, cabeza);
  if (estilo === 'rizado') for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; malla(new THREE.SphereGeometry(0.07, 8, 6), mpe, Math.cos(a) * 0.15, 0.1 + Math.sin(k) * 0.03, Math.sin(a) * 0.15 - 0.03, cabeza); }
  if (lentes) {
    const ml = M('#0B2C3E', { metalness: 0.4 });
    for (const s of [-1, 1]) malla(new THREE.TorusGeometry(0.038, 0.007, 6, 16), ml, s * 0.072, 0.035, 0.195, cabeza);
    malla(new THREE.BoxGeometry(0.04, 0.007, 0.007), ml, 0, 0.04, 0.2, cabeza);
  }
  if (gorro === 'chef') {
    malla(new THREE.CylinderGeometry(0.185, 0.195, 0.1, 18), M('#FFFFFF'), 0, 0.19, 0, cabeza);
    malla(new THREE.SphereGeometry(0.165, 16, 10), M('#FFFFFF'), 0, 0.32, 0, cabeza);
  } else if (gorro === 'casco') {
    malla(new THREE.SphereGeometry(0.24, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M('#E67929', { roughness: 0.3, metalness: 0.2 }), 0, 0.02, 0, cabeza);
    malla(new THREE.SphereGeometry(0.243, 18, 10, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.36, Math.PI * 0.22), new THREE.MeshStandardMaterial({ color: 0x14141A, transparent: true, opacity: 0.65, roughness: 0.1 }), 0, 0.02, 0, cabeza);
    malla(new THREE.BoxGeometry(0.1, 0.03, 0.02), M('#FBF4EC'), 0, 0.22, 0.14, cabeza);
  } else if (gorro === 'gorra') {
    malla(new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), M('#E67929'), 0, 0.02, 0, cabeza);
    malla(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), M('#E67929'), 0, 0.075, 0.16, cabeza);
  }
  const tel = malla(new THREE.BoxGeometry(0.06, 0.11, 0.012), M('#14141A', { emissive: 0x3BB4E7, emissiveIntensity: 0.25 }), 0, -0.2, 0.05, codos[0]);
  tel.rotation.x = -0.6; tel.visible = false;
  const per: Persona = { raiz, cuerpo, piernas, rodillas, brazos, codos, cabeza, ojos, boca, cola, tel, rol, semilla: Math.random() * 10, usaCel: rol === 'cliente' && Math.random() < 0.35, ritmo: 0, paso: 0 };
  gente.add(per);
  return per;
}

export interface CapriPiezas {
  raiz: THREE.Group; cuerpo: THREE.Group; cabeza: THREE.Group; brazoD: THREE.Group; brazoI: THREE.Group;
  ojos: THREE.Mesh[]; boca: THREE.Mesh; orbitan: THREE.Mesh[]; piernas: THREE.Group[]; cejas: THREE.Mesh[]; gota: THREE.Mesh;
}

/** Capri mesera: el mismo diseño del sistema, con la ropa y el gorro de la temática. */
export function construirCapriMesera(ctx: Ctx, tema: Tema, formaCorazon: () => THREE.Shape): CapriPiezas {
  const { M } = ctx;
  const raiz = new THREE.Group(), cuerpo = new THREE.Group();
  raiz.add(cuerpo);
  const add = (p: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => ctx.malla(geo, mat, x, y, z, p);
  const piel = M('#FFD9B5'), pelo = M('#4A2C1D', { roughness: 0.85 }), uni = M(tema.uni), del = M(tema.del, { side: THREE.DoubleSide });
  const rib = M(tema.rib, { metalness: 0.35, roughness: 0.35 }), lazoM = M('#E67929'), blanco = M('#FFFFFF');
  const piernas: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const pg = new THREE.Group(); pg.position.set(s * 0.2, 0.6, 0); cuerpo.add(pg);
    add(pg, new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), M(tema.del), 0, -0.26, 0);
    add(pg, new THREE.SphereGeometry(0.16, 16, 12), M('#0B2C3E'), 0, -0.51, 0.06).scale.set(1, 0.6, 1.4);
    piernas.push(pg);
  }
  add(cuerpo, new THREE.CapsuleGeometry(0.46, 0.55, 8, 24), uni, 0, 1.08, 0).scale.set(1, 1, 0.86);
  add(cuerpo, new THREE.CylinderGeometry(0.45, 0.52, 0.62, 32, 1, true, -1, 2), del, 0, 0.88, 0).scale.z = 0.9;
  add(cuerpo, new THREE.CylinderGeometry(0.525, 0.525, 0.045, 32, 1, true, -1, 2), M(tema.rib, { side: THREE.DoubleSide }), 0, 0.57, 0).scale.z = 0.9;
  for (const s of [-1, 1]) for (const y of [1.3, 1.44]) add(cuerpo, new THREE.SphereGeometry(0.045, 12, 10), rib, s * 0.12, y, 0.405);
  add(cuerpo, new THREE.CylinderGeometry(0.12, 0.14, 0.16, 16), piel, 0, 1.63, 0);
  add(cuerpo, new THREE.TorusGeometry(0.2, 0.05, 10, 24), rib, 0, 1.58, 0).rotation.x = Math.PI / 2;
  const brazo = (s: number) => {
    const g = new THREE.Group(); g.position.set(s * 0.5, 1.45, 0); cuerpo.add(g);
    add(g, new THREE.CapsuleGeometry(0.11, 0.36, 6, 12), uni, 0, -0.26, 0);
    add(g, new THREE.CylinderGeometry(0.125, 0.125, 0.06, 16), rib, 0, -0.5, 0);
    add(g, new THREE.SphereGeometry(0.12, 16, 12), piel, 0, -0.6, 0);
    g.rotation.z = s * 0.18;
    return g;
  };
  const brazoD = brazo(-1), brazoI = brazo(1);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 2.12, 0); cuerpo.add(cabeza);
  add(cabeza, new THREE.SphereGeometry(0.55, 40, 32), piel);
  for (const s of [-1, 1]) add(cabeza, new THREE.SphereGeometry(0.1, 12, 10), piel, s * 0.54, -0.02, 0);
  add(cabeza, new THREE.SphereGeometry(0.585, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), pelo).rotation.x = -0.45;
  for (let i = -2; i <= 2; i++) add(cabeza, new THREE.SphereGeometry(0.17, 16, 12), pelo, i * 0.15, 0.36 - Math.abs(i) * 0.03, 0.4 - Math.abs(i) * 0.05).scale.set(1.1, 0.6, 0.6);
  for (const s of [-1, 1]) {
    add(cabeza, new THREE.SphereGeometry(0.2, 16, 12), pelo, s * 0.6, -0.05, -0.18);
    add(cabeza, new THREE.SphereGeometry(0.15, 16, 12), pelo, s * 0.68, -0.32, -0.2);
    const lazo = new THREE.Group(); lazo.position.set(s * 0.56, 0.14, -0.12); cabeza.add(lazo);
    for (const l of [-1, 1]) add(lazo, new THREE.ConeGeometry(0.08, 0.16, 12), lazoM, l * 0.08).rotation.z = (l * Math.PI) / 2;
    add(lazo, new THREE.SphereGeometry(0.04, 10, 8), lazoM);
  }
  const ojos: THREE.Mesh[] = [], cejas: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const ojo = add(cabeza, new THREE.SphereGeometry(0.085, 20, 16), M('#14141A', { roughness: 0.2 }), s * 0.19, 0.02, 0.5);
    ojo.scale.z = 0.6;
    add(ojo, new THREE.SphereGeometry(0.03, 10, 8), M('#FFFFFF', { emissive: 0xffffff, emissiveIntensity: 0.6 }), 0.03, 0.035, 0.07);
    ojos.push(ojo);
    cejas.push(add(cabeza, new THREE.BoxGeometry(0.15, 0.03, 0.03), pelo, s * 0.19, 0.16, 0.5));
    const mej = add(cabeza, new THREE.SphereGeometry(0.08, 16, 12), M('#F78D74', { transparent: true, opacity: 0.75 }), s * 0.31, -0.12, 0.44);
    mej.scale.z = 0.3; mej.rotation.y = s * 0.6;
  }
  const boca = add(cabeza, new THREE.TorusGeometry(0.085, 0.022, 8, 20, Math.PI), M('#B2500F'), 0, -0.16, 0.52);
  boca.rotation.z = Math.PI;
  const gc = M(tema.gc);
  if (tema.gorro === 'chef') {
    add(cabeza, new THREE.CylinderGeometry(0.5, 0.52, 0.24, 32), gc, 0, 0.5, 0);
    add(cabeza, new THREE.SphereGeometry(0.34, 24, 18), gc, 0, 0.84, 0);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(cabeza, new THREE.SphereGeometry(0.25, 20, 14), gc, Math.cos(a) * 0.27, 0.72, Math.sin(a) * 0.27); }
    add(cabeza, new THREE.SphereGeometry(0.06, 10, 8), lazoM, 0, 0.5, 0.52);
    for (const l of [-1, 1]) add(cabeza, new THREE.ConeGeometry(0.07, 0.14, 12), lazoM, l * 0.08, 0.5, 0.52).rotation.z = (l * Math.PI) / 2;
  } else if (tema.gorro === 'bruja') {
    add(cabeza, new THREE.CylinderGeometry(0.95, 0.95, 0.035, 40), gc, 0, 0.42, 0);
    add(cabeza, new THREE.ConeGeometry(0.48, 1.15, 32), gc, 0.05, 1.0, 0).rotation.z = -0.18;
    add(cabeza, new THREE.CylinderGeometry(0.49, 0.5, 0.1, 32), lazoM, 0, 0.5, 0);
    add(cabeza, new THREE.BoxGeometry(0.14, 0.12, 0.04), M('#F2C14E', { metalness: 0.6, roughness: 0.3 }), 0, 0.5, 0.5);
  } else if (tema.gorro === 'navideno') {
    add(cabeza, new THREE.ConeGeometry(0.5, 0.95, 32), gc, 0.1, 0.9, 0).rotation.z = -0.35;
    add(cabeza, new THREE.TorusGeometry(0.5, 0.11, 12, 32), blanco, 0, 0.45, 0).rotation.x = Math.PI / 2;
    add(cabeza, new THREE.SphereGeometry(0.13, 16, 12), blanco, 0.26, 1.35, 0);
  } else if (tema.gorro === 'sombrero') {
    add(cabeza, new THREE.CylinderGeometry(0.75, 0.75, 0.04, 40), gc, 0, 0.45, 0);
    add(cabeza, new THREE.CylinderGeometry(0.42, 0.45, 0.6, 32), gc, 0, 0.78, 0);
    add(cabeza, new THREE.CylinderGeometry(0.455, 0.455, 0.12, 32), M('#D99E39', { metalness: 0.6, roughness: 0.3 }), 0, 0.55, 0);
  } else if (tema.gorro === 'corona') {
    const oro = M('#D99E39', { metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide });
    add(cabeza, new THREE.CylinderGeometry(0.42, 0.42, 0.22, 32, 1, true), oro, 0, 0.55, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      add(cabeza, new THREE.ConeGeometry(0.07, 0.2, 10), oro, Math.cos(a) * 0.42, 0.75, Math.sin(a) * 0.42);
      add(cabeza, new THREE.SphereGeometry(0.035, 10, 8), M('#E84A7F', { emissive: 0xE84A7F, emissiveIntensity: 0.4 }), Math.cos(a) * 0.43, 0.55, Math.sin(a) * 0.43);
    }
  }
  const orbitan: THREE.Mesh[] = [];
  const mano = brazoI.children[2];
  if (tema.acc.includes('bufanda')) {
    add(cuerpo, new THREE.TorusGeometry(0.24, 0.09, 12, 32), M('#C5221F'), 0, 1.6, 0).rotation.x = Math.PI / 2;
    add(cuerpo, new THREE.BoxGeometry(0.16, 0.45, 0.06), M('#C5221F'), -0.16, 1.35, 0.42).rotation.z = 0.15;
  }
  if (tema.acc.includes('calabaza')) {
    const g = new THREE.Group(); g.position.set(0, -0.15, 0.16); mano.add(g);
    add(g, new THREE.SphereGeometry(0.22, 20, 14), M('#FF7A1A')).scale.y = 0.8;
    add(g, new THREE.CylinderGeometry(0.025, 0.035, 0.1, 8), M('#2F7A45'), 0, 0.2, 0);
  }
  if (tema.acc.includes('bandera')) {
    const g = new THREE.Group(); g.position.set(0, 0, 0.12); mano.add(g);
    add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8), M('#D99E39'), 0, 0.3, 0);
    ['#D91023', '#FFFFFF', '#D91023'].forEach((c, i) => add(g, new THREE.BoxGeometry(0.14, 0.26, 0.015), M(c, { side: THREE.DoubleSide }), 0.08 + i * 0.14, 0.62, 0));
  }
  if (tema.acc.includes('corazon')) {
    const h = add(mano, new THREE.ExtrudeGeometry(formaCorazon(), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 }).center(), M('#E84A7F', { emissive: 0xE84A7F, emissiveIntensity: 0.25 }), 0, -0.2, 0.2);
    h.scale.setScalar(0.45);
  }
  if (tema.acc.includes('estrellas')) {
    for (let k = 0; k < 6; k++) {
      const e = add(raiz, new THREE.OctahedronGeometry(0.09), M('#F5D78E', { emissive: 0xD99E39, emissiveIntensity: 0.7, metalness: 0.5 }));
      e.userData.fase = (k / 6) * Math.PI * 2; orbitan.push(e);
    }
  }
  const gota = add(cabeza, new THREE.SphereGeometry(0.06, 12, 10), M('#7FC8F0', { transparent: true, opacity: 0.85, roughness: 0.1 }), 0.45, 0.28, 0.3);
  gota.scale.y = 1.4; gota.visible = false;
  return { raiz, cuerpo, cabeza, brazoD, brazoI, ojos, boca, orbitan, piernas, cejas, gota };
}

export function crearBandeja(ctx: Ctx, padre: THREE.Object3D, y: number, z: number) {
  const { M, malla } = ctx;
  const b = new THREE.Group(); b.position.set(0, y, z); b.visible = false; padre.add(b);
  malla(new THREE.CylinderGeometry(0.26, 0.26, 0.025, 22), M('#E2E8EC', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, b);
  malla(new THREE.CylinderGeometry(0.05, 0.04, 0.15, 12), M('#E67929'), -0.11, 0.09, 0.02, b);
  malla(new THREE.CylinderGeometry(0.05, 0.04, 0.15, 12), M('#FBF4EC'), 0.01, 0.09, 0.1, b);
  malla(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), M('#FFFFFF'), 0.1, 0.02, -0.07, b);
  malla(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 14), M('#5B3A29'), 0.1, 0.065, -0.07, b);
  return b;
}

export function crearBolsa(ctx: Ctx, padre: THREE.Object3D, x: number, y: number, z: number) {
  const { M, malla } = ctx;
  const b = new THREE.Group(); b.position.set(x, y, z); b.visible = false; padre.add(b);
  malla(new THREE.BoxGeometry(0.24, 0.28, 0.14), M('#C9874A'), 0, 0, 0, b);
  malla(new THREE.BoxGeometry(0.25, 0.05, 0.15), M('#E67929'), 0, 0.08, 0, b);
  malla(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), M('#8A5A12'), 0, 0.14, 0, b);
  return b;
}

export function crearLibreta(ctx: Ctx, padre: THREE.Object3D, x: number, y: number, z: number) {
  const { M, caja, malla } = ctx;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.x = -0.6; g.visible = false; padre.add(g);
  caja(0.13, 0.17, 0.015, M('#FBF4EC'), 0, 0, 0, g);
  caja(0.13, 0.03, 0.02, M('#E67929'), 0, 0.085, 0, g);
  for (let k = 0; k < 4; k++) caja(0.09, 0.005, 0.017, M('#8BA7B8'), 0, 0.04 - k * 0.03, 0, g);
  malla(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6), M('#D99E39'), 0.08, 0, 0.02, g).rotation.z = 0.5;
  return g;
}

export function crearMoto(ctx: Ctx) {
  const { M, caja, malla } = ctx;
  const g = new THREE.Group();
  const nar = M('#E67929', { metalness: 0.4, roughness: 0.35 }), neg = M('#1C1C22', { roughness: 0.6 }), cromo = M('#C9D2D8', { metalness: 0.8, roughness: 0.25 });
  const ruedas: THREE.Mesh[] = [];
  for (const z of [-0.45, 0.45]) {
    const r = malla(new THREE.TorusGeometry(0.2, 0.07, 10, 22), neg, 0, 0.22, z, g); r.rotation.y = Math.PI / 2; ruedas.push(r);
    malla(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 12), cromo, 0, 0.22, z, g).rotation.z = Math.PI / 2;
  }
  caja(0.3, 0.26, 0.82, nar, 0, 0.46, 0, g);
  caja(0.26, 0.08, 0.46, neg, 0, 0.63, -0.1, g);
  malla(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), cromo, 0, 0.6, 0.4, g).rotation.x = 0.35;
  caja(0.56, 0.04, 0.04, neg, 0, 0.88, 0.5, g);
  caja(0.44, 0.38, 0.4, nar, 0, 0.88, -0.44, g);
  caja(0.45, 0.07, 0.41, M('#FBF4EC'), 0, 0.88, -0.44, g);
  malla(new THREE.SphereGeometry(0.065, 10, 8), M('#FFF6CC', { emissive: 0xFFF6CC, emissiveIntensity: 0.9 }), 0, 0.72, 0.58, g);
  g.userData.ruedas = ruedas;
  return g;
}

/* ---------- Animación de las personas ---------- */
function pose(p: Persona, i: number, x: number, codo: number, k: number, z = i ? 0.1 : -0.1) {
  const b = p.brazos[i], c = p.codos[i];
  b.rotation.x += (x - b.rotation.x) * k; c.rotation.x += (codo - c.rotation.x) * k; b.rotation.z += (z - b.rotation.z) * k;
}

export function animarGente(gente: Set<Persona>, t: number, dt: number, comiendo: (p: Persona) => boolean) {
  const k = Math.min(1, dt * 8);
  for (const p of gente) {
    if (!p.raiz.parent) { gente.delete(p); continue; }
    const f = p.semilla;
    p.animarExtra?.(t, dt);
    const parp = ((t + f) % 4.1) < 0.12 ? 0.15 : 1;
    p.ojos.forEach((o) => { o.scale.y = parp; });
    if (p.enMoto) {
      p.piernas.forEach((pi) => { pi.rotation.x = -1.25; }); p.rodillas.forEach((r) => { r.rotation.x = 1.2; });
      pose(p, 0, -1.15, -0.35, k); pose(p, 1, -1.15, -0.35, k);
      p.cuerpo.rotation.x = 0.18; p.cuerpo.position.y = 0; p.cabeza.rotation.x = -0.1; p.tel.visible = false;
      continue;
    }
    if ((p.anotaHasta ?? 0) > t) {
      pose(p, 1, -1.2, -0.4, k); pose(p, 0, -1.0 + Math.sin(t * 14) * 0.08, -0.9, k);
      p.cabeza.rotation.x = 0.3; p.boca.scale.y = 1 + Math.abs(Math.sin(t * 10)) * 0.6;
      continue;
    }
    if (p.sentado) {
      const come = comiendo(p);
      p.cuerpo.position.y = -0.05;
      if (p.manoArriba) {
        pose(p, 0, -0.2, -0.3 + Math.sin(t * 6) * 0.15, k, -2.7); pose(p, 1, -0.4, -0.6, k);
        p.cabeza.rotation.y = Math.sin(t * 1.5 + f) * 0.3; p.tel.visible = false;
      } else if (come) {
        const lift = Math.max(0, Math.sin(t * 1.8 + f));
        pose(p, 0, -0.7 - 0.5 * lift, -0.5 - 1.35 * lift, k); pose(p, 1, -0.55, -0.75, k);
        p.cabeza.rotation.x = 0.12 - lift * 0.1; p.cabeza.rotation.y = Math.sin(t * 0.5 + f) * 0.2;
        p.boca.scale.y = 1 + Math.abs(Math.sin(t * 9)) * lift;
        p.tel.visible = false;
      } else if (p.usaCel) {
        pose(p, 0, -0.65, -1.15, k); pose(p, 1, -0.55, -1.1, k);
        p.cabeza.rotation.x += (0.35 - p.cabeza.rotation.x) * k; p.tel.visible = true;
      } else {
        pose(p, 0, -0.5 + Math.sin(t * 2.3 + f) * 0.2, -0.9 + Math.sin(t * 3.1 + f) * 0.35, k); pose(p, 1, -0.4, -0.6, k);
        p.cabeza.rotation.y = Math.sin(t * 0.7 + f) * 0.55; p.cabeza.rotation.x = Math.sin(t * 1.3 + f) * 0.06;
        p.boca.scale.y = 1 + (Math.sin(t * 7 + f) > 0.3 ? Math.abs(Math.sin(t * 12 + f)) * 0.8 : 0);
        p.tel.visible = false;
      }
      continue;
    }
    const r = p.ritmo || 0, fs = p.paso || 0;
    p.piernas[0].rotation.x = Math.sin(fs) * 0.6 * r; p.piernas[1].rotation.x = -Math.sin(fs) * 0.6 * r;
    p.rodillas[0].rotation.x = Math.max(0, Math.sin(fs - 1.3)) * 0.95 * r; p.rodillas[1].rotation.x = Math.max(0, -Math.sin(fs - 1.3)) * 0.95 * r;
    p.cuerpo.position.y = Math.abs(Math.cos(fs)) * 0.035 * r;
    p.cuerpo.rotation.y = Math.sin(fs) * 0.08 * r;
    if (p.cola) p.cola.rotation.x = 0.25 + Math.sin(fs * 2) * 0.3 * r + Math.sin(t * 2 + f) * 0.05;
    if (p.rol === 'cocinero') {
      const carga = p.zona && p.zona.carga, vel = carga ? 7 : 2.5, amp = carga ? 0.5 : 0.15, fa = p.fase ?? 0;
      pose(p, 0, -0.55, -1.0 + Math.sin(t * vel + fa) * amp, 1); pose(p, 1, -0.5, -1.1 + Math.cos(t * vel * 1.1 + fa) * amp, 1);
      p.cuerpo.rotation.y = Math.sin(t * 1.2 + fa) * (carga ? 0.25 : 0.08);
      p.cabeza.rotation.x = 0.3; p.cabeza.rotation.y = Math.sin(t * 0.6 + fa) * 0.3;
      continue;
    }
    if (p.rol === 'cajero') {
      const tr = p.trabajando && t < p.trabajando;
      pose(p, 0, -0.5, tr ? -1.1 + Math.sin(t * 16) * 0.25 : -0.95, k); pose(p, 1, -0.45, tr ? -1.1 + Math.cos(t * 16) * 0.25 : -0.9, k);
      p.cabeza.rotation.y = tr ? 0 : Math.sin(t * 0.7) * 0.45; p.cabeza.rotation.x = tr ? 0.3 : 0;
      continue;
    }
    if ((p.limpiaHasta ?? 0) > t) { pose(p, 0, -0.9 + Math.sin(t * 9) * 0.25, -0.6 + Math.cos(t * 9) * 0.3, 1, -0.1 + Math.sin(t * 9) * 0.3); pose(p, 1, -0.3, -0.4, k); p.cabeza.rotation.x = 0.35; p.cuerpo.rotation.x = 0.25; continue; }
    p.cuerpo.rotation.x = 0;
    if (p.carga) { pose(p, 0, -0.35, -1.25, k); pose(p, 1, -0.35, -1.25, k); }
    else if ((p.saludaHasta ?? 0) > t) { pose(p, 0, -0.2, -0.5 + Math.sin(t * 10) * 0.3, k, -2.5); pose(p, 1, 0, -0.1, k); p.boca.scale.y = 1.6; }
    else if (r > 0.05) { pose(p, 0, -Math.sin(fs) * 0.55 * r, -0.35 * r, k); pose(p, 1, Math.sin(fs) * 0.55 * r, -0.35 * r, k); }
    else if (p.usaCel) { pose(p, 0, -0.55, -1.15, k); pose(p, 1, -0.2, -0.3, k); p.cabeza.rotation.x += (0.35 - p.cabeza.rotation.x) * k; p.tel.visible = true; }
    else {
      pose(p, 0, 0, -0.12, k); pose(p, 1, 0, -0.12, k);
      p.cuerpo.rotation.z = Math.sin(t * 0.8 + f) * 0.025;
      p.cabeza.rotation.y = Math.sin(t * 0.6 + f) * 0.5; p.cabeza.rotation.x += (0 - p.cabeza.rotation.x) * k;
      p.boca.scale.y = 1;
    }
    if (r > 0.05) { p.tel.visible = false; p.cabeza.rotation.x += (0 - p.cabeza.rotation.x) * k; }
  }
}
