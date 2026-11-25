import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api } from '../comun/api';
import { gridColumnas, resolverDisposicion } from './disposicion';
import { DecoracionAnimada } from './contenido/DecoracionAnimada';
import { useEsMovil } from './useEsMovil';
import type { ContenidoCarta } from './CartaPublica';
import type { OfertaItem } from '../admin/ofertas/ofertasApi';

// El administrativo guarda la paleta por rol; la carta la lee con sus variables --cp-*
export const VAR_PALETA: Record<string, string> = {
  accent: '--cp-orange', ink: '--cp-navy', bg: '--cp-cream', card: '--cp-white',
  price: '--cp-rust', sec: '--cp-gold', soft: '--cp-soft', line: '--cp-line',
};

export const ZOOM_CELULAR = 0.82;

/** Categorías cuyos productos se piden por vaso (nombre por vaso en la ventana del producto). */
export const esCategoriaBebida = (nombre?: string | null): boolean =>
  ['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES'].includes((nombre ?? '').toUpperCase());

/** Variables --cp-* de la paleta del diseñador (nada si la decoración es «Ninguno»). */
export function estilosPaleta(contenido: ContenidoCarta | null): Record<string, string> {
  const o: Record<string, string> = {};
  (contenido && contenido.decoracion.toUpperCase() !== 'NINGUNO' ? Object.entries(contenido.paleta ?? {}) : []).forEach(([k, v]) => {
    if (VAR_PALETA[k] && v) o[VAR_PALETA[k]] = v;
  });
  return o;
}

/** Estilo de la raíz de la carta: la carta pública y las vistas previas del admin usan EXACTAMENTE este. */
export function estiloRaizCarta(contenido: ContenidoCarta | null, movil: boolean, minHeight?: string): CSSProperties {
  return {
    // el mockup en celular maqueta a 476 px y reduce al 82 %: todo se ve más pequeño y cabe más
    zoom: movil ? ZOOM_CELULAR : 1,
    minHeight,
    backgroundColor: 'var(--cp-cream)',
    color: 'var(--cp-navy)',
    display: 'flex',
    flexDirection: 'column',
    ...(estilosPaleta(contenido) as CSSProperties),
  };
}

/** Datos públicos que la carta real pide y las vistas previas necesitan para verse igual. */
export function usePublicoCarta(): { contenido: ContenidoCarta | null; ofertas: OfertaItem[] } {
  const [estado, setEstado] = useState<{ contenido: ContenidoCarta | null; ofertas: OfertaItem[] }>({ contenido: null, ofertas: [] });
  useEffect(() => {
    let vivo = true;
    void Promise.all([
      api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
      api.get<OfertaItem[]>('/carta/ofertas').catch(() => []),
    ]).then(([contenido, ofertas]) => {
      if (vivo) setEstado({ contenido, ofertas: Array.isArray(ofertas) ? ofertas : [] });
    });
    return () => { vivo = false; };
  }, []);
  return estado;
}

export interface DatosRaiz {
  contenido: ContenidoCarta | null;
  ofertas: OfertaItem[];
  organizacion: 'SECCIONES' | 'LISTA' | 'TARJETAS';
  rankingDe: (productoId: string) => { puesto?: number; estrellas?: number; textoEstrellas?: string } | undefined;
}

/**
 * Raíz de la carta para las vistas previas del admin: mismo zoom, fondo, colores y paleta que la carta pública.
 * Con `rejilla` envuelve el contenido en la misma columna de la lista (padding y grid de la carta real).
 */
export function RaizCartaPrevia({ children, rejilla }: { children: (d: DatosRaiz) => ReactNode; rejilla?: boolean }) {
  const movil = useEsMovil();
  const { contenido, ofertas } = usePublicoCarta();
  const organizacion = contenido?.organizacion ?? 'SECCIONES';
  const disp = resolverDisposicion(contenido?.disposicion);
  const rankingDe = (id: string) => contenido?.rankingMes?.find((r) => r.productoId === id);
  const dentro = children({ contenido, ofertas, organizacion, rankingDe });
  return (
    <div style={estiloRaizCarta(contenido, movil)}>
      <DecoracionAnimada tema={contenido?.decoracion ?? 'NINGUNO'} />
      {rejilla ? (
        <div style={{ width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: movil ? '8px 16px 48px' : '24px 24px 64px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridColumnas(movil, organizacion, disp.carta.columnasPc), gap: '16px' }}>{dentro}</div>
        </div>
      ) : dentro}
    </div>
  );
}
