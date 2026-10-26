import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  construirCapri,
  aplicarPoseCapri,
  liberarCapri,
  COLORES_CAPRI,
} from '../construirCapri';
import { calcularPoseObjetivo } from '../animaciones';

describe('construirCapri.ts', () => {
  it('construye la jerarquía 3D con todas las piezas animables requeridas', () => {
    const piezas = construirCapri();

    expect(piezas.raiz).toBeInstanceOf(THREE.Group);
    expect(piezas.personaje).toBeInstanceOf(THREE.Group);
    expect(piezas.cuerpo).toBeInstanceOf(THREE.Group);
    expect(piezas.cabeza).toBeInstanceOf(THREE.Group);
    expect(piezas.brazoIzquierdo).toBeInstanceOf(THREE.Group);
    expect(piezas.brazoDerecho).toBeInstanceOf(THREE.Group);
    expect(piezas.ojoIzquierdo).toBeInstanceOf(THREE.Group);
    expect(piezas.ojoDerecho).toBeInstanceOf(THREE.Group);
    expect(piezas.parpados.izquierdo).toBeInstanceOf(THREE.Group);
    expect(piezas.parpados.derecho).toBeInstanceOf(THREE.Group);
    expect(piezas.boca).toBeInstanceOf(THREE.Mesh);
    expect(piezas.accesorioPensar).toBeInstanceOf(THREE.Group);
    expect(piezas.accesorioBrillo).toBeInstanceOf(THREE.Group);
    expect(piezas.sombraContacto).toBeInstanceOf(THREE.Mesh);

    expect(piezas.geometrias.length).toBeGreaterThan(10);
    expect(piezas.materiales.length).toBeGreaterThan(5);

    liberarCapri(piezas);
  });

  it('utiliza la paleta corporativa de Caprichos en los materiales', () => {
    const piezas = construirCapri();

    // Verificamos constantes de color
    expect(COLORES_CAPRI.azulMarino).toBe(0x0b2c3e);
    expect(COLORES_CAPRI.crema).toBe(0xfbf4ec);
    expect(COLORES_CAPRI.naranja).toBe(0xe67929);
    expect(COLORES_CAPRI.dorado).toBe(0xd99e39);

    // Verificamos que los materiales registrados posean los colores corporativos
    const coloresRegistrados = piezas.materiales
      .filter((m) => 'color' in m)
      .map((m) => (m as THREE.MeshStandardMaterial).color.getHex());

    expect(coloresRegistrados).toContain(COLORES_CAPRI.naranja);
    expect(coloresRegistrados).toContain(COLORES_CAPRI.crema);
    expect(coloresRegistrados).toContain(COLORES_CAPRI.azulMarino);
    expect(coloresRegistrados).toContain(COLORES_CAPRI.dorado);

    liberarCapri(piezas);
  });

  it('aplica transformaciones dinámicas con aplicarPoseCapri', () => {
    const piezas = construirCapri();

    // Pose contento: salto, brillo y brazos alzados
    const poseContento = calcularPoseObjetivo('contento', 0.2);
    aplicarPoseCapri(piezas, poseContento);

    expect(piezas.personaje.position.y).toBeCloseTo(poseContento.cuerpoY + poseContento.reboteY);
    expect(piezas.accesorioBrillo.scale.x).toBeCloseTo(poseContento.escalaBrillo);
    expect(piezas.brazoIzquierdo.rotation.z).toBeCloseTo(-poseContento.brazoIzqRotZ);
    expect(piezas.brazoDerecho.rotation.z).toBeCloseTo(-poseContento.brazoDerRotZ);

    // Pose dormido: párpados cerrados
    const poseDormido = calcularPoseObjetivo('dormido', 1.0);
    aplicarPoseCapri(piezas, poseDormido);
    expect(piezas.parpados.izquierdo.rotation.x).toBeCloseTo(0); // 0 rad = cerrado
    expect(piezas.parpados.derecho.rotation.x).toBeCloseTo(0);

    liberarCapri(piezas);
  });

  it('libera adecuadamente todas las geometrías y materiales al invocar liberarCapri', () => {
    const piezas = construirCapri();

    const spiesGeo = piezas.geometrias.map((g) => vi.spyOn(g, 'dispose'));
    const spiesMat = piezas.materiales.map((m) => vi.spyOn(m, 'dispose'));

    liberarCapri(piezas);

    spiesGeo.forEach((spy) => expect(spy).toHaveBeenCalled());
    spiesMat.forEach((spy) => expect(spy).toHaveBeenCalled());
  });
});
