import * as THREE from 'three';

/** Piezas comunes de la escena: materiales, texturas dibujadas en canvas y etiquetas HTML sobre el 3D. */
export interface Etq {
  el: HTMLDivElement;
  pos: THREE.Vector3 | THREE.Object3D;
  alto: number;
  visible: boolean;
}

export interface Ctx {
  escena: THREE.Scene;
  capa: HTMLElement;
  reducir: boolean;
  ligero: boolean;
  ancho: number;
  alto: number;
  etiquetas: Etq[];
  M: (c: THREE.ColorRepresentation, o?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  caja: (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, p?: THREE.Object3D) => THREE.Mesh;
  malla: (geo: THREE.BufferGeometry, mat: THREE.Material, x?: number, y?: number, z?: number, p?: THREE.Object3D) => THREE.Mesh;
  /** Celdas del plano → mundo */
  G: (x: number, y: number, h?: number) => THREE.Vector3;
  etiqueta: (clase: string, pos: THREE.Vector3 | THREE.Object3D, alto: number) => Etq;
  quitarEtiqueta: (e: Etq) => void;
  texCanvas: (w: number, h: number, dibujar: (g: CanvasRenderingContext2D, w: number, h: number) => void, rx?: number, ry?: number) => THREE.CanvasTexture;
  matMadera: THREE.MeshStandardMaterial;
  matMaderaOsc: THREE.MeshStandardMaterial;
}

export const azar = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const entre = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export function crearCtx(escena: THREE.Scene, capa: HTMLElement, ancho: number, alto: number, reducir: boolean, ligero: boolean): Ctx {
  const M: Ctx['M'] = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, ...o });
  const caja: Ctx['caja'] = (w, h, d, mat, x, y, z, p = escena) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
  };
  const malla: Ctx['malla'] = (geo, mat, x = 0, y = 0, z = 0, p = escena) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
  };
  const texCanvas: Ctx['texCanvas'] = (w, h, dibujar, rx = 1, ry = 1) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (g) dibujar(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
    return t;
  };
  const etiquetas: Etq[] = [];
  const etiqueta: Ctx['etiqueta'] = (clase, pos, alto2) => {
    const el = document.createElement('div');
    el.className = 'sv-etq ' + clase;
    capa.appendChild(el);
    const e: Etq = { el, pos, alto: alto2, visible: true };
    etiquetas.push(e);
    return e;
  };
  const quitarEtiqueta = (e: Etq) => { e.el.remove(); const i = etiquetas.indexOf(e); if (i >= 0) etiquetas.splice(i, 1); };

  const dibujarMadera = (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = '#D47E3C'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const y = Math.random() * h, a = 2 + Math.random() * 6;
      g.strokeStyle = `rgba(${150 + Math.random() * 30},${70 + Math.random() * 25},25,${0.18 + Math.random() * 0.25})`;
      g.lineWidth = 0.6 + Math.random() * 1.8;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / (30 + i) + i) * a);
      g.stroke();
    }
    for (let k = 0; k < 3; k++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = 'rgba(140,62,22,.35)'; g.beginPath(); g.ellipse(x, y, 10, 4, 0, 0, 7); g.fill(); }
  };
  const texMadera = texCanvas(256, 256, dibujarMadera);
  return {
    escena, capa, reducir, ligero, ancho, alto, etiquetas, M, caja, malla, texCanvas, etiqueta, quitarEtiqueta,
    G: (x, y, h = 0) => new THREE.Vector3(x - ancho / 2, h, y - alto / 2),
    matMadera: new THREE.MeshStandardMaterial({ map: texMadera, roughness: 0.5 }),
    matMaderaOsc: new THREE.MeshStandardMaterial({ map: texMadera, color: 0xC98A5A, roughness: 0.55 }),
  };
}

export function texLadrillo(ctx: Ctx, rx: number, ry: number) {
  return ctx.texCanvas(256, 128, (g, w, h) => {
    g.fillStyle = '#EFE3D3'; g.fillRect(0, 0, w, h);
    const tonos = ['#C96A3D', '#D47A48', '#BD5F36', '#D9875A', '#C4704A'];
    const fh = h / 4, bw = w / 4;
    for (let f = 0; f < 4; f++) for (let c = -1; c < 5; c++) {
      const x = c * bw + (f % 2 ? bw / 2 : 0);
      g.fillStyle = tonos[(f * 3 + c + 9) % tonos.length];
      g.fillRect(x + 3, f * fh + 3, bw - 6, fh - 6);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 3, f * fh + 3, bw - 6, 4);
    }
  }, rx, ry);
}

export function formaCorazon() {
  const f = new THREE.Shape();
  f.moveTo(0, 0.25); f.bezierCurveTo(0, 0.3, -0.05, 0.4, -0.2, 0.4); f.bezierCurveTo(-0.45, 0.4, -0.45, 0.12, -0.45, 0.12);
  f.bezierCurveTo(-0.45, -0.05, -0.3, -0.22, 0, -0.4); f.bezierCurveTo(0.3, -0.22, 0.45, -0.05, 0.45, 0.12);
  f.bezierCurveTo(0.45, 0.12, 0.45, 0.4, 0.2, 0.4); f.bezierCurveTo(0.05, 0.4, 0, 0.3, 0, 0.25);
  return f;
}

/** Libera geometrías, materiales y texturas de todo lo que cuelga del objeto. */
export function liberar(raiz: THREE.Object3D) {
  raiz.traverse((o: any) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { for (const k of ['map', 'emissiveMap']) m[k]?.dispose?.(); m.dispose?.(); }
  });
}
