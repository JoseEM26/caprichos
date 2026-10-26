/**
 * Punto de entrada del módulo de la mascota Capri.
 */

export { MascotaCapri, type MascotaCapriProps } from './MascotaCapri';
export { CapriFallback, type CapriFallbackProps } from './CapriFallback';
export {
  ESTADOS_CAPRI,
  type EstadoCapri,
  type PoseCapri,
  calcularPoseObjetivo,
  interpolarPose,
  lerp,
} from './animaciones';
export {
  construirCapri,
  aplicarPoseCapri,
  liberarCapri,
  COLORES_CAPRI,
  type PiezasCapri,
} from './construirCapri';
export { tieneSoporteWebGL, prefiereMovimientoReducido } from './soporteWebGL';

export { MascotaCapri as default } from './MascotaCapri';
