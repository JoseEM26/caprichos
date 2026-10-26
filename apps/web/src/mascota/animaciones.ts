/**
 * animaciones.ts
 * Lógica pura de poses, transiciones, interpolación y parpadeo para Capri.
 * Totalmente testeable de forma aislada sin dependencias de DOM ni WebGL.
 */

export type EstadoCapri =
  | 'reposo'
  | 'saludando'
  | 'pensando'
  | 'hablando'
  | 'contento'
  | 'confundido'
  | 'dormido';

export const ESTADOS_CAPRI: readonly EstadoCapri[] = [
  'reposo',
  'saludando',
  'pensando',
  'hablando',
  'contento',
  'confundido',
  'dormido',
] as const;

export interface PoseCapri {
  cuerpoY: number;
  cuerpoRotZ: number;
  cuerpoRotX: number;
  cabezaRotX: number;
  cabezaRotY: number;
  cabezaRotZ: number;
  brazoIzqRotZ: number;
  brazoIzqRotX: number;
  brazoDerRotZ: number;
  brazoDerRotX: number;
  parpadoSuperior: number; // 0 = abierto, 1 = cerrado
  bocaApertura: number;    // 0 = cerrada, 1 = abierta
  escalaPensar: number;    // 0 = invisible, 1 = visible
  escalaBrillo: number;    // 0 = invisible, 1 = visible
  reboteY: number;
}

export const POSE_INICIAL: PoseCapri = {
  cuerpoY: 0,
  cuerpoRotZ: 0,
  cuerpoRotX: 0,
  cabezaRotX: 0,
  cabezaRotY: 0,
  cabezaRotZ: 0,
  brazoIzqRotZ: 0.25,
  brazoIzqRotX: 0,
  brazoDerRotZ: -0.25,
  brazoDerRotX: 0,
  parpadoSuperior: 0,
  bocaApertura: 0,
  escalaPensar: 0,
  escalaBrillo: 0,
  reboteY: 0,
};

export interface OpcionesPose {
  puntero?: { x: number; y: number }; // -1 a +1
  parpadeoForzado?: number;           // 0 a 1
}

/**
 * Calcula la pose objetivo según el estado y el tiempo actual (en segundos).
 */
