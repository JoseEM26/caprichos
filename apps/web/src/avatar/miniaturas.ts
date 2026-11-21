import * as THREE from 'three';
import { conPelo } from './config';
import { liberar, luces } from './escena';
import type { Avatar3D, ConfigAvatar } from './tipos';

export type ZoomMini = 'cuerpo' | 'cabeza' | 'pies' | 'retrato' | 'mascota';

const W = 160;
const H = 200;
const TOPE_RETRATO = 180 * 1024; // bajo el tope de 200 KB de la API

/**
 * Renderer aparte para las miniaturas de cada pieza (con caché) y para el retrato PNG que se guarda en la cuenta.
 * Se crea una sola vez por editor y se libera con dispose().
 */
export function crearMiniaturas(A: Avatar3D) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.setClearColor(0xf6eadb, 1);
  const esc = new THREE.Scene();
  luces(esc);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
  const cache = new Map<string, string>();
  let cola: [ConfigAvatar, ZoomMini, (url: string) => void][] = [];
  let trabajando = false;
  let frame = 0;
  let muerto = false;

  function foto(c: ConfigAvatar, zoom: ZoomMini, lado = 200, formato: 'jpeg' | 'png' = 'jpeg'): string {
    const clave = JSON.stringify([c, zoom, lado, formato]);
    const guardada = cache.get(clave);
    if (guardada) return guardada;
    const p = A.construir(conPelo(c));
    esc.add(p.raiz);
    const [d, y, m] = zoom === 'cabeza' ? [1.55, 1.5, 1.42] : zoom === 'pies' ? [1.25, 0.5, 0.22] : zoom === 'retrato' ? [1.75, 1.46, 1.36] : [4.4, 1.1, 0.88];
    const ang = zoom === 'pies' || zoom === 'mascota' ? 0.5 : 0;
    const cuadrada = zoom === 'retrato';
    // Retrato y primer plano de la cara: sin la mascota (quedaría recortada al borde); la pestaña Mascota la muestra sola
    if (p.mascota && (zoom === 'retrato' || zoom === 'cabeza' || zoom === 'pies')) p.mascota.visible = false;
    let dist = d, mirY = m, camY = y, mirX = 0, camX = 0, camZ = 0;
    if (zoom === 'mascota' && p.mascota) {
      p.cuerpo.visible = false;
      const caja = new THREE.Box3().setFromObject(p.mascota);
      const cen = caja.getCenter(new THREE.Vector3());
      const tam = caja.getSize(new THREE.Vector3());
      dist = Math.max(tam.x, tam.y * 0.8) * 2.9 + 0.25;
      mirY = cen.y; camY = cen.y + 0.1; mirX = cen.x; camX = cen.x; camZ = cen.z;
    }
    cam.aspect = cuadrada ? 1 : W / H;
    r.setSize(cuadrada ? lado : W, cuadrada ? lado : H);
    cam.position.set(camX + Math.sin(ang) * dist, camY, camZ + Math.cos(ang) * dist);
    cam.lookAt(mirX, mirY, camZ);
    cam.updateProjectionMatrix();
    r.render(esc, cam);
    const url = r.domElement.toDataURL(formato === 'png' ? 'image/png' : 'image/jpeg', 0.85);
    esc.remove(p.raiz);
    liberar(p.raiz);
    if (formato === 'jpeg') {
      if (cache.size > 400) cache.delete(cache.keys().next().value as string);
      cache.set(clave, url);
    }
    return url;
  }

  function seguir() {
    trabajando = cola.length > 0;
    if (!trabajando || muerto) return;
    const inicio = performance.now();
    while (cola.length && performance.now() - inicio < 24) {
      const [c, z, f] = cola.shift()!;
      try { f(foto(c, z)); } catch { f(''); }
    }
    frame = requestAnimationFrame(seguir);
  }

  return {
    pedir(c: ConfigAvatar, zoom: ZoomMini, alListo: (url: string) => void) {
      cola.push([c, zoom, alListo]);
      if (!trabajando) seguir();
    },
    cancelar() { cola = []; },
    /** Retrato PNG cuadrado para la cuenta: se achica hasta pasar el tope de la API. */
    retrato(c: ConfigAvatar): string {
      let url = '';
      for (const lado of [256, 192, 128]) {
        url = foto(c, 'retrato', lado, 'png');
        if (Math.ceil(((url.length - 22) * 3) / 4) <= TOPE_RETRATO) break;
      }
      return url;
    },
    dispose() {
      muerto = true;
      cancelAnimationFrame(frame);
      cola = [];
      r.dispose();
    },
  };
}
export type Miniaturas = ReturnType<typeof crearMiniaturas>;
