import * as THREE from 'three';

/** Colores y letra del cartel que sostiene el avatar (los da la temática de la carta; el avatar no cambia). */
export interface OpcionesCartel {
  titulo: string;
  subtitulo: string;
  fondo: string;
  tinta: string;
  borde: string;
  acento: string;
  /** Pila CSS de la letra, p. ej. `"Pacifico", cursive` */
  fuente: string;
}

export const CARTEL_W = 0.8;
export const CARTEL_H = 0.52;
const PX = 1024;
const PY = Math.round((PX * CARTEL_H) / CARTEL_W);

const primera = (pila: string) => pila.split(',')[0].trim();

/** Ajusta el tamaño de la letra hasta que el texto entre en `ancho`. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, pila: string, peso: number, max: number, ancho: number): number {
  let px = max;
  for (; px > 20; px -= 4) {
    ctx.font = `${peso} ${px}px ${pila}`;
    if (ctx.measureText(texto).width <= ancho) break;
  }
  return px;
}

/** Dibuja el cartel (cartulina con borde, título grande y código debajo) en un canvas 2D. */
export function dibujarCartel(ctx: CanvasRenderingContext2D, o: OpcionesCartel): void {
  const r = 56, m = 26;
  ctx.clearRect(0, 0, PX, PY);
  ctx.fillStyle = o.borde;
  ctx.beginPath(); ctx.roundRect(0, 0, PX, PY, r); ctx.fill();
  ctx.fillStyle = o.fondo;
  ctx.beginPath(); ctx.roundRect(m, m, PX - 2 * m, PY - 2 * m, r - 20); ctx.fill();
  ctx.strokeStyle = o.acento; ctx.globalAlpha = 0.55; ctx.lineWidth = 5; ctx.setLineDash([4, 16]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.roundRect(m + 22, m + 22, PX - 2 * m - 44, PY - 2 * m - 44, r - 36); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ancho = PX - 2 * m - 110;
  const pt = ajustar(ctx, o.titulo, o.fuente, 800, 170, ancho);
  ctx.fillStyle = o.tinta; ctx.font = `800 ${pt}px ${o.fuente}`;
  ctx.fillText(o.titulo, PX / 2, PY * 0.4);
  const ps = ajustar(ctx, o.subtitulo, o.fuente, 700, 100, ancho);
  ctx.fillStyle = o.acento; ctx.font = `700 ${ps}px ${o.fuente}`;
  ctx.fillText(o.subtitulo, PX / 2, PY * 0.73);
}

/** Panel 3D con el texto como textura. Las letras se redibujan cuando la fuente web termina de cargar. */
export function crearCartel(o: OpcionesCartel) {
  const lienzo = document.createElement('canvas');
  lienzo.width = PX; lienzo.height = PY;
  const ctx = lienzo.getContext('2d')!;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const pintar = () => { dibujarCartel(ctx, o); tex.needsUpdate = true; };
  pintar();
  void document.fonts?.load(`800 64px ${primera(o.fuente)}`).then(pintar, () => {});
  const borde = new THREE.MeshStandardMaterial({ color: o.borde, roughness: 0.7 });
  const frente = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, alphaTest: 0.5 });
  const malla = new THREE.Mesh(new THREE.BoxGeometry(CARTEL_W, CARTEL_H, 0.035), [borde, borde, borde, borde, frente, borde]);
  malla.castShadow = true;
  const grupo = new THREE.Group();
  grupo.add(malla);
  grupo.visible = false;
  return {
    grupo,
    dispose: () => { tex.dispose(); malla.geometry.dispose(); borde.dispose(); frente.dispose(); },
  };
}
