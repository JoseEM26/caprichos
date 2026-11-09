import { useEffect, useRef } from 'react';

interface CentinelaMasProps {
  hayMas: boolean;
  cargando: boolean;
  error?: boolean;
  /** Pide la siguiente tanda. El padre evita los pedidos duplicados; aquí solo se avisa si no hay uno en curso. */
  onCargar: () => void;
  textoFin?: string;
}

/**
 * Final de una lista que crece al bajar: un centinela que, al asomar en pantalla, pide más
 * (IntersectionObserver) y un botón «Cargar más» de respaldo (sin observer, error o teclado).
 */
export function CentinelaMas({ hayMas, cargando, error = false, onCargar, textoFin = 'No hay más notificaciones' }: CentinelaMasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const alCargar = useRef(onCargar);
  alCargar.current = onCargar;
  const ocupado = useRef(cargando);
  ocupado.current = cargando;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hayMas || error || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting) && !ocupado.current) alCargar.current();
      },
      { rootMargin: '120px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // `cargando` en las dependencias: tras cada tanda se vuelve a observar, así sigue cargando si el final aún se ve
  }, [hayMas, error, cargando]);

  const boton = { minHeight: 44, padding: '0 18px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13 } as const;

  return (
    <div ref={ref} aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 13, color: 'var(--cp-soft)' }}>
      {cargando && <span role="status">Cargando más…</span>}
      {error && !cargando && <span role="alert">No se pudieron cargar más notificaciones.</span>}
      {hayMas && !cargando && (
        <button type="button" onClick={onCargar} style={boton}>
          {error ? 'Reintentar' : 'Cargar más'}
        </button>
      )}
      {!hayMas && <span>{textoFin}</span>}
    </div>
  );
}