export function calcularPoseObjetivo(
  estado: EstadoCapri,
  tiempo: number,
  opciones?: OpcionesPose
): PoseCapri {
  const px = Math.max(-1, Math.min(1, opciones?.puntero?.x ?? 0));
  const py = Math.max(-1, Math.min(1, opciones?.puntero?.y ?? 0));
  const parpadeo = opciones?.parpadeoForzado ?? 0;

  switch (estado) {
    case 'reposo': {
      // Respiración suave y balanceo sutil
      const respiracion = Math.sin(tiempo * 2.5) * 0.04;
      const balanceo = Math.sin(tiempo * 1.25) * 0.02;
      return {
        cuerpoY: respiracion,
        cuerpoRotZ: balanceo,
        cuerpoRotX: 0,
        cabezaRotX: -py * 0.2,
        cabezaRotY: px * 0.35,
        cabezaRotZ: balanceo * 0.5,
        brazoIzqRotZ: 0.25 + Math.sin(tiempo * 2.5) * 0.03,
        brazoIzqRotX: 0,
        brazoDerRotZ: -0.25 - Math.sin(tiempo * 2.5) * 0.03,
        brazoDerRotX: 0,
        parpadoSuperior: parpadeo,
        bocaApertura: 0,
        escalaPensar: 0,
        escalaBrillo: 0,
        reboteY: 0,
      };
    }

    case 'saludando': {
      // Brazo derecho (cuchillo/espátula amable) se eleva y saluda de lado a lado
      const agite = Math.sin(tiempo * 9) * 0.35;
      const cabeceo = Math.sin(tiempo * 4.5) * 0.04;
      return {
        cuerpoY: cabeceo,
        cuerpoRotZ: -0.05,
        cuerpoRotX: 0,
        cabezaRotX: -py * 0.15,
        cabezaRotY: px * 0.25,
        cabezaRotZ: -0.12,
        brazoIzqRotZ: 0.2,
        brazoIzqRotX: 0,
        brazoDerRotZ: -2.35 + agite,
        brazoDerRotX: 0.2,
        parpadoSuperior: parpadeo,
        bocaApertura: 0.25,
        escalaPensar: 0,
        escalaBrillo: 0,
        reboteY: 0,
      };
    }

    case 'pensando': {
      // Cabeza inclinada hacia arriba, mano cerca del mentón, punto de luz que pulsa
      const pulso = 0.85 + Math.sin(tiempo * 4) * 0.25;
      return {
        cuerpoY: Math.sin(tiempo * 1.5) * 0.02,
        cuerpoRotZ: 0.05,
        cuerpoRotX: -0.05,
        cabezaRotX: -0.25,
        cabezaRotY: 0.2,
        cabezaRotZ: 0.28,
        brazoIzqRotZ: 0.15,
        brazoIzqRotX: 0,
        brazoDerRotZ: -1.75,
        brazoDerRotX: 0.45,
        parpadoSuperior: Math.max(parpadeo, 0.2), // Ojos entrecerrados reflexivos
        bocaApertura: 0.05,
        escalaPensar: Math.max(0, pulso),
        escalaBrillo: 0,
        reboteY: 0,
      };
    }

    case 'hablando': {
      // Apertura rítmica de boca, rebote alegre y gesticulación de brazos
      const boca = Math.abs(Math.sin(tiempo * 11)) * 0.85;
      const rebotito = Math.abs(Math.sin(tiempo * 7)) * 0.05;
      const gesticulacion = Math.sin(tiempo * 6) * 0.2;
      return {
        cuerpoY: rebotito,
        cuerpoRotZ: Math.sin(tiempo * 3) * 0.03,
        cuerpoRotX: 0.04,
        cabezaRotX: -py * 0.2 + (Math.sin(tiempo * 8) * 0.05),
        cabezaRotY: px * 0.3,
        cabezaRotZ: Math.sin(tiempo * 5) * 0.04,
        brazoIzqRotZ: 0.45 + gesticulacion,
        brazoIzqRotX: 0.2,
        brazoDerRotZ: -0.45 - gesticulacion,
        brazoDerRotX: 0.2,
        parpadoSuperior: parpadeo,
        bocaApertura: boca,
        escalaPensar: 0,
        escalaBrillo: 0,
        reboteY: 0,
      };
    }

    case 'contento': {
      // Salto enérgico, brazos levantados de alegría y destellos de brillo
      const salto = Math.max(0, Math.sin(tiempo * 8)) * 0.28;
      const brillo = 0.8 + Math.sin(tiempo * 6) * 0.25;
      return {
        cuerpoY: salto,
        cuerpoRotZ: Math.sin(tiempo * 8) * 0.06,
        cuerpoRotX: 0,
        cabezaRotX: -0.15,
        cabezaRotY: px * 0.2,
        cabezaRotZ: Math.sin(tiempo * 8) * 0.08,
        brazoIzqRotZ: 2.2 + Math.sin(tiempo * 8) * 0.15,
        brazoIzqRotX: 0.1,
        brazoDerRotZ: -2.2 - Math.sin(tiempo * 8) * 0.15,
        brazoDerRotX: 0.1,
        parpadoSuperior: 0, // Ojos abiertos de alegría
        bocaApertura: 0.6,
        escalaPensar: 0,
        escalaBrillo: Math.max(0, brillo),
        reboteY: salto,
      };
    }

    case 'confundido': {
      // Cabeza ladeada pronunciadamente, encogimiento de hombros
      const duda = Math.sin(tiempo * 2) * 0.05;
      return {
        cuerpoY: 0,
        cuerpoRotZ: -0.08,
        cuerpoRotX: 0.05,
        cabezaRotX: -py * 0.1,
        cabezaRotY: 0.1,
        cabezaRotZ: -0.38 + duda,
        brazoIzqRotZ: 0.75,
        brazoIzqRotX: 0.3,
        brazoDerRotZ: -0.75,
        brazoDerRotX: 0.3,
        parpadoSuperior: parpadeo,
        bocaApertura: 0.1,
        escalaPensar: 0,
        escalaBrillo: 0,
        reboteY: 0,
      };
    }

    case 'dormido': {
      // Ojos completamente cerrados, respiración profunda y lenta, cabeza caída
      const respiracionProfunda = Math.sin(tiempo * 1.2) * 0.03;
      return {
        cuerpoY: respiracionProfunda,
        cuerpoRotZ: 0.03,
        cuerpoRotX: 0.08,
        cabezaRotX: 0.22,
        cabezaRotY: 0,
        cabezaRotZ: 0.12,
        brazoIzqRotZ: 0.15,
        brazoIzqRotX: 0,
        brazoDerRotZ: -0.15,
        brazoDerRotX: 0,
        parpadoSuperior: 1.0, // Completamente cerrado
        bocaApertura: 0,
        escalaPensar: 0,
        escalaBrillo: 0,
        reboteY: 0,
      };
    }
  }
}

