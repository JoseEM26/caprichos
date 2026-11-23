import { useEffect, useRef, useState } from 'react';

const CLAVE_SONIDO = 'caprichos.mensajes.sonido';

/** Preferencia del interruptor 🔔 (apagada solo si se guardó «0»); nunca rompe si el navegador bloquea el almacenamiento. */
export function leerSonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_SONIDO) !== '0';
  } catch {
    return true;
  }
}

export function useSonidoAviso(): [boolean, () => void] {
  const [activo, setActivo] = useState(leerSonidoActivo);
  const alternar = () => {
    const nuevo = !activo;
    try {
      localStorage.setItem(CLAVE_SONIDO, nuevo ? '1' : '0');
    } catch {
      /* sin almacenamiento: vale solo en esta sesión */
    }
    setActivo(nuevo);
  };
  return [activo, alternar];
}

/** Pitido corto de aviso. Si el navegador bloquea el audio (sin gesto previo) o no existe, no pasa nada. */
export function pitar(): void {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.frequency.value = 880;
    ganancia.gain.setValueAtTime(0.08, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(ganancia).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close().catch(() => undefined);
  } catch {
    /* audio bloqueado: se ignora */
  }
}

export function tituloConNoLeidos(n: number, base = 'Mensajes · Caprichos'): string {
  return n > 0 ? `(${n}) ${base}` : base;
}

/** Título de la pestaña con el número por responder; al salir del módulo vuelve el título anterior. Suena si el número sube. */
export function useAvisoMensajeNuevo(n: number, sonido: boolean): void {
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    const antes = document.title.replace(/^\(\d+\)\s*/, '');
    // si la página no se llama «Mensajes…» (p. ej. el título genérico del panel), se usa el propio del módulo
    document.title = tituloConNoLeidos(n, /mensajes/i.test(antes) ? antes : undefined);
    return () => {
      document.title = antes;
    };
  }, [n]);
  useEffect(() => {
    if (anterior.current !== null && n > anterior.current && sonido) pitar();
    anterior.current = n;
  }, [n, sonido]);
}
