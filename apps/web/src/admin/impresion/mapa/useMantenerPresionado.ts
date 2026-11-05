import { useCallback, useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';

export const MS_PRESION_LARGA = 3000;
export const TOLERANCIA_PRESION_PX = 8;

/** Controles que ya tienen su propia acción: presionarlos no abre el detalle ni inicia nada. */
const INTERACTIVOS = 'button, select, input, textarea, label, a';

/**
 * Presión larga (ratón o táctil) sobre un nodo: tras `ms` sin soltar ni moverse más de
 * `TOLERANCIA_PRESION_PX`, llama a `alCompletar`. Soltar, salir del nodo o cancelar lo corta.
 * `progreso` va de 0 a 1 para dibujar el anillo.
 */
export function useMantenerPresionado(alCompletar: () => void, ms: number = MS_PRESION_LARGA) {
  const [progreso, setProgreso] = useState(0);
  const [activa, setActiva] = useState(false);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuenta = useRef<ReturnType<typeof setInterval> | null>(null);
  const completada = useRef(false);
  const alCompletarRef = useRef(alCompletar);

  useEffect(() => {
    alCompletarRef.current = alCompletar;
  });

  const cancelar = useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    if (cuenta.current) clearInterval(cuenta.current);
    reloj.current = null;
    cuenta.current = null;
    origen.current = null;
    setActiva(false);
    setProgreso(0);
  }, []);

  useEffect(() => cancelar, [cancelar]);

  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as Element).closest?.(INTERACTIVOS)) return;
    cancelar();
    completada.current = false;
    origen.current = { x: e.clientX, y: e.clientY };
    setActiva(true);
    const inicio = Date.now();
    cuenta.current = setInterval(() => setProgreso(Math.min(1, (Date.now() - inicio) / ms)), 100);
    reloj.current = setTimeout(() => {
      completada.current = true;
      cancelar();
      alCompletarRef.current();
    }, ms);
  };

  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const o = origen.current;
    if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > TOLERANCIA_PRESION_PX) cancelar();
  };

  // Al completar (o durante la presión) el menú contextual del celular no debe aparecer.
  const onContextMenu = (e: RMouseEvent<HTMLElement>) => {
    if (origen.current || completada.current) e.preventDefault();
  };

  return {
    progreso,
    activa,
    gestos: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancelar,
      onPointerLeave: cancelar,
      onPointerCancel: cancelar,
      onContextMenu,
    },
  };
}