/**
 * Interpolación lineal simple entre dos valores escalares.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpola suavemente entre la pose actual y la pose objetivo con un factor t (0 a 1).
 */
export function interpolarPose(actual: PoseCapri, objetivo: PoseCapri, factor: number): PoseCapri {
  const f = Math.max(0, Math.min(1, factor));
  return {
    cuerpoY: lerp(actual.cuerpoY, objetivo.cuerpoY, f),
    cuerpoRotZ: lerp(actual.cuerpoRotZ, objetivo.cuerpoRotZ, f),
    cuerpoRotX: lerp(actual.cuerpoRotX, objetivo.cuerpoRotX, f),
    cabezaRotX: lerp(actual.cabezaRotX, objetivo.cabezaRotX, f),
    cabezaRotY: lerp(actual.cabezaRotY, objetivo.cabezaRotY, f),
    cabezaRotZ: lerp(actual.cabezaRotZ, objetivo.cabezaRotZ, f),
    brazoIzqRotZ: lerp(actual.brazoIzqRotZ, objetivo.brazoIzqRotZ, f),
    brazoIzqRotX: lerp(actual.brazoIzqRotX, objetivo.brazoIzqRotX, f),
    brazoDerRotZ: lerp(actual.brazoDerRotZ, objetivo.brazoDerRotZ, f),
    brazoDerRotX: lerp(actual.brazoDerRotX, objetivo.brazoDerRotX, f),
    parpadoSuperior: lerp(actual.parpadoSuperior, objetivo.parpadoSuperior, f),
    bocaApertura: lerp(actual.bocaApertura, objetivo.bocaApertura, f),
    escalaPensar: lerp(actual.escalaPensar, objetivo.escalaPensar, f),
    escalaBrillo: lerp(actual.escalaBrillo, objetivo.escalaBrillo, f),
    reboteY: lerp(actual.reboteY, objetivo.reboteY, f),
  };
}

export interface ControlParpadeo {
  tiempoUltimoParpadeo: number;
  intervaloActual: number;
  duracionParpadeo: number;
}

export function crearControlParpadeo(tiempoInicial = 0): ControlParpadeo {
  return {
    tiempoUltimoParpadeo: tiempoInicial,
    intervaloActual: 3.5, // segundos
    duracionParpadeo: 0.16, // duración de un parpadeo
  };
}

/**
 * Calcula el valor del parpadeo (0 = abierto, 1 = cerrado) según el tiempo transcurrido.
 * Si se cumple el intervalo, activa el parpadeo y programa el siguiente de forma aleatoria (entre 2.5 y 6 s).
 */
export function calcularParpadeo(
  tiempoActual: number,
  control: ControlParpadeo,
  generadorAleatorio: () => number = Math.random
): number {
  const tiempoDesdeUltimo = tiempoActual - control.tiempoUltimoParpadeo;

  if (tiempoDesdeUltimo >= control.intervaloActual) {
    const tiempoEnParpadeo = tiempoDesdeUltimo - control.intervaloActual;
    if (tiempoEnParpadeo <= control.duracionParpadeo) {
      // Curva suave de cierre y apertura: sube a 1 y baja a 0
      const mitad = control.duracionParpadeo / 2;
      if (tiempoEnParpadeo < mitad) {
        return tiempoEnParpadeo / mitad;
      }
      return 1 - (tiempoEnParpadeo - mitad) / mitad;
    }
    // Reinicia el ciclo para el siguiente parpadeo aleatorio
    control.tiempoUltimoParpadeo = tiempoActual;
    control.intervaloActual = 2.5 + generadorAleatorio() * 3.5;
    return 0;
  }

  return 0;
}
