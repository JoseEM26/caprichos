/**
 * Director de cámara de «Seguir a Capri». Funciones puras (sin three): deciden QUÉ se encuadra y DESDE DÓNDE.
 * Estados: SIGUIENDO (va delante de Capri, algo al costado), EN_MESA (Capri y los clientes de la mesa),
 * EN_COCINA (Capri y la cocina) y PANORAMA (todo el local cuando Capri no hace nada).
 * Los tiempos mínimos evitan que la cámara salte entre estados. Coordenadas del mundo (el plano queda centrado en 0,0).
 */
export type EstadoCamara = 'SIGUIENDO' | 'EN_MESA' | 'EN_COCINA' | 'PANORAMA';

/** Con «Seguir a Capri» la cámara es automática: el usuario no gira, no hace zoom ni arrastra. */
export const puedeInteractuar = (vista: string): boolean => vista !== 'capri';

export interface V2 { x: number; z: number }
export type V3 = [number, number, number];
export interface Pose { pos: V3; obj: V3 }

/** Segundos mínimos que se mantiene cada estado antes de poder cambiar. */
export const MIN_ESTADO: Record<EstadoCamara, number> = { SIGUIENDO: 1.5, EN_MESA: 2.5, EN_COCINA: 2.5, PANORAMA: 2.5 };
/** Capri quieta y sin tarea durante tanto tiempo = vista amplia. */
export const ESPERA_PANORAMA = 3;
/** Constante de tiempo del suavizado (s): ~1-2 s para asentarse en la nueva pose. */
export const TAU_CAMARA = 0.45;

export interface Foco {
  caminando: boolean;
  /** Tiene una tarea (llevar, tomar el pedido, limpiar, pasear...) */
  ocupada: boolean;
  /** Dónde está parada (si está cerca de una mesa con clientes o del despacho) */
  cerca: 'mesa' | 'cocina' | null;
  /** Hacia dónde camina para su tarea */
  rumbo: 'mesa' | 'cocina' | null;
  /** Segundos sin caminar ni tener tarea */
  quietoS: number;
}

export interface EstadoDirector { estado: EstadoCamara; desde: number }

function candidato(f: Foco, actual: EstadoCamara): EstadoCamara {
  if (f.caminando) return f.rumbo === 'cocina' ? 'EN_COCINA' : 'SIGUIENDO';
  if (!f.ocupada && f.quietoS >= ESPERA_PANORAMA) return 'PANORAMA';
  if (f.cerca === 'mesa') return 'EN_MESA';
  if (f.cerca === 'cocina') return 'EN_COCINA';
  if (f.ocupada) return 'SIGUIENDO';
  return actual; // quieta hace poco, sin nada cerca: no se mueve nada todavía
}

/** Siguiente estado: solo cambia si el actual ya cumplió su tiempo mínimo. */
export function siguienteEstado(prev: EstadoDirector, f: Foco, t: number): EstadoDirector {
  const c = candidato(f, prev.estado);
  if (c === prev.estado || t - prev.desde < MIN_ESTADO[prev.estado]) return prev;
  return { estado: c, desde: t };
}

/** Distancia a la que hay que ponerse para que un círculo de ese radio entre en cuadro (fov vertical en grados). */
export function distanciaParaEncuadrar(radio: number, fovGrados: number, aspecto: number): number {
  const v = (fovGrados * Math.PI) / 360;
  const h = Math.atan(Math.tan(v) * Math.max(0.3, aspecto));
  return radio / Math.tan(Math.min(v, h));
}

/** Suavizado exponencial independiente de los cuadros por segundo. */
export const factorSuave = (dt: number, tau = TAU_CAMARA) => 1 - Math.exp(-Math.max(0, dt) / tau);

