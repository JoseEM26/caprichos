/**
 * Timbre de Cocina (WebAudio, sin archivos). Distinto y más fuerte que el de notificaciones del admin
 * (`useNotificaciones`) y que el de Caja (`pedidos/audioAlerta`). Solo lo usan las vistas de Cocina.
 *
 *  - NUEVO:   Do6 -> Mi6 -> Sol6, onda cuadrada, ~1.2 s (la última nota se sostiene).
 *  - EXTRA / DEVUELTO: La5 -> Re6, ~0.5 s, para distinguirlo de un pedido nuevo.
 * Cada nota suena sola (sin solaparse) y su pico nunca pasa de 0.8: no hay recorte (clipping).
 */
export type Volumen = 'bajo' | 'medio' | 'alto' | 'maximo';
export type PatronTimbre = 'NUEVO' | 'EXTRA' | 'DEVUELTO';

export const VOLUMENES: Array<{ valor: Volumen; etiqueta: string; pico: number }> = [
  { valor: 'bajo', etiqueta: 'Bajo', pico: 0.15 },
  { valor: 'medio', etiqueta: 'Medio', pico: 0.3 },
  { valor: 'alto', etiqueta: 'Alto', pico: 0.5 },
  { valor: 'maximo', etiqueta: 'Máximo', pico: 0.8 },
];
const CLAVE_VOLUMEN = 'caprichos_cocina_volumen';

/** Notas: [frecuencia Hz, inicio s, duración s]. */
const PATRON_NUEVO: Array<[number, number, number]> = [
  [1046.5, 0, 0.28],
  [1318.5, 0.3, 0.28],
  [1568, 0.6, 0.6],
];
const PATRON_CORTO: Array<[number, number, number]> = [
  [880, 0, 0.2],
  [1174.7, 0.25, 0.25],
];
export const DURACION_NUEVO_S = 1.2;
export const DURACION_CORTO_S = 0.5;

export function leerVolumen(): Volumen {
  try {
    const v = localStorage.getItem(CLAVE_VOLUMEN);
    if (VOLUMENES.some((x) => x.valor === v)) return v as Volumen;
  } catch {
    // sin almacenamiento: queda el predeterminado
  }
  return 'alto';
}

export function guardarVolumen(v: Volumen): void {
  try {
    localStorage.setItem(CLAVE_VOLUMEN, v);
  } catch {
    // el volumen vale en esta sesión aunque no se pueda guardar
  }
}

// ---- AudioContext compartido -------------------------------------------------------------

let ctx: AudioContext | null = null;

function claseAudio(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as any).webkitAudioContext || null;
}

function obtenerCtx(): AudioContext | null {
  if (ctx) return ctx;
  const C = claseAudio();
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Solo para pruebas: olvida el contexto compartido. */
export function reiniciarAudioCocina(): void {
  ctx = null;
}

/** 'sin-soporte' | 'bloqueado' (el navegador exige un toque) | 'listo'. */
export function estadoAudioCocina(): 'sin-soporte' | 'bloqueado' | 'listo' {
  if (!claseAudio()) return 'sin-soporte';
  return ctx && ctx.state === 'running' ? 'listo' : 'bloqueado';
}

/** Debe llamarse dentro de un gesto del usuario (toque/tecla): crea y reanuda el contexto. */
export async function activarAudioCocina(): Promise<boolean> {
  const c = obtenerCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
  } catch {
    return false;
  }
  return c.state === 'running';
}

function programar(c: AudioContext, patron: PatronTimbre, pico: number): void {
  const notas = patron === 'NUEVO' ? PATRON_NUEVO : PATRON_CORTO;
  const t0 = c.currentTime + 0.02;
  for (const [freq, inicio, dur] of notas) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t0 + inicio);
    gain.gain.setValueAtTime(0.0001, t0 + inicio);
    gain.gain.linearRampToValueAtTime(pico, t0 + inicio + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + inicio + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0 + inicio);
    osc.stop(t0 + inicio + dur + 0.02);
  }
}

/**
 * Hace sonar el timbre. `volumen` por defecto es el guardado. Devuelve false si el navegador lo tiene bloqueado
 * (aún no hubo un toque) o no hay WebAudio; el aviso visual sigue funcionando.
 */
export async function tocarTimbreCocina(patron: PatronTimbre, volumen: Volumen = leerVolumen()): Promise<boolean> {
  const c = obtenerCtx();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
    if (c.state !== 'running') return false;
    const pico = VOLUMENES.find((v) => v.valor === volumen)?.pico ?? 0.5;
    programar(c, patron, pico);
    return true;
  } catch {
    return false;
  }
}

// ---- Dedupe y filtro por área ------------------------------------------------------------

/** Devuelve una función que dice si la clave es nueva dentro de la ventana (por defecto 10 s). */
export function crearDedupe(ventanaMs = 10_000, ahora: () => number = Date.now) {
  const vistos = new Map<string, number>();
  return (clave: string): boolean => {
    const t = ahora();
    for (const [k, v] of vistos) if (t - v > ventanaMs) vistos.delete(k);
    if (vistos.has(clave)) return false;
    vistos.set(clave, t);
    return true;
  };
}

export interface IngresoCocina {
  pedidoId: number | string;
  codigo: string;
  areaId: number | string;
  areaNombre: string;
  cliente?: string | null;
  tipo: PatronTimbre;
}

/** Una pantalla de área solo avisa de su área; «Todas» ('') avisa de cualquiera. */
export function debeAvisar(ev: Pick<IngresoCocina, 'areaId'>, areaSeleccionada: string): boolean {
  return areaSeleccionada === '' || String(ev.areaId) === String(areaSeleccionada);
}
