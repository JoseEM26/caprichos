import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cargarAvatar } from '../piezas';

const IDS = [
  'corto', 'degradado', 'rapado', 'mohicano', 'erizado', 'raya_costado', 'militar', 'undercut', 'quiff', 'buzz_lineas', 'pixie', 'mullet', 'rizos_fade',
  'cerquillo_recto', 'cerquillo_lado', 'cerquillo_cortina', 'bob_cerquillo', 'flequillo_largo',
  'bob', 'lob', 'hombros', 'ondulado', 'shaggy', 'capas',
];

function avatarCon(A: any, id: string, gorro: string) {
  const piezas = (cat: string) => ({ id: A.REG[cat][0].id, colores: {} });
  return A.construir({
    nombre: 'P', genero: 'mujer', piel: '#F2C9A0', ojos: '#5B3A29', expresion: 'feliz', colorPelo: '#4A2C1D',
    cabello: { id, colores: { principal: '#4A2C1D' } }, arriba: piezas('arriba'), abajo: piezas('abajo'), calzado: piezas('calzado'),
    accesorio: { id: 'ninguno' }, cabeza: { id: gorro, colores: {} }, cara: { id: 'ninguno' },
  });
}

describe('peinados Corto, Con cerquillo y Mediano', () => {
  const A: any = cargarAvatar();

  it('siguen registrados con sus ids (los avatares guardados no se rompen)', () => {
    for (const id of IDS) expect(A.buscar('cabello', id), id).toBeTruthy();
  });

  it('con y sin gorro no dan NaN ni tapan los ojos y las cejas (z > .12, |x| < .215, y entre -.12 y .16)', () => {
    const v = new THREE.Vector3();
    for (const id of IDS) for (const gorro of ['ninguno', 'gorro_chef', 'casco_vikingo']) {
      const av = avatarCon(A, id, gorro);
      av.raiz.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(av.cabeza.matrixWorld).invert();
      av.cabeza.traverse((o: any) => {
        if (!(o.isMesh && o.material.vertexColors)) return; // solo las mallas del pelo (usan color por vértice)
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), p = o.geometry.attributes.position;
        let malos = 0;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m);
          expect(Number.isFinite(v.x + v.y + v.z), `${id}/${gorro} NaN`).toBe(true);
          if (v.z > 0.12 && Math.abs(v.x) < 0.215 && v.y < 0.16 && v.y > -0.12) malos++;
        }
        expect(malos, `${id}/${gorro} baja de la frente`).toBe(0);
      });
    }
  });
});
