import { useCallback, useRef } from 'react';

const OFFSET_LIMA_MS = 5 * 3600_000;
/** La jornada cierra a las 04:00 Lima (igual que jornadaDe() del servidor). */
const CIERRE_MS = 4 * 3600_000;

/** Jornada vigente (AAAA-MM-DD): hasta las 03:59 Lima sigue siendo la del día anterior. */
export const jornadaActual = (ahora: number = Date.now()) =>
  new Date(ahora - OFFSET_LIMA_MS - CIERRE_MS).toISOString().slice(0, 10);

/**
 * Guarda contra respuestas tardías: `const vigente = nueva();` antes de pedir y
 * `if (!vigente()) return;` al responder. Solo la última petición sigue vigente.
 */
export function useUltimaPeticion() {
  const n = useRef(0);
  return useCallback(() => {
    const mia = ++n.current;
    return () => mia === n.current;
  }, []);
}
