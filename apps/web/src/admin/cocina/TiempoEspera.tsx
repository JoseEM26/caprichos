import type { CSSProperties } from 'react';
import type { ColorComanda, UmbralesCocina } from './cocinaTipos';
import { useTiempoEnVivo } from './tiempoEnVivo';

const FONDO_ADMIN: Record<ColorComanda, { bg: string; fg: string }> = {
  VERDE: { bg: 'var(--cp-line)', fg: 'var(--cp-navy)' },
  NARANJA: { bg: 'var(--cp-orange)', fg: 'var(--cp-navy)' },
  ROJO: { bg: 'var(--cp-rust)', fg: 'var(--cp-white)' },
};

/** Colores de las pantallas de TV (fondo oscuro): el mismo significado verde/ámbar/rojo. */
export const COLOR_TV: Record<ColorComanda, string> = {
  VERDE: '#2C7FA3',
  NARANJA: '#C98A1B',
  ROJO: '#C73E2A',
};

export interface TiempoEsperaProps {
  /** Hora de llegada del pedido a cocina (ISO). */
  desde?: string | null;
  /** Minutos que trajo el servidor: respaldo si no hay hora. */
  minutosRespaldo?: number;
  umbrales?: UmbralesCocina;
  /** Pastilla (admin) o texto de color grande (TV). */
  variante?: 'admin' | 'tv';
  style?: CSSProperties;
}

/**
 * Tiempo de espera en vivo de una comanda: mm:ss que se actualiza con el temporizador compartido,
 * color por umbral y la etiqueta «En tiempo», «Atención» o «Urgente» (no depende solo del color).
 */
export function TiempoEspera({
  desde,
  minutosRespaldo = 0,
  umbrales,
  variante = 'admin',
  style,
}: TiempoEsperaProps) {
  const t = useTiempoEnVivo(desde, minutosRespaldo, umbrales);

  if (variante === 'tv') {
    return (
      <span
        data-testid="indicador-tiempo"
        data-color={t.color}
        style={{ fontWeight: 800, fontSize: '26px', color: COLOR_TV[t.color], ...style }}
      >
        {t.texto} <span style={{ fontSize: '16px' }}>· {t.etiqueta}</span>
      </span>
    );
  }

  const f = FONDO_ADMIN[t.color];
  return (
    <span
      data-testid="indicador-tiempo"
      data-color={t.color}
      style={{
        fontSize: '12px',
        fontWeight: 800,
        borderRadius: '9999px',
        padding: '2px 10px',
        background: f.bg,
        color: f.fg,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {t.texto} · {t.etiqueta}
    </span>
  );
}

/** Insignia grande del número del día («#7»). Sin número (pedido anterior) no muestra nada. */
export function NumeroDia({ numero }: { numero?: number | null }) {
  if (numero === null || numero === undefined) return null;
  return (
    <span
      data-testid="numero-dia"
      title="Número del día en cocina (referencial)"
      style={{
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 900,
        fontSize: '20px',
        lineHeight: '24px',
        borderRadius: '10px',
        padding: '2px 10px',
        background: 'var(--cp-navy)',
        color: 'var(--cp-cream, #FBF4EC)',
        flexShrink: 0,
      }}
    >
      #{numero}
    </span>
  );
}
