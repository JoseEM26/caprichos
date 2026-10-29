import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Envoltorio que marca un ajuste como destino del buscador (`?tab=..&campo=<id>`).
 * `id` debe existir en el catálogo (catalogo/*.ts). Ver catalogo/LEEME.md.
 */
export function CampoConfig({ id, children, className, style }: {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div data-cfg-id={id} tabIndex={-1} className={`cfg-campo ${className || ''}`.trim()} style={style}>
      {children}
    </div>
  );
}

const MS_RESALTADO = 2500;

/** Salta al elemento `[data-cfg-id=campo]` cuando la URL trae `?campo=`. Llamar una vez en la vista de Configuración. */
export function useResaltarCampo(): void {
  const [params, setParams] = useSearchParams();
  const campo = params.get('campo');
  const tab = params.get('tab');

  useEffect(() => {
    if (!campo || !/^[a-z0-9-]+$/.test(campo)) return;
    let intentos = 0;
    let t: ReturnType<typeof setTimeout>;
    const quitarCampo = () =>
      setParams((prev) => { const n = new URLSearchParams(prev); n.delete('campo'); return n; }, { replace: true });

    const intentar = () => {
      const el = document.querySelector<HTMLElement>(`[data-cfg-id="${campo}"]`);
      if (!el) {
        // la pestaña puede estar cargando datos: reintenta ~5 s
        if (++intentos < 40) t = setTimeout(intentar, 125);
        else quitarCampo();
        return;
      }
      let d = el.closest('details');
      while (d) { d.open = true; d = d.parentElement?.closest('details') ?? null; }
      const reducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView?.({ behavior: reducido ? 'auto' : 'smooth', block: 'center' });
      const foco = el.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea') || el;
      foco.focus?.({ preventScroll: true });
      el.classList.add('cfg-resaltado');
      setTimeout(() => el.classList.remove('cfg-resaltado'), MS_RESALTADO);
      quitarCampo();
    };
    t = setTimeout(intentar, 0);
    return () => clearTimeout(t);
    // setParams es estable; se re-dispara si cambia solo `campo` aunque la pestaña sea la misma
  }, [campo, tab]); // eslint-disable-line react-hooks/exhaustive-deps
}
