import { useEffect, useState } from 'react';
import type { AlcanceSonido, NotificacionPendiente } from './notificacionesTipos';

/** Cada cuánto suena mientras haya avisos sin leer de prioridad alta o media (por defecto; lo ajusta el ADMIN) */
export const CADA_SONIDO_MS = 15000;

const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

let contexto: AudioContext | null = null;

const constructorAudio = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
};

/** Solo para pruebas: olvida el contexto de audio entre casos. */
export function reiniciarSonidoParaPruebas(): void {
  contexto = null;
}

/** true si el navegador sabe reproducir audio con Web Audio */
export function sonidoSoportado(): boolean {
  return constructorAudio() !== null;
}

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Ctor = constructorAudio();
  if (!Ctor) return null;
  try {
    contexto = new Ctor();
  } catch {
    contexto = null;
  }
  return contexto;
}

/**
 * Reanuda el audio. Los navegadores lo bloquean hasta un gesto del usuario:
 * esta función debe llamarse desde un clic, una tecla o un toque. Devuelve true si ya puede sonar.
 */
export async function activarSonido(): Promise<boolean> {
  const ctx = obtenerContexto();
  if (!ctx) return false;
  try {
    if (ctx.state !== 'running') await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state === 'running';
}

/** Un aviso corto: dos tonos suaves generados en el momento, sin archivos. false si aún está bloqueado. */
export function reproducirAviso(): boolean {
  const ctx = obtenerContexto();
  if (!ctx || ctx.state !== 'running') return false;
  const ahora = ctx.currentTime;
  [0, 0.22].forEach((desfase, i) => {
    const inicio = ahora + desfase;
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 0 ? 880 : 1175, inicio);
    ganancia.gain.setValueAtTime(0.0001, inicio);
    ganancia.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.2);
  });
  return true;
}

/**
 * Según el alcance que eligió el ADMIN, ¿este aviso sin leer hace sonar?
 * TODOS_NO_LEIDOS: todo lo no leído salvo prioridad BAJA. SOLO_URGENTES: solo ALTA.
 * SOLO_HOY: lo no leído creado hoy (hora Lima), salvo BAJA; un aviso sin fecha (siempre pendiente) cuenta como hoy.
 */
export function cuentaParaSonar(n: NotificacionPendiente, alcance: AlcanceSonido, ahora: Date = new Date()): boolean {
  if (n.leida) return false;
  if (alcance === 'SOLO_URGENTES') return n.prioridad === 'ALTA';
  if (n.prioridad === 'BAJA') return false;
  if (alcance === 'SOLO_HOY') return n.desde === null || diaLima(new Date(n.desde)) === diaLima(ahora);
  return true;
}

/** Suena mientras haya algún aviso sin leer que cuente según el alcance (por defecto, todo salvo BAJA). */
export function hayQueSonar(
  notificaciones: NotificacionPendiente[],
  alcance: AlcanceSonido = 'TODOS_NO_LEIDOS',
  ahora: Date = new Date(),
): boolean {
  return notificaciones.some((n) => cuentaParaSonar(n, alcance, ahora));
}

/**
 * Sonido de los avisos: si `activo`, suena al momento y luego cada CADA_SONIDO_MS; al pasar a false, se calla.
 * Si el navegador bloquea el audio, `bloqueado` queda en true hasta que el usuario active el sonido.
 */
export function useSonidoAvisos(
  activo: boolean,
  intervaloMs: number = CADA_SONIDO_MS,
): {
  soportado: boolean;
  bloqueado: boolean;
  activar: () => Promise<boolean>;
} {
  const [soportado] = useState(sonidoSoportado);
  const [bloqueado, setBloqueado] = useState(true);

  // Al montar: si ya se puede sonar, se quita el bloqueo; si no, el primer gesto del usuario lo intenta
  useEffect(() => {
    if (!soportado) return;
    const ctx = obtenerContexto();
    setBloqueado(!(ctx && ctx.state === 'running'));

    const alGesto = async () => {
      const ok = await activarSonido();
      setBloqueado(!ok);
      if (ok) {
        window.removeEventListener('pointerdown', alGesto);
        window.removeEventListener('keydown', alGesto);
      }
    };
    window.addEventListener('pointerdown', alGesto);
    window.addEventListener('keydown', alGesto);
    return () => {
      window.removeEventListener('pointerdown', alGesto);
      window.removeEventListener('keydown', alGesto);
    };
  }, [soportado]);

  useEffect(() => {
    if (!activo || !soportado) return;
    const sonar = () => {
      if (!reproducirAviso()) setBloqueado(true);
    };
    sonar();
    const cada = setInterval(sonar, intervaloMs);
    return () => clearInterval(cada);
  }, [activo, soportado, intervaloMs]);

  const activar = async (): Promise<boolean> => {
    const ok = await activarSonido();
    setBloqueado(!ok);
    return ok;
  };

  return { soportado, bloqueado, activar };
}
