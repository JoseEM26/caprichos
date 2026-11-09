import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as PEvent, RefObject } from 'react';

/** Pulsación larga que activa el modo mover (ms). */
export const MS_PULSACION = 450;
/** Si el dedo/mouse se mueve más que esto antes de cumplirse el tiempo, era un scroll: se cancela. */
export const PX_CANCELA = 10;
/** Paso del teclado. */
export const PX_TECLADO = 20;
const MARGEN = 8;
const ANCHO_IMAN = 480;

interface Fraccion {
  x: number;
  y: number;
}
interface Pos {
  left: number;
  top: number;
}

export interface OpcionesArrastrable {
  /** Clave de localStorage (p. ej. `capri.posicion`). */
  clave: string;
  /** Cambia cuando el elemento cambia de tamaño o de versión: se vuelve a medir. */
  dep?: unknown;
}

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function leerGuardado(clave: string): Fraccion | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? 'null');
    if (v && typeof v.x === 'number' && typeof v.y === 'number') {
      return { x: Math.min(1, Math.max(0, v.x)), y: Math.min(1, Math.max(0, v.y)) };
    }
  } catch {
    /* sin almacenamiento o dato roto */
  }
  return null;
}

/** Zonas seguras del dispositivo (notch, barra de gestos). En jsdom da 0. */
function zonaSegura() {
  try {
    const p = document.createElement('div');
    p.style.cssText =
      'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(p);
    const c = getComputedStyle(p);
    const r = { t: num(c.paddingTop), r: num(c.paddingRight), b: num(c.paddingBottom), l: num(c.paddingLeft) };
    p.remove();
    return r;
  } catch {
    return { t: 0, r: 0, b: 0, l: 0 };
  }
}

/**
 * Hace movible un elemento fijo: pulsación larga (mouse, táctil o lápiz) y arrastrar, o tecla M / Alt+flechas.
 * Un toque corto sigue siendo un clic. Recuerda la posición (fracción 0–1) en localStorage.
 */