/** Acerca el ángulo `a` al ángulo `b` por el camino corto (k de 0 a 1). */
export function suavizarAngulo(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

export interface Mundo {
  ancho: number;
  alto: number;
  /** ¿Se puede poner la cámara aquí (dentro del local, sin pared ni mueble)? */
  libre: (x: number, z: number) => boolean;
  fov: number;
  aspecto: number;
  general: Pose;
}

const dentro = (m: Mundo, x: number, z: number) => Math.abs(x) <= m.ancho / 2 - 0.4 && Math.abs(z) <= m.alto / 2 - 0.4;
const ok = (m: Mundo, x: number, z: number) => dentro(m, x, z) && m.libre(x, z);

/**
 * Cámara de frente a Capri: delante de ella (hacia donde mira), un poco al costado y arriba, mirando su cara.
 * Si delante hay pared o mueble, se acerca; si aun así no cabe, pasa al otro costado y por último detrás.
 */
export function poseSiguiendo(capri: V2, rumbo: number, m: Mundo): Pose {
  const fx = Math.sin(rumbo), fz = Math.cos(rumbo), rx = fz, rz = -fx;
  const obj: V3 = [capri.x, 1.0, capri.z];
  for (const d of [3.3, 2.8, 2.2, 1.6, 1.1]) {
    for (const lado of [1, -1]) {
      const x = capri.x + fx * d + rx * lado * 1.0, z = capri.z + fz * d + rz * lado * 1.0;
      if (ok(m, x, z)) return { pos: [x, 1.75, z], obj };
    }
  }
  for (const d of [2.4, 1.6, 1.0]) {
    const x = capri.x - fx * d, z = capri.z - fz * d;
    if (ok(m, x, z)) return { pos: [x, 1.9, z], obj };
  }
  return { pos: [capri.x + 0.01, 3.4, capri.z + 0.01], obj };
}

/**
 * Capri y los clientes de la mesa en cuadro: la cámara se pone de costado (se ven las caras), lo bastante lejos
 * para que entren todos y arriba para pasar por encima de los muebles. `desde` (la cámara ahora) desempata hacia
 * el lado más cercano, para no dar la vuelta entera.
 */
export function poseMesa(capri: V2, mesa: V2, personas: V2[], m: Mundo, desde?: V2): Pose {
  const puntos = [capri, ...personas, mesa];
  const c = { x: puntos.reduce((s, p) => s + p.x, 0) / puntos.length, z: puntos.reduce((s, p) => s + p.z, 0) / puntos.length };
  const radio = Math.max(1.3, ...puntos.map((p) => Math.hypot(p.x - c.x, p.z - c.z))) + 0.7;
  const dist = Math.min(7.5, Math.max(3.4, distanciaParaEncuadrar(radio, m.fov, m.aspecto) * 0.95));
  const aCapri = Math.atan2(capri.x - mesa.x, capri.z - mesa.z);
  const angulos = [aCapri + Math.PI / 2, aCapri - Math.PI / 2, aCapri + Math.PI * 0.75, aCapri - Math.PI * 0.75, aCapri + Math.PI, aCapri];
  if (desde) {
    const lado = (a: number) => Math.hypot(c.x + Math.sin(a) * dist - desde.x, c.z + Math.cos(a) * dist - desde.z);
    if (lado(angulos[1]) < lado(angulos[0])) [angulos[0], angulos[1]] = [angulos[1], angulos[0]];
  }
  const obj: V3 = [c.x, 0.95, c.z];
  for (const k of [1, 0.85, 0.7, 0.55]) {
    for (const a of angulos) {
      const x = c.x + Math.sin(a) * dist * k, z = c.z + Math.cos(a) * dist * k;
      if (ok(m, x, z)) return { pos: [x, 2.1 + 0.5 * k, z], obj };
    }
  }
  return { pos: [c.x + 0.01, 4.2, c.z + 0.01], obj };
}

/** Capri entrando a la cocina: se encuadran ella y el centro de la cocina, desde el lado del salón. */
export function poseCocina(capri: V2, cocina: V2, m: Mundo): Pose {
  const c = { x: (capri.x + cocina.x) / 2, z: (capri.z + cocina.z) / 2 };
  const radio = Math.max(2.2, Math.hypot(capri.x - cocina.x, capri.z - cocina.z) / 2 + 1.6);
  const dist = Math.min(9, Math.max(4.2, distanciaParaEncuadrar(radio, m.fov, m.aspecto) * 0.9));
  const obj: V3 = [c.x, 0.9, c.z];
  for (const k of [1, 0.8, 0.6]) {
    for (const [dx, dz] of [[0, 1], [0.7, 0.7], [-0.7, 0.7], [1, 0], [-1, 0]] as const) {
      const x = c.x + dx * dist * k, z = c.z + dz * dist * k;
      if (ok(m, x, z)) return { pos: [x, 2.6 + 0.8 * k, z], obj };
    }
  }
  return { pos: [c.x, 6, c.z + 5], obj };
}

export interface EntradaPose {
  estado: EstadoCamara;
  capri: V2;
  rumbo: number;
  mesa?: { centro: V2; personas: V2[] } | null;
  cocina: V2;
  camaraActual?: V2;
}

/** La pose de cámara que corresponde al estado. */
export function poseDeEstado(e: EntradaPose, m: Mundo): Pose {
  if (e.estado === 'PANORAMA') return m.general;
  if (e.estado === 'EN_MESA' && e.mesa) return poseMesa(e.capri, e.mesa.centro, e.mesa.personas, m, e.camaraActual);
  if (e.estado === 'EN_COCINA') return poseCocina(e.capri, e.cocina, m);
  return poseSiguiendo(e.capri, e.rumbo, m);
}
