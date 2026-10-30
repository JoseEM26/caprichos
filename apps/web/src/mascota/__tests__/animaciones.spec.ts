import { describe, it, expect } from 'vitest';
import {
  ESTADOS_CAPRI,
  POSE_INICIAL,
  calcularPoseObjetivo,
  interpolarPose,
  lerp,
  crearControlParpadeo,
  calcularParpadeo,
} from '../animaciones';

describe('animaciones.ts', () => {
  it('contiene los 7 estados obligatorios', () => {
    expect(ESTADOS_CAPRI).toEqual([
      'reposo',
      'saludando',
      'pensando',
      'hablando',
      'contento',
      'confundido',
      'dormido',
    ]);
  });

  describe('calcularPoseObjetivo', () => {
    it('genera poses válidas con números finitos para todos los estados', () => {
      ESTADOS_CAPRI.forEach((estado) => {
        const pose = calcularPoseObjetivo(estado, 1.5, {
          puntero: { x: 0.5, y: -0.3 },
          parpadeoForzado: 0,
        });

        expect(Number.isFinite(pose.cuerpoY)).toBe(true);
        expect(Number.isFinite(pose.cuerpoRotZ)).toBe(true);
        expect(Number.isFinite(pose.cabezaRotX)).toBe(true);
        expect(Number.isFinite(pose.cabezaRotY)).toBe(true);
        expect(Number.isFinite(pose.cabezaRotZ)).toBe(true);
        expect(Number.isFinite(pose.brazoIzqRotZ)).toBe(true);
        expect(Number.isFinite(pose.brazoDerRotZ)).toBe(true);
        expect(Number.isFinite(pose.parpadoSuperior)).toBe(true);
        expect(Number.isFinite(pose.bocaApertura)).toBe(true);
        expect(Number.isFinite(pose.escalaPensar)).toBe(true);
        expect(Number.isFinite(pose.escalaBrillo)).toBe(true);
      });
    });

    it('en estado dormido mantiene los párpados cerrados (1.0)', () => {
      const pose = calcularPoseObjetivo('dormido', 2.0);
      expect(pose.parpadoSuperior).toBe(1.0);
      expect(pose.bocaApertura).toBe(0);
      expect(pose.cabezaRotX).toBeGreaterThan(0); // cabeza inclinada hacia abajo
    });

    it('en estado pensando activa el accesorio de pensamiento y ladea la cabeza', () => {
      const pose = calcularPoseObjetivo('pensando', 1.0);
      expect(pose.escalaPensar).toBeGreaterThan(0.5);
      expect(pose.cabezaRotZ).toBeGreaterThan(0.2); // cabeza ladeada
      expect(pose.brazoDerRotZ).toBeLessThan(-1.0); // mano cerca del mentón
    });

    it('en estado contento genera rebote vertical, brazos elevados y brillo', () => {
      const pose = calcularPoseObjetivo('contento', 0.2);
      expect(pose.escalaBrillo).toBeGreaterThan(0.5);
      expect(pose.brazoIzqRotZ).toBeGreaterThan(1.5);
      expect(pose.brazoDerRotZ).toBeLessThan(-1.5);
    });

    it('en estado saludando agita el brazo derecho', () => {
      const pose1 = calcularPoseObjetivo('saludando', 0);
      const pose2 = calcularPoseObjetivo('saludando', 0.17); // ~cuarto de periodo
      expect(pose1.brazoDerRotZ).not.toBe(pose2.brazoDerRotZ);
      expect(pose1.brazoDerRotZ).toBeLessThan(-1.5);
    });

    it('sigue la mirada del puntero suavemente en reposo', () => {
      const poseCentro = calcularPoseObjetivo('reposo', 0, { puntero: { x: 0, y: 0 } });
      const poseDerecha = calcularPoseObjetivo('reposo', 0, { puntero: { x: 1, y: 0 } });
      const poseArriba = calcularPoseObjetivo('reposo', 0, { puntero: { x: 0, y: 1 } });

      expect(poseDerecha.cabezaRotY).toBeGreaterThan(poseCentro.cabezaRotY);
      expect(poseArriba.cabezaRotX).toBeLessThan(poseCentro.cabezaRotX);
    });

    it('acota coordenadas del puntero fuera del rango [-1, 1]', () => {
      const poseNormal = calcularPoseObjetivo('reposo', 0, { puntero: { x: 1, y: 1 } });
      const poseExtrema = calcularPoseObjetivo('reposo', 0, { puntero: { x: 5, y: 10 } });
      expect(poseExtrema.cabezaRotY).toBe(poseNormal.cabezaRotY);
      expect(poseExtrema.cabezaRotX).toBe(poseNormal.cabezaRotX);
    });
  });

  describe('interpolarPose y lerp', () => {
    it('lerp interpola con precisión matemática', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(10, 20, 0)).toBe(10);
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('interpolarPose transiciona suavemente entre dos poses', () => {
      const poseA = POSE_INICIAL;
      const poseB = calcularPoseObjetivo('contento', 1);

      const mitad = interpolarPose(poseA, poseB, 0.5);
      expect(mitad.cuerpoY).toBeCloseTo(lerp(poseA.cuerpoY, poseB.cuerpoY, 0.5));
      expect(mitad.brazoDerRotZ).toBeCloseTo(lerp(poseA.brazoDerRotZ, poseB.brazoDerRotZ, 0.5));

      const alFinal = interpolarPose(poseA, poseB, 1.0);
      expect(alFinal.cuerpoY).toBeCloseTo(poseB.cuerpoY);
      expect(alFinal.escalaBrillo).toBeCloseTo(poseB.escalaBrillo);
    });
  });

  describe('calcularParpadeo', () => {
    it('no parpadea antes del intervalo fijado', () => {
      const control = crearControlParpadeo(0);
      control.intervaloActual = 3.0;
      expect(calcularParpadeo(1.5, control)).toBe(0);
    });

    it('cierra y abre los párpados en curva suave durante el parpadeo', () => {
      const control = crearControlParpadeo(0);
      control.intervaloActual = 3.0;
      control.duracionParpadeo = 0.2;

      // Al cumplirse el intervalo justo en el punto medio del parpadeo (3.1s)
      const valorMedio = calcularParpadeo(3.1, control);
      expect(valorMedio).toBeCloseTo(1.0, 1);

      // Al inicio del parpadeo (3.05s)
      const valorInicio = calcularParpadeo(3.05, control);
      expect(valorInicio).toBeGreaterThan(0);
      expect(valorInicio).toBeLessThan(1);

      // Al terminar el parpadeo programa el siguiente y vuelve a 0
      const valorFin = calcularParpadeo(3.25, control, () => 0.5);
      expect(valorFin).toBe(0);
      expect(control.tiempoUltimoParpadeo).toBe(3.25);
      expect(control.intervaloActual).toBeGreaterThanOrEqual(2.5);
    });
  });
});