export function useArrastrable(ref: RefObject<HTMLElement | null>, { clave, dep }: OpcionesArrastrable) {
  const [frac, setFrac] = useState<Fraccion | null>(() => leerGuardado(clave));
  const [pos, setPos] = useState<Pos | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [tick, setTick] = useState(0);

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const previa = useRef<Pos | null>(null); // posición antes de mover (null = esquina por defecto), para Esc
  const suprimirClic = useRef(false);
  const activo = useRef(false);
  const posRef = useRef<Pos | null>(null);
  posRef.current = pos;

  const limites = useCallback(() => {
    const el = ref.current;
    const z = zonaSegura();
    const w = el?.offsetWidth || el?.getBoundingClientRect().width || 0;
    const h = el?.offsetHeight || el?.getBoundingClientRect().height || 0;
    const minL = MARGEN + z.l;
    const minT = MARGEN + z.t;
    const maxL = Math.max(minL, window.innerWidth - w - MARGEN - z.r);
    const maxT = Math.max(minT, window.innerHeight - h - MARGEN - z.b);
    return { minL, minT, maxL, maxT };
  }, [ref]);

  const acotar = useCallback(
    (p: Pos): Pos => {
      const b = limites();
      return { left: Math.min(b.maxL, Math.max(b.minL, p.left)), top: Math.min(b.maxT, Math.max(b.minT, p.top)) };
    },
    [limites],
  );

  const guardar = useCallback(
    (p: Pos) => {
      const b = limites();
      const f = (v: number, a: number, z: number) => (z > a ? Math.min(1, Math.max(0, (v - a) / (z - a))) : 0);
      let fr: Fraccion = { x: f(p.left, b.minL, b.maxL), y: f(p.top, b.minT, b.maxT) };
      let q = p;
      // imán suave al borde más cercano en pantallas angostas
      if (window.innerWidth < ANCHO_IMAN) {
        fr = { ...fr, x: fr.x < 0.5 ? 0 : 1 };
        q = { left: fr.x ? b.maxL : b.minL, top: p.top };
      }
      setPos(q);
      setFrac(fr);
      try {
        localStorage.setItem(clave, JSON.stringify(fr));
      } catch {
        /* sin almacenamiento: queda solo en esta sesión */
      }
    },
    [clave, limites],
  );

  // Fracción → píxeles (al montar, al cambiar el tamaño de ventana o del elemento)
  useLayoutEffect(() => {
    if (!frac || activo.current) return;
    const b = limites();
    const nuevo = acotar({ left: Math.round(b.minL + frac.x * (b.maxL - b.minL)), top: Math.round(b.minT + frac.y * (b.maxT - b.minT)) });
    setPos((a) => (a && a.left === nuevo.left && a.top === nuevo.top ? a : nuevo));
  }, [frac, tick, dep, limites, acotar]);

  useEffect(() => {
    const alCambiar = () => setTick((t) => t + 1);
    window.addEventListener('resize', alCambiar);
    window.addEventListener('orientationchange', alCambiar);
    return () => {
      window.removeEventListener('resize', alCambiar);
      window.removeEventListener('orientationchange', alCambiar);
    };
  }, []);

  const limpiarTemporizador = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  useEffect(() => limpiarTemporizador, []);

  const posActual = (): Pos => {
    if (posRef.current) return posRef.current;
    const r = ref.current?.getBoundingClientRect();
    return { left: r?.left ?? 0, top: r?.top ?? 0 };
  };

  const empezar = () => {
    activo.current = true;
    previa.current = posRef.current;
    setMoviendo(true);
  };
  const terminar = (confirmar: boolean) => {
    if (!activo.current) return;
    activo.current = false;
    inicio.current = null;
    setMoviendo(false);
    if (confirmar) {
      guardar(posActual());
      setAnuncio('Capri movida');
    } else {
      setPos(previa.current);
      setAnuncio('Movimiento cancelado');
    }
  };

  // Mientras se mueve: Esc cancela y la página no se desplaza con el dedo
  useEffect(() => {
    if (!moviendo) return;
    const alTecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        terminar(false);
      }
    };
    const sinScroll = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    window.addEventListener('keydown', alTecla, true);
    window.addEventListener('touchmove', sinScroll, { passive: false });
    return () => {
      window.removeEventListener('keydown', alTecla, true);
      window.removeEventListener('touchmove', sinScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moviendo]);

  const alPresionar = (e: PEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = ref.current?.getBoundingClientRect();
    inicio.current = { x: e.clientX, y: e.clientY, dx: e.clientX - (r?.left ?? 0), dy: e.clientY - (r?.top ?? 0) };
    suprimirClic.current = false;
    limpiarTemporizador();
    const objetivo = e.currentTarget;
    const id = e.pointerId;
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      empezar();
      try {
        navigator.vibrate?.(10);
      } catch {
        /* sin vibración */
      }
      try {
        objetivo.setPointerCapture?.(id);
      } catch {
        /* puntero ya liberado */
      }
      setAnuncio('Modo mover: arrastra y suelta donde quieras');
    }, MS_PULSACION);
  };

  const alMover = (e: PEvent<HTMLElement>) => {
    const s = inicio.current;
    if (!s) return;
    if (!activo.current) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > PX_CANCELA) {
        limpiarTemporizador(); // era un scroll o un arrastre sin pulsación larga
        inicio.current = null;
      }
      return;
    }
    suprimirClic.current = true;
    setPos(acotar({ left: e.clientX - s.dx, top: e.clientY - s.dy }));
  };

  const alSoltar = () => {
    limpiarTemporizador();
    if (activo.current) {
      suprimirClic.current = true;
      terminar(true);
      setTimeout(() => (suprimirClic.current = false), 0);
    }
    inicio.current = null;
  };

  const alCancelar = () => {
    limpiarTemporizador();
    inicio.current = null;
    if (activo.current) terminar(true);
  };

  const mover = (dx: number, dy: number) => {
    const a = posActual();
    const p = acotar({ left: a.left + dx, top: a.top + dy });
    setPos(p);
    return p;
  };

  const alTecla = (e: KeyboardEvent<HTMLElement>) => {
    const flechas: Record<string, [number, number]> = {
      ArrowLeft: [-PX_TECLADO, 0],
      ArrowRight: [PX_TECLADO, 0],
      ArrowUp: [0, -PX_TECLADO],
      ArrowDown: [0, PX_TECLADO],
    };
    const k = e.key;
    if ((k === 'm' || k === 'M') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (activo.current) terminar(true);
      else {
        empezar();
        setAnuncio('Modo mover: usa las flechas, Enter para dejarla aquí, Esc para cancelar');
      }
      return;
    }
    if (flechas[k] && (activo.current || e.altKey)) {
      e.preventDefault();
      const [dx, dy] = flechas[k];
      const p = mover(dx, dy);
      if (!activo.current) {
        guardar(p);
        setAnuncio('Capri movida');
      }
      return;
    }
    if (activo.current && (k === 'Enter' || k === ' ')) {
      e.preventDefault();
      terminar(true);
    }
  };

  /** Úsalo al inicio del onClick: ignora el clic que sigue a un arrastre. Devuelve true si debe seguir. */
  const permitirClic = () => {
    if (suprimirClic.current || activo.current) {
      suprimirClic.current = false;
      return false;
    }
    return true;
  };

  const restaurar = () => {
    setFrac(null);
    setPos(null);
    try {
      localStorage.removeItem(clave);
    } catch {
      /* nada */
    }
    setAnuncio('Capri volvió a la esquina original');
  };

  return {
    /** Props para el botón que se arrastra. */
    props: {
      onPointerDown: alPresionar,
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alCancelar,
      onKeyDown: alTecla,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
    /** Estilo para el contenedor fijo (undefined si nunca se movió: manda el CSS por defecto). */
    estilo: pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : undefined,
    moviendo,
    movida: !!pos,
    /** Mitad de la pantalla en que quedó (el panel se abre hacia el lado contrario). */
    lado: pos && pos.left + (ref.current?.offsetWidth ?? 0) / 2 < window.innerWidth / 2 ? ('izq' as const) : ('der' as const),
    anuncio,
    permitirClic,
    restaurar,
  };
}
