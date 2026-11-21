import * as THREE from 'three';
import { texLadrillo, type Ctx, type Etq } from './base';
import { persona, type Persona } from './personas';
import { cocinerosDeArea, puestosDeMesa, type ItemEscena, type PlanoEscena } from './planoAEscena';

/** Construye el local en 3D a partir del plano real (ver planoAEscena): mesas, mostradores, cocina por áreas, paredes. */
export const COLOR_ESTADO: Record<string, number> = { LIBRE: 0x2DBE60, ESPERANDO: 0xE67929, COMIENDO: 0xD99E39, POR_COBRAR: 0x0B2C3E, RESERVADA: 0x6B4E9B };

export interface Silla { local: THREE.Vector3; mundo: THREE.Vector3; tipo: string; grilla: [number, number] }

export interface MesaEsc {
  id: string; item: ItemEscena; nombre: string; seats: number; cx: number; cz: number;
  /** Centro de la mesa y punto de servicio (del lado del pasillo), en celdas */
  gx: number; gy: number; servicio: [number, number]; mira: number;
  sillas: Silla[]; anillo: THREE.Mesh; comida: THREE.Group; centro: THREE.Group; cartel: THREE.Group; etq: Etq;
  vapor: THREE.Vector3[];
}

export interface ZonaCocina { etq: Etq; clave: string; area: string; carga: number; cocineros: Persona[]; tortas?: THREE.Group[] }

export interface Local {
  mesas: MesaEsc[];
  zonas: Map<string, ZonaCocina>;
  cocineros: Persona[];
  cajero: Persona | null;
  cajaEtq: Etq | null;
  /** Dónde se para quien paga / espera su pedido para llevar (celdas) */
  pagoPunto: [number, number];
  esperaLlevar: Array<[number, number]>;
  despachoEtq: Etq | null;
  despachoPunto: [number, number] | null;
  bandejas: THREE.Group[];
  bolsas: THREE.Group[];
  humos: THREE.Vector3[];
  ventanas: THREE.MeshStandardMaterial[];
  lucesNoche: THREE.PointLight[];
  letrero: THREE.MeshStandardMaterial | null;
  spots: THREE.Vector3[];
}

