import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

/** Debe coincidir con la duración de la animación `dst-presion` (destacadas.css). */
export const MS_PULSACION_LARGA = 650;

/**
 * Pulsación larga táctil y de ratón. Devuelve las props para esparcir en el elemento:
 * - dispara `alPulsar` tras `ms` con el dedo quieto (vibra 10 ms si el aparato puede);
 * - se cancela si el dedo se mueve más de `tolerancia` px (para no romper el scroll) o se suelta antes;
 * - tras dispararse, se traga el clic siguiente (no hay «toque corto» doble) y el menú del navegador;
 * - el clic derecho abre lo mismo que la pulsación larga;
 * - `data-presionando="true"` mientras se mantiene, para animar.
 */
export function usePulsacionLarga(
  alPulsar: () => void,
  { ms = MS_PULSACION_LARGA, tolerancia = 10 }: { ms?: number; tolerancia?: number } = {},
) {
  const temporizador = useRef<number | null>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const disparada = useRef(false);
  const abajo = useRef(false);
  const alPulsarRef = useRef(alPulsar);
  alPulsarRef.current = alPulsar;
  const [presionando, setPresionando] = useState(false);

  const cancelar = useCallback(() => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
    origen.current = null;
    setPresionando(false);
  }, []);
  useEffect(() => cancelar, [cancelar]);

  const olvidarLuego = () => {
    window.setTimeout(() => {
      disparada.current = false;
    }, 300);
  };

  const abrir = () => {
    if (disparada.current) return;
    disparada.current = true;
    cancelar();
    navigator.vibrate?.(10);
    alPulsarRef.current();
  };

  return {
    onPointerDown(e: PointerEvent) {
      disparada.current = false;
      abajo.current = true;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      cancelar();
      origen.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
      setPresionando(true);
      temporizador.current = window.setTimeout(abrir, ms);
    },
    onPointerMove(e: PointerEvent) {
      const o = origen.current;
      if (o && Math.hypot((e.clientX ?? 0) - o.x, (e.clientY ?? 0) - o.y) > tolerancia) cancelar();
    },
    onPointerUp() {
      abajo.current = false;
      cancelar();
      if (disparada.current) olvidarLuego();
    },
    onPointerCancel: cancelar,
    onPointerLeave: cancelar,
    onContextMenu(e: MouseEvent) {
      e.preventDefault();
      abrir();
      if (!abajo.current) olvidarLuego();
    },
    onClickCapture(e: MouseEvent) {
      if (!disparada.current) return;
      e.preventDefault();
      e.stopPropagation();
      disparada.current = false;
    },
    'data-presionando': presionando ? 'true' : undefined,
  };
}
