/**
 * soporteWebGL.ts
 * Utilidad pura para detectar soporte real de WebGL en el navegador o entorno actual.
 * No importa Three.js para evitar que entre en el bundle principal.
 */

export function tieneSoporteWebGL(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // En jsdom no existe WebGL real; evitar la advertencia de getContext no implementado
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    return Boolean(gl);
  } catch {
    return false;
  }
}

export function prefiereMovimientoReducido(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