export function construirLocal(ctx: Ctx, plano: PlanoEscena, gente: Set<Persona>): Local {
  const { escena, M, caja, malla, G, etiqueta, texCanvas, matMadera, matMaderaOsc } = ctx;
  const { ancho, alto } = plano;
  const L: Local = {
    mesas: [], zonas: new Map(), cocineros: [], cajero: null, cajaEtq: null, pagoPunto: [ancho / 2, alto / 2], esperaLlevar: [],
    despachoEtq: null, despachoPunto: null, bandejas: [], bolsas: [], humos: [], ventanas: [], lucesNoche: [], letrero: null, spots: [],
  };

  // Piso con cuadrícula suave y vereda del lado de la calle
  {
    const cv = document.createElement('canvas'); cv.width = ancho * 48; cv.height = alto * 48;
    const g = cv.getContext('2d');
    if (g) {
      g.fillStyle = '#FBF4EC'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(11,44,62,.08)'; g.lineWidth = 2;
      for (let i = 0; i <= ancho; i++) { g.beginPath(); g.moveTo(i * 48, 0); g.lineTo(i * 48, cv.height); g.stroke(); }
      for (let j = 0; j <= alto; j++) { g.beginPath(); g.moveTo(0, j * 48); g.lineTo(cv.width, j * 48); g.stroke(); }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; escena.add(piso);
    const e = plano.entrada;
    const dirX = e ? e.dirX : 1, dirZ = e ? e.dirZ : 0;
    const vereda = new THREE.Mesh(new THREE.PlaneGeometry(dirX ? 4 : ancho + 4, dirX ? alto + 2 : 4), M('#5A6B78', { roughness: 1 }));
    vereda.rotation.x = -Math.PI / 2;
    vereda.position.set(dirX * (ancho / 2 + 2), -0.01, dirZ * (alto / 2 + 2));
    vereda.receiveShadow = true; escena.add(vereda);
  }

  const itemsDe = (c: string) => plano.items.filter((i) => i.clase === c);
  const cajaItem = itemsDe('caja')[0];
  let primerLadrillo = true;

  const cuadro = (x: number, y: number, z: number, rotY: number, tipo: string, esc = 0.7) => {
    const t = texCanvas(256, 200, (g, w, h) => {
      g.fillStyle = '#FBF4EC'; g.fillRect(0, 0, w, h);
      const c = (col: string, x1: number, y1: number, r: number) => { g.fillStyle = col; g.beginPath(); g.arc(x1, y1, r, 0, 7); g.fill(); };
      if (tipo === 'dona') { c('#D9A066', 128, 100, 70); c('#E84A7F', 128, 92, 62); c('#FBF4EC', 128, 98, 24); ['#FFFFFF', '#F2C14E', '#3BB4E7', '#7BE0C3'].forEach((s, i) => { g.fillStyle = s; for (let k = 0; k < 4; k++) g.fillRect(80 + ((i * 37 + k * 23) % 90), 50 + ((i * 19 + k * 31) % 80), 10, 4); }); }
      if (tipo === 'frappe') { g.fillStyle = '#E9C46A'; g.beginPath(); g.moveTo(85, 70); g.lineTo(171, 70); g.lineTo(158, 180); g.lineTo(98, 180); g.fill(); c('#FFFFFF', 128, 66, 40); c('#5B3A29', 128, 48, 8); g.fillStyle = '#E67929'; g.fillRect(140, 10, 8, 60); }
      if (tipo === 'cafe') { g.fillStyle = '#FFFFFF'; g.fillRect(78, 80, 90, 80); c('#5B3A29', 123, 82, 40); g.strokeStyle = '#FFFFFF'; g.lineWidth = 10; g.beginPath(); g.arc(172, 118, 20, -1.4, 1.4); g.stroke(); g.strokeStyle = 'rgba(11,44,62,.3)'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(100 + k * 22, 60); g.bezierCurveTo(90 + k * 22, 40, 115 + k * 22, 30, 102 + k * 22, 12); g.stroke(); } }
      if (tipo === 'torta') { g.fillStyle = '#5B3A29'; g.fillRect(60, 110, 136, 60); g.fillStyle = '#F2B6C3'; g.fillRect(60, 90, 136, 24); g.fillStyle = '#FBF4EC'; g.fillRect(60, 140, 136, 8); c('#C5221F', 128, 78, 14); }
      g.fillStyle = '#0B2C3E'; g.font = '800 18px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('Caprichos.', 128, h - 10);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = rotY; escena.add(gr);
    caja(esc * 1.18, esc * 0.94, 0.03, M('#D99E39', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, gr);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(esc * 1.08, esc * 0.84), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
    pl.position.z = 0.02; gr.add(pl);
  };

  /* ---------- Paredes y estructura ---------- */
  for (const el of plano.items) {
    const { cx, cz } = el;
    if (el.clase === 'pared') {
      if (el.rol === 'ladrillo') {
        const alt = 1.7;
        const lad = new THREE.MeshStandardMaterial({ map: texLadrillo(ctx, el.w, alt / 0.5), roughness: 0.85 });
        caja(el.w, alt, el.h * 0.6, lad, cx, alt / 2, cz);
        caja(el.w + 0.04, 0.08, el.h * 0.7, matMaderaOsc, cx, alt + 0.04, cz);
        if (primerLadrillo && el.w >= 6) {
          primerLadrillo = false;
          const frente = cz + el.h * 0.3 + 0.012;
          caja(3.4, 0.85, 0.04, M('#0B2C3E', { roughness: 0.5 }), cx, 1.12, frente + 0.02);
          const tl = texCanvas(1024, 256, (g, w, h) => {
            g.clearRect(0, 0, w, h); g.textBaseline = 'middle'; g.textAlign = 'center';
            g.font = '900 150px Montserrat, sans-serif'; g.fillStyle = '#FBF4EC'; g.fillText('Caprichos', w / 2 - 30, h / 2 - 18);
            g.fillStyle = '#E67929'; g.beginPath(); g.arc(w / 2 + 370, h / 2 + 22, 20, 0, 7); g.fill();
            g.font = '700 34px Open Sans, sans-serif'; g.fillStyle = '#D99E39'; g.fillText('CAFETERÍA · POSTRES · FRAPPÉS', w / 2, h - 34);
          });
          tl.wrapS = tl.wrapT = THREE.ClampToEdgeWrapping;
          L.letrero = new THREE.MeshStandardMaterial({ map: tl, transparent: true, emissive: 0xffffff, emissiveMap: tl, emissiveIntensity: 0.15 });
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.82), L.letrero); pl.position.set(cx, 1.12, frente + 0.045); escena.add(pl);
          if (el.w >= 9) { cuadro(cx - 3.6, 1.1, frente + 0.02, 0, 'dona'); cuadro(cx + 3.6, 1.1, frente + 0.02, 0, 'frappe'); }
        }
      } else if (el.rol === 'rosada') {
        caja(el.w, 1.4, el.h * 0.6, M('#F2B6C3', { roughness: 0.8 }), cx, 0.7, cz + 0.2);
        caja(el.w, 0.06, el.h * 0.7, M('#FBF4EC'), cx, 1.43, cz + 0.2);
        const n = Math.max(0, Math.min(6, Math.floor(el.w / 3)));
        ['dona', 'cafe', 'torta', 'frappe', 'dona', 'cafe'].slice(0, n).forEach((tipo, i) => cuadro(cx - ((n - 1) * 1.5) + i * 3, 1.13, cz + 0.2 - el.h * 0.3 - 0.012, Math.PI, tipo, 0.5));
      } else {
        const alt = el.rol === 'norte' ? 1.7 : 1.2;
        caja(el.w, alt, el.h, M('#0B2C3E', { roughness: 0.8 }), cx, alt / 2, cz);
        if (el.rol === 'fachada') { // ventanas de la fachada
          const vid = new THREE.MeshStandardMaterial({ color: 0xBFE3F2, transparent: true, opacity: 0.55, roughness: 0.05, emissive: 0x9FD3EE, emissiveIntensity: 0.25 });
          const largoV = Math.max(0.5, el.h - 0.7);
          const v = new THREE.Mesh(new THREE.BoxGeometry(el.w + 0.04, 0.62, largoV), vid); v.position.set(cx, 0.72, cz); escena.add(v);
          L.ventanas.push(vid);
          const marco = M('#E67929', { metalness: 0.4, roughness: 0.4 });
          for (const y of [0.4, 1.04]) caja(el.w + 0.08, 0.05, largoV + 0.08, marco, cx, y, cz);
          const div = Math.max(1, Math.round(largoV / 1.1));
          for (let k = 0; k <= div; k++) caja(el.w + 0.08, 0.62, 0.05, marco, cx, 0.72, cz - largoV / 2 + (k * largoV) / div);
        }
      }
    } else if (el.clase === 'bano') {
      caja(el.w, 1.3, el.h, M('#DCD2C2'), cx, 0.65, cz);
      caja(0.7, 1.1, 0.05, M('#8BA7B8'), cx, 0.55, cz - el.h / 2 - 0.01);
      caja(0.08, 0.08, 0.02, M('#D99E39', { metalness: 0.6 }), cx + 0.22, 0.6, cz - el.h / 2 - 0.04);
      etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + Math.min(2.5, el.h / 2), 1.35), 0).el.textContent = el.etiqueta.toUpperCase() || 'BAÑOS';
    } else if (el.clase === 'entrada') {
      const vert = el.h >= el.w;
      const naranja = M('#E67929', { metalness: 0.45, roughness: 0.35 });
      caja(el.w, 0.02, el.h, M('#E67929', { roughness: 0.7 }), cx, 0.01, cz);
      const largoP = vert ? el.h : el.w, mitad = largoP / 2;
      const pos = (d: number): [number, number] => (vert ? [cx, cz + d] : [cx + d, cz]);
      for (const dz of [-mitad, mitad]) { const [px, pz] = pos(dz); caja(0.16, 2.0, 0.16, naranja, px, 1.0, pz); }
      caja(vert ? 0.16 : largoP, 0.16, vert ? largoP : 0.16, naranja, cx, 2.0, cz);
      const sentido = plano.entrada ? (vert ? plano.entrada.dirX : plano.entrada.dirZ) : 1;
      for (const lado of [-1, 1]) {
        const bis = new THREE.Group(); const [px, pz] = pos(lado * (mitad - 0.05)); bis.position.set(px, 0, pz); escena.add(bis);
        const hoja = new THREE.Group(); bis.add(hoja);
        const largo = mitad - 0.1, dir = -lado;
        const caj = (w: number, h: number, d: number, y: number, z: number) => caja(vert ? w : d, h, vert ? d : w, naranja, 0, y, z, hoja);
        for (const y of [0.12, 1.85]) caj(0.05, 0.07, largo, y, dir * largo / 2);
        caj(0.05, 0.06, largo, 0.95, dir * largo / 2);
        for (let i = 0; i <= 7; i++) caj(0.035, 1.75, 0.035, 0.98, dir * (0.05 + i * (largo - 0.1) / 7));
        bis.rotation.y = (vert ? lado * -1.25 * sentido : lado * 1.25 * sentido + Math.PI / 2);
      }
      etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + el.h / 2, 2.15), 0).el.textContent = el.etiqueta.toUpperCase() || 'ENTRADA';
    } else if (el.clase === 'caja') {
      caja(el.w, 0.95, el.h * 0.7, M('#E2D8C6'), cx, 0.475, cz + 0.15);
      caja(el.w + 0.06, 0.06, el.h * 0.8, M('#0B2C3E'), cx, 0.98, cz + 0.15);
      const reg = new THREE.Group(); reg.position.set(cx - Math.min(0.6, el.w / 4), 1.01, cz + 0.15); escena.add(reg);
      caja(0.45, 0.18, 0.35, M('#1C1C22'), 0, 0.09, 0, reg);
      caja(0.38, 0.28, 0.03, M('#0B2C3E', { emissive: 0x3BB4E7, emissiveIntensity: 0.5 }), 0, 0.35, -0.05, reg).rotation.x = -0.35;
      caja(0.25, 0.02, 0.18, M('#D99E39'), cx + Math.min(0.7, el.w / 4), 1.0, cz + 0.2).rotation.y = 0.3;
      const cajero = persona(ctx, gente, { ropa: '#0B2C3E', mandil: '#E67929', gorro: 'gorra', pelo: '#2B1B14', estilo: 'cola', rol: 'cajero' });
      cajero.raiz.position.copy(G(el.x + Math.min(1.8, el.w - 0.5), el.y));
      escena.add(cajero.raiz);
      L.cajero = cajero;
      L.cajaEtq = etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + 0.5, 1.9), 0);
    } else if (el.clase === 'barra') {
      const fz = cz + 0.1, ww = el.w - 0.1;
      caja(ww, 0.72, 0.8, matMadera, cx, 0.36, fz);
      caja(ww + 0.02, 0.06, 0.82, M('#D99E39', { metalness: 0.6, roughness: 0.3 }), cx, 0.74, fz);
      const vidrio = new THREE.MeshStandardMaterial({ color: 0xE8F6FF, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1 });
      const vit = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.04, 0.72, 0.74), vidrio); vit.position.set(cx, 1.13, fz); escena.add(vit);
      const oro = M('#D99E39', { metalness: 0.7, roughness: 0.25 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) caja(0.03, 0.72, 0.03, oro, cx + sx * (ww / 2 - 0.03), 1.13, fz + sz * 0.36);
      caja(ww, 0.03, 0.76, oro, cx, 1.5, fz);
      caja(ww - 0.1, 0.02, 0.66, new THREE.MeshStandardMaterial({ color: 0xDDF2FF, transparent: true, opacity: 0.35, roughness: 0.05 }), cx, 1.12, fz);
      const luzVit = new THREE.PointLight(0xFFE2B0, 5, 2.5, 1); luzVit.position.set(cx, 1.4, fz); escena.add(luzVit);
      const glaseados = ['#E84A7F', '#5B3A29', '#FBF4EC', '#E67929', '#7BE0C3', '#D99E39', '#9B5DE5', '#F2B6C3'];
      const porFila = Math.max(2, Math.min(8, Math.floor((ww - 0.3) / 0.48)));
      for (let i = 0; i < porFila * 2; i++) {
        const x = cx - ((porFila - 1) * 0.48) / 2 + (i % porFila) * 0.48, z = fz - 0.15 + Math.floor(i / porFila) * 0.3;
        malla(new THREE.TorusGeometry(0.085, 0.05, 10, 18), M('#D9A066'), x, 0.82, z).rotation.x = Math.PI / 2;
        const gl = malla(new THREE.TorusGeometry(0.085, 0.045, 10, 18), M(glaseados[i % 8]), x, 0.845, z); gl.rotation.x = Math.PI / 2; gl.scale.z = 0.6;
        for (let k = 0; k < 4; k++) malla(new THREE.BoxGeometry(0.025, 0.008, 0.008), M(['#FFFFFF', '#E67929', '#3BB4E7', '#F2C14E'][k]), x + Math.cos(k * 1.7) * 0.08, 0.875, z + Math.sin(k * 1.7) * 0.08).rotation.y = k;
      }
      [['#5B3A29', '#F3E7D8'], ['#F3E7D8', '#E84A7F'], ['#E9C46A', '#FBF4EC']].forEach(([a, b], i) => {
        const x = cx - ww / 2 + 0.5 + i * 0.55;
        malla(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 22), M(a), x, 1.18, fz);
        malla(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 22), M(b), x, 1.24, fz);
        malla(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 22), M(a), x, 1.3, fz);
        malla(new THREE.SphereGeometry(0.03, 8, 6), M('#C5221F'), x, 1.36, fz);
      });
      for (let i = 0; i < 4; i++) {
        const x = cx + 0.2 + i * 0.25;
        if (x > cx + ww / 2 - 0.2) break;
        malla(new THREE.CylinderGeometry(0.07, 0.05, 0.08, 12), M('#E67929'), x, 1.17, fz - 0.15);
        malla(new THREE.SphereGeometry(0.075, 12, 10), M(['#F2B6C3', '#FBF4EC', '#5B3A29', '#7BE0C3'][i]), x, 1.24, fz - 0.15);
      }
      etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + 0.5, 1.6), 0).el.textContent = el.etiqueta.toUpperCase() || 'BARRA';
    } else if (el.clase === 'cocina') {
      construirArea(el);
    } else if (el.clase === 'escalera') {
      const pasos = Math.max(3, Math.round(Math.max(el.w, el.h) * 2));
      for (let i = 0; i < pasos; i++) {
        const frac = (i + 1) / pasos;
        if (el.h >= el.w) caja(el.w, 0.9 * frac, el.h / pasos, M('#F6E3C3'), cx, (0.9 * frac) / 2, el.y - alto / 2 + (i + 0.5) * (el.h / pasos));
        else caja(el.w / pasos, 0.9 * frac, el.h, M('#F6E3C3'), el.x - ancho / 2 + (i + 0.5) * (el.w / pasos), (0.9 * frac) / 2, cz);
      }
      etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + el.h / 2, 1.2), 0).el.textContent = el.etiqueta.toUpperCase() || 'ESCALERA';
    } else if (el.clase === 'otro') {
      // Tipo desconocido: caja neutra con su nombre
      caja(el.w * 0.9, 0.6, el.h * 0.9, M('#DCD2C2'), cx, 0.3, cz);
      if (el.etiqueta) etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + el.h / 2, 0.8), 0).el.textContent = el.etiqueta.toUpperCase();
    } else if (el.clase === 'mesa') {
      construirMesa(el);
    }
  }

  // Sillón largo crema contra la pared, de la primera a la última mesa que lo usa
  {
    const sofas = L.mesas.filter((m) => m.item.estilo === 'sofa');
    if (sofas.length) {
      const minX = Math.min(...sofas.map((m) => m.item.x)), maxX = Math.max(...sofas.map((m) => m.item.x + m.item.w));
      const yFin = Math.max(...sofas.map((m) => m.item.y + m.item.h));
      const x0 = minX + 0.05, largo = maxX - minX - 0.1, cxs = x0 + largo / 2 - ancho / 2, zs = yFin - 0.22 - alto / 2;
      const crema = M('#EFE1CC', { roughness: 0.9 }), cremaO = M('#E3D2B8', { roughness: 0.9 });
      caja(largo, 0.18, 0.5, matMaderaOsc, cxs, 0.09, zs);
      caja(largo, 0.16, 0.48, crema, cxs, 0.26, zs - 0.01);
      caja(largo, 0.62, 0.14, cremaO, cxs, 0.65, zs + 0.2);
      for (let i = 0; i < Math.floor(largo); i++) caja(0.9, 0.42, 0.1, crema, x0 + 0.5 + i - ancho / 2, 0.62, zs + 0.12).rotation.x = -0.12;
    }
  }

  /* ---------- Cocina por áreas ---------- */
  function construirArea(el: ItemEscena) {
    const { cx, cz } = el;
    const zona = new THREE.Mesh(new THREE.PlaneGeometry(el.w, el.h), M('#C9D6DE', { roughness: 0.9 }));
    zona.rotation.x = -Math.PI / 2; zona.position.set(cx, 0.005, cz); zona.receiveShadow = true; escena.add(zona);
    const norte = el.y - alto / 2;
    const acero = M('#B8C5CE', { metalness: 0.5, roughness: 0.35 });
    const etq = etiqueta('sv-etq-area', G(el.x + el.w / 2, el.y + 0.5, 1.6), 0);
    if (el.area === 'DESPACHO') {
      caja(0.9, 0.95, 0.9, acero, cx, 0.475, cz);
      malla(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#D99E39', { metalness: 0.7, roughness: 0.2 }), cx + 0.25, 0.96, cz + 0.25);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Group(); b.position.set(cx - 0.15, 0.97 + i * 0.02, cz - 0.2 + i * 0.22); escena.add(b);
        malla(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18), M('#E2E8EC', { metalness: 0.6, roughness: 0.3 }), 0, 0, 0, b);
        malla(new THREE.CylinderGeometry(0.05, 0.04, 0.13, 12), M('#FBF4EC'), -0.06, 0.07, 0, b);
        malla(new THREE.BoxGeometry(0.12, 0.07, 0.1), M('#C9874A'), 0.08, 0.04, 0, b);
        b.visible = false; L.bandejas.push(b);
        const bo = new THREE.Group(); bo.position.set(cx + 0.22, 1.1, cz - 0.25 + i * 0.25); escena.add(bo);
        malla(new THREE.BoxGeometry(0.2, 0.24, 0.12), M('#C9874A'), 0, 0, 0, bo);
        malla(new THREE.BoxGeometry(0.21, 0.04, 0.13), M('#E67929'), 0, 0.07, 0, bo);
        bo.visible = false; L.bolsas.push(bo);
      }
      L.despachoEtq = etq;
      L.despachoPunto = [el.x + el.w / 2, el.y + el.h + 0.4];
      return;
    }
    if (el.area === 'LAVADERO') {
      caja(el.w - 0.4, 0.9, 0.55, acero, cx, 0.45, cz - 0.1);
      malla(new THREE.BoxGeometry(0.8, 0.05, 0.4), M('#7FA7BF', { metalness: 0.3, roughness: 0.1 }), cx - 0.6, 0.91, cz - 0.1);
      for (let i = 0; i < 5; i++) malla(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), M('#FFFFFF'), cx + 0.7, 0.92 + i * 0.025, cz - 0.1);
      etq.el.textContent = 'LAVADERO';
      return;
    }
    const prof = el.h > 1 ? 0.7 : 0.45;
    caja(el.w - 0.1, 0.92, prof, acero, cx, 0.46, norte + prof / 2 + 0.02);
    const clave = el.claveArea || 'COCIN';
    const info: ZonaCocina = { etq, clave, area: el.area || 'GENERAL', carga: 0, cocineros: [] };
    L.zonas.set(clave, info);
    const mitad = el.w / 2;
    if (el.area === 'SALADOS') {
      caja(1.4, 0.06, 0.5, M('#1C1C22'), cx - mitad * 0.5, 0.95, norte + 0.35);
      for (const dx of [-mitad * 0.6, -mitad * 0.4]) {
        malla(new THREE.CylinderGeometry(0.18, 0.15, 0.25, 18), M('#6E7B86', { metalness: 0.7, roughness: 0.3 }), cx + dx, 1.1, norte + 0.35);
        L.humos.push(new THREE.Vector3(cx + dx, 1.25, norte + 0.35));
      }
      caja(1.2, 0.05, 0.5, M('#3A3A40', { metalness: 0.6 }), cx + 0.6, 0.96, norte + 0.35);
      for (let i = 0; i < 3; i++) caja(0.22, 0.06, 0.14, M('#C9874A'), cx + 0.25 + i * 0.3, 1.02, norte + 0.35);
      caja(0.8, 0.35, 0.45, M('#2F3640'), cx + mitad - 0.8, 1.1, norte + 0.3);
    } else if (el.area === 'BEBIDAS' && el.w >= 7) {
      const cromo = M('#C9D2D8', { metalness: 0.8, roughness: 0.25 });
      const zb = norte + 0.22, c0 = cx - mitad * 0.62;
      caja(1.4, 0.5, 0.42, cromo, c0, 1.17, zb);
      caja(1.42, 0.06, 0.44, M('#D99E39', { metalness: 0.7, roughness: 0.3 }), c0, 1.45, zb);
      caja(1.3, 0.12, 0.02, M('#0B2C3E'), c0, 1.3, zb + 0.22);
      for (let i = 0; i < 3; i++) {
        malla(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), M('#1C1C22', { metalness: 0.6 }), c0 - 0.45 + i * 0.45, 1.0, zb + 0.25);
        malla(new THREE.CylinderGeometry(0.04, 0.035, 0.07, 10), M('#FBF4EC'), c0 - 0.45 + i * 0.45, 0.96, zb + 0.25);
      }
      for (let i = 0; i < 6; i++) malla(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 10), M('#FBF4EC'), c0 - 0.55 + i * 0.22, 1.52, zb);
      malla(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 14), M('#1C1C22', { metalness: 0.5 }), c0 + 1.1, 1.1, zb);
      ['#E9C46A', '#5B3A29'].forEach((c, i) => {
        const x = c0 + 1.65 + i * 0.4;
        caja(0.2, 0.14, 0.2, M('#1C1C22'), x, 0.99, zb);
        malla(new THREE.CylinderGeometry(0.09, 0.07, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0xE8F6FF, transparent: true, opacity: 0.4 }), x, 1.22, zb);
        malla(new THREE.CylinderGeometry(0.075, 0.065, 0.18, 14), M(c), x, 1.15, zb);
        malla(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 14), M('#1C1C22'), x, 1.39, zb);
      });
      for (let i = 0; i < 6; i++) malla(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12), M(i % 2 ? '#FBF4EC' : '#E67929'), cx + 0.15 + i * 0.2, 1.0, zb + 0.05);
      caja(0.85, 1.7, 0.5, M('#0B2C3E', { roughness: 0.4 }), cx + mitad - 0.55, 0.85, norte + 0.3);
      const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.5, 0.02), new THREE.MeshStandardMaterial({ color: 0xBFE3F2, transparent: true, opacity: 0.25, roughness: 0.05 }));
      puerta.position.set(cx + mitad - 0.55, 0.9, norte + 0.56); escena.add(puerta);
      for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) malla(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), M(['#E67929', '#7BE0C3', '#C5221F', '#FBF4EC'][(f + k) % 4]), cx + mitad - 0.8 + k * 0.17, 0.35 + f * 0.37, norte + 0.4);
      caja(0.85, 0.12, 0.5, M('#E67929', { emissive: 0xE67929, emissiveIntensity: 0.3 }), cx + mitad - 0.55, 1.76, norte + 0.3);
    } else if (el.area === 'POSTRES') {
      const zp = norte + 0.22, c0 = cx - mitad * 0.7;
      caja(0.22, 0.1, 0.3, M('#E84A7F'), c0, 0.97, zp);
      caja(0.08, 0.38, 0.08, M('#E84A7F'), c0, 1.15, zp - 0.1);
      caja(0.24, 0.1, 0.3, M('#E84A7F'), c0, 1.36, zp);
      malla(new THREE.CylinderGeometry(0.11, 0.08, 0.15, 14), M('#C9D2D8', { metalness: 0.8, roughness: 0.25 }), c0, 1.1, zp + 0.04);
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group(); g.position.set(c0 + 0.65 + i * 0.55, 0.92, zp); escena.add(g);
        malla(new THREE.CylinderGeometry(0.06, 0.1, 0.1, 12), M('#D99E39'), 0, 0.05, 0, g);
        malla(new THREE.CylinderGeometry(0.18, 0.18, 0.15, 20), M(['#5B3A29', '#F3E7D8'][i]), 0, 0.17, 0, g);
        malla(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 20), M(['#F3E7D8', '#E84A7F'][i]), 0, 0.26, 0, g);
        for (let k = 0; k < 6; k++) malla(new THREE.SphereGeometry(0.03, 8, 6), M('#C5221F'), Math.cos(k) * 0.13, 0.29, Math.sin(k) * 0.13, g);
        info.tortas = (info.tortas || []).concat(g);
      }
      if (el.w >= 4) {
        [[0.2, 0.12], [0.15, 0.1], [0.1, 0.09]].forEach(([r, h], i) => malla(new THREE.CylinderGeometry(r, r, h, 20), M(i % 2 ? '#F2B6C3' : '#FBF4EC'), cx + 0.5, 0.98 + i * 0.11, zp));
        malla(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 18), M('#FBF4EC'), cx + mitad - 0.7, 0.93, zp);
        malla(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xE8F6FF, transparent: true, opacity: 0.25, roughness: 0.05 }), cx + mitad - 0.7, 0.94, zp);
        for (let k = 0; k < 3; k++) malla(new THREE.TorusGeometry(0.05, 0.03, 8, 14), M(['#E84A7F', '#5B3A29', '#E67929'][k]), cx + mitad - 0.78 + k * 0.08, 0.97, zp).rotation.x = Math.PI / 2;
      }
    }
    // Cocineros
    const n = cocinerosDeArea(el);
    for (let i = 0; i < n; i++) {
      const c = persona(ctx, gente, { ropa: '#FBF4EC', mandil: '#0B2C3E', gorro: 'chef', pantalon: '#1C1C22' });
      const x = n === 1 ? cx : cx + (i ? 1 : -1) * (el.w / 4);
      c.raiz.position.set(x, 0, norte + prof + 0.32);
      c.raiz.rotation.y = Math.PI;
      escena.add(c.raiz);
      c.fase = Math.random() * 6; c.rol = 'cocinero'; c.zona = info;
      info.cocineros.push(c);
      L.cocineros.push(c);
    }
  }

  /* ---------- Mesas ---------- */
  function silla(p: THREE.Object3D, x: number, z: number, mira: number) {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = mira; p.add(s);
    const cojin = M('#E8D5BC', { roughness: 0.9 });
    caja(0.46, 0.05, 0.44, matMadera, 0, 0.38, 0, s);
    caja(0.42, 0.07, 0.4, cojin, 0, 0.44, 0.01, s);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) caja(0.05, 0.38, 0.05, matMaderaOsc, lx, 0.19, lz, s);
    for (const lx of [-0.19, 0.19]) caja(0.05, 0.5, 0.05, matMaderaOsc, lx, 0.66, -0.19, s);
    caja(0.44, 0.07, 0.04, matMadera, 0, 0.88, -0.19, s);
    caja(0.36, 0.22, 0.05, cojin, 0, 0.68, -0.17, s);
  }
  function sillon(p: THREE.Object3D, x: number, z: number, mira: number) {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = mira; p.add(s);
    const azul = M('#2E5E8C', { roughness: 0.85 }), azulC = M('#3C74A8', { roughness: 0.85 });
    caja(0.62, 0.26, 0.58, azul, 0, 0.2, 0, s);
    caja(0.5, 0.12, 0.48, azulC, 0, 0.39, 0.03, s);
    caja(0.62, 0.5, 0.16, azul, 0, 0.6, -0.22, s);
    caja(0.5, 0.32, 0.08, azulC, 0, 0.6, -0.13, s);
    for (const lx of [-0.27, 0.27]) caja(0.1, 0.26, 0.56, azul, lx, 0.45, 0, s);
    for (const [lx, lz] of [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]]) caja(0.05, 0.07, 0.05, matMaderaOsc, lx, 0.035, lz, s);
  }
  function cartelReserva(padre: THREE.Object3D) {
    const t = texCanvas(256, 128, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6B4E9B'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
      g.fillStyle = '#0B2C3E'; g.font = '900 40px Montserrat, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RESERVADO', w / 2, h / 2);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const c = new THREE.Group(); c.position.set(0, 0.755, 0); padre.add(c);
    const mat = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), mat); pl.position.set(0, 0.085, s * 0.045); pl.rotation.x = s * 0.45; c.add(pl); }
    c.visible = false;
    return c;
  }
  function construirMesa(el: ItemEscena) {
    const sofa = el.estilo === 'sofa';
    const czm = sofa ? el.cz - 0.15 : el.cz;
    const g = new THREE.Group(); g.position.set(el.cx, 0, czm); escena.add(g);
    const anillo = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.3, 48), new THREE.MeshBasicMaterial({ color: COLOR_ESTADO.LIBRE, transparent: true, opacity: 0.5 }));
    anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.012; g.add(anillo);
    const [tw, td] = el.estilo === 'sillones' ? [1.15, 1.0] : [1.15, 0.95];
    caja(tw, 0.07, td, matMadera, 0, 0.72, 0, g);
    caja(tw - 0.08, 0.03, td - 0.08, matMaderaOsc, 0, 0.675, 0, g);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) caja(0.07, 0.66, 0.07, matMaderaOsc, lx * (tw / 2 - 0.09), 0.33, lz * (td / 2 - 0.09), g);
    const gx = el.x + el.w / 2, gy = el.y + el.h / 2;
    const sillas: Silla[] = puestosDeMesa(el).map(({ x, z, tipo }) => {
      const mira = Math.atan2(-x, -z);
      if (tipo === 'silla') silla(g, x, z, mira);
      if (tipo === 'sillon') sillon(g, x, z, mira);
      return { local: new THREE.Vector3(x, 0, z), mundo: new THREE.Vector3(el.cx + x, 0, czm + z), tipo, grilla: [gx + x, gy + z + (czm - el.cz)] as [number, number] };
    });
    const hacia = plano.pasilloY >= gy ? 1 : -1;
    L.mesas.push({
      id: el.id, item: el, nombre: el.etiqueta || (el.numero ? `Mesa ${el.numero}` : 'Mesa'), seats: el.asientos, cx: el.cx, cz: czm,
      gx, gy, servicio: [gx, gy + hacia * 1.75], mira: hacia > 0 ? Math.PI : 0,
      sillas, anillo, comida: new THREE.Group(), centro: new THREE.Group(), cartel: cartelReserva(g), vapor: [],
      etq: etiqueta('etq-mesa', new THREE.Vector3(el.cx, 0, czm), 1.25),
    });
    const m = L.mesas[L.mesas.length - 1];
    g.add(m.comida);
    m.centro.position.y = 0.755; g.add(m.centro);
  }

  /* ---------- Puntos de la caja y rincones de adorno ---------- */
  if (cajaItem) {
    L.pagoPunto = [cajaItem.x + 0.4, cajaItem.y + cajaItem.h + 0.55];
    L.esperaLlevar = [0, 1, 2].map((i): [number, number] => [cajaItem.x + 1.4 + i * 0.9, cajaItem.y + cajaItem.h + 0.75 + i * 0.1]);
  } else if (plano.entrada) {
    L.pagoPunto = [ancho / 2 + plano.entrada.cx - plano.entrada.dirX * 2, plano.pasilloY];
    L.esperaLlevar = [0, 1, 2].map((i): [number, number] => [L.pagoPunto[0], L.pagoPunto[1] + 0.5 + i * 0.5]);
  }
  const ent = plano.entrada;
  if (ent) {
    const px = ent.cx - ent.dirX * 0.8, pz = ent.cz - ent.dirZ * 0.8;
    const lat = ent.dirX ? [0, 1.7] : [1.7, 0];
    L.spots = [new THREE.Vector3(px - lat[0], 0, pz - lat[1]), new THREE.Vector3(px + lat[0], 0, pz + lat[1])];
  }
  if (cajaItem) L.spots.push(new THREE.Vector3(cajaItem.cx - cajaItem.w / 2 + 0.5, 0, cajaItem.cz + cajaItem.h / 2 + 1.5));
  if (!L.spots.length) L.spots.push(new THREE.Vector3(-ancho / 2 + 1.5, 0, 0));

  // Luces de la noche repartidas por el salón
  const lucesPos: Array<[number, number]> = [[-0.25, -0.25], [0, -0.25], [0.25, -0.25], [-0.25, 0.1], [0, 0.1], [0.25, 0.1], [-0.3, 0.4], [0.15, 0.4]];
  for (const [fx, fz] of lucesPos) {
    const l = new THREE.PointLight(0xFFC98A, 0, 6, 1.2); l.position.set(fx * ancho, 2.6, fz * alto + 1.5); escena.add(l); L.lucesNoche.push(l);
  }
  return L;
}
