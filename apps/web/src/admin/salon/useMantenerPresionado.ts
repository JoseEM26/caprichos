import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

export const DURACION_MANTENER_MS = 3000;
const DISTANCIA_CANCELA_PX = 10;
const PASO_PROGRESO_MS = 50;

export interface ManejadoresMantener {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  /** Un toque que completó la pulsación no debe llegar al onClick del elemento. */
  onClickCapture: (e: ReactMouseEvent) => void;
  /** Evita el menú contextual del sistema al mantener presionado en celular. */
  onContextMenu: (e: ReactMouseEvent) => void;
}

interface Inicio {
  x: number;
  y: number;
  t0: number;
}

/**
 * Pulsación prolongada (por defecto 3 s) sobre elementos de una lista.
 * Uso: const m = useMantenerPresionado(alCompletar); y en cada elemento {...m.manejadores(valor)}.
 * Solo sigue una pulsación a la vez: `objetivo` dice cuál se está manteniendo y `progreso` va de 0 a 1.
 * Se cancela si se suelta antes, si el puntero sale del elemento o si se mueve más de ~10 px.
 */
export function useMantenerPresionado<T>(
  alCompletar: (valor: T) => void,
  duracionMs: number = DURACION_MANTENER_MS,
) {
  const [objetivo, setObjetivo] = useState<T | null>(null);
  const [progreso, setProgreso] = useState(0);
  const inicio = useRef<Inicio | null>(null);
  const valorActual = useRef<T | null>(null);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const completado = useRef(false);
  const alCompletarRef = useRef(alCompletar);
  alCompletarRef.current = alCompletar;

  const detener = useCallback(() => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    inicio.current = null;
    valorActual.current = null;
    setObjetivo(null);
    setProgreso(0);
  }, []);

  useEffect(() => () => {
    if (reloj.current) clearInterval(reloj.current);
  }, []);

  const iniciar = (valor: T, e: ReactPointerEvent) => {
    // button undefined: entornos sin PointerEvent completo; 2 = clic derecho, se ignora
    if (e.button !== undefined && e.button !== 0) return;
    detener();
    completado.current = false;
    inicio.current = { x: e.clientX, y: e.clientY, t0: Date.now() };
    valorActual.current = valor;
    setObjetivo(valor);
    reloj.current = setInterval(() => {
      if (!inicio.current) return;
      const p = Math.min(1, (Date.now() - inicio.current.t0) / duracionMs);
      if (p < 1) {
        setProgreso(p);
        return;
      }
      const elegido = valorActual.current as T;
      completado.current = true;
      detener();
      alCompletarRef.current(elegido);
    }, PASO_PROGRESO_MS);
  };

  const manejadores = (valor: T): ManejadoresMantener => ({
    onPointerDown: (e) => iniciar(valor, e),
    onPointerUp: detener,
    onPointerLeave: detener,
    onPointerCancel: detener,
    onPointerMove: (e) => {
      const ini = inicio.current;
      if (!ini) return;
      if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > DISTANCIA_CANCELA_PX) detener();
    },
    onClickCapture: (e) => {
      if (!completado.current) return;
      completado.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    onContextMenu: (e) => e.preventDefault(),
  });

  return { manejadores, objetivo, progreso, activo: objetivo !== null };
}
