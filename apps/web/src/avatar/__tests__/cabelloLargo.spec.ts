import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { cargarAvatar } from '../piezas';

const IDS = [
  'largo_lacio', 'largo_ondulado', 'largo_raya_medio', 'ondas_playa', 'largo_capas', 'media_cola',
  'media_cola', 'cola_alta', 'cola_baja', 'dos_colitas', 'mono_alto', 'mono_bajo', 'dos_monos', 'mono_despeinado',
  'coletas_altas', 'cola_flequillo', 'trenza', 'dos_trenzas', 'trenza_espiga', 'trenzas_boxeadoras', 'media_cola_trenza',
  'rizado_corto', 'afro', 'afro_puff', 'rizos_largos', 'rizos_raya_costado', 'rastas', 'bantu_knots',
];

const config = (id: string, genero = 'mujer') => ({
  nombre: 'T', genero, piel: '#F2C9A0', ojos: '#5B3A29', expresion: 'feliz',
  cabello: { id, colores: { principal: '#4A2C1D' } },
});

/** Vértices del pelo (mallas con colores por vértice) en coordenadas de la cabeza. */
function verticesPelo(raiz: THREE.Object3D, cabeza: THREE.Object3D) {
  const out: THREE.Vector3[] = [];
  cabeza.updateMatrixWorld(true);
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.getAttribute('color')) return;
    const p = m.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrix));
  });
  return out;
}

describe('cabello largo, recogido y rizado', () => {
  const A = cargarAvatar();

  it('registra todos los peinados una sola vez y en su grupo', () => {
    const adv = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const id of new Set(IDS)) {
      expect(A.REG.cabello.filter((d) => d.id === id)).toHaveLength(1);
    }
    for (const d of A.REG.cabello.filter((x) => ['Largo', 'Recogido', 'Rizado'].includes(x.grupo ?? ''))) expect(IDS).toContain(d.id);
    expect(adv).not.toHaveBeenCalled();
    adv.mockRestore();
  });

  for (const genero of ['mujer', 'hombre']) {
    it(`construye cada peinado (${genero}) sin errores, sin tapar la cara y sin pasar por el torso`, () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fallos: string[] = [];
      for (const id of new Set(IDS)) {
        const partes = A.construir(config(id, genero)) as unknown as { raiz: THREE.Object3D; cabeza: THREE.Object3D; animar: (t: number, dt: number) => void };
        partes.animar(1.3, 0.016);
        const vs = verticesPelo(partes.raiz, partes.cabeza);
        expect(vs.length, id).toBeGreaterThan(200);
        // regla de la frente: en la cara nada baja de MED.frenteY (0.16)
        const malos = vs.filter((v) => v.z > 0.12 && Math.abs(v.x) < 0.2 && v.y > -0.28 && v.y < 0.16);
        if (malos.length) fallos.push(`${id}:${malos.length} (y min ${Math.min(...malos.map((v) => v.y)).toFixed(3)}) en ${malos[0].toArray().map((n) => n.toFixed(3)).join(",")}`);
        // nada del pelo es NaN
        expect(vs.every((v) => Number.isFinite(v.x + v.y + v.z)), id).toBe(true);
      }
      expect(fallos, 'vértices bajo la frente').toEqual([]);
      expect(err).not.toHaveBeenCalled();
      err.mockRestore();
    });
  }
});
