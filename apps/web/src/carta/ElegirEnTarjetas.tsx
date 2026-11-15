import type { ReactNode } from 'react';
import { IconoMedioPago } from '../comun/IconoMedioPago';

/** Una opción grande del checkout (medio de pago o forma de dar la ubicación). */
export interface OpcionTarjeta {
  id: string;
  nombre: string;
  linea: string;
  icono: ReactNode;
  /** Nombre accesible si debe incluir más que el texto visible */
  etiqueta?: string;
  /** Aviso opcional (ahorro, promoción) que se muestra en la tarjeta */
  aviso?: string;
}

interface Props {
  titulo: string;
  opciones: OpcionTarjeta[];
  seleccionado?: string | null;
  deshabilitado?: boolean;
  alElegir: (id: string) => void;
  testId?: string;
}

/** Grilla de 2 columnas con tarjetas grandes (≥ 96 px de alto); sirve a pago y a ubicación. */
export function ElegirEnTarjetas({ titulo, opciones, seleccionado, deshabilitado, alElegir, testId }: Props) {
  return (
    <div role="group" aria-label={titulo} data-testid={testId} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
      {opciones.map((o) => {
        const activa = seleccionado === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={deshabilitado}
            aria-label={o.etiqueta}
            aria-pressed={seleccionado === undefined ? undefined : activa}
            onClick={() => alElegir(o.id)}
            style={{
              minHeight: '112px',
              padding: '12px 8px',
              borderRadius: '14px',
              border: activa ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)',
              backgroundColor: activa ? 'var(--cp-sand)' : 'var(--cp-white)',
              color: 'var(--cp-navy)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              textAlign: 'center',
              cursor: deshabilitado ? 'wait' : 'pointer',
            }}
          >
            <span aria-hidden="true" style={{ display: 'flex', height: '36px', alignItems: 'center' }}>{o.icono}</span>
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>{o.nombre}</span>
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '15px' }}>{o.linea}</span>
            {o.aviso && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cp-rust)' }}>{o.aviso}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Cabecera del detalle: «Pagar con Yape» + botón para volver a las tarjetas sin perder lo escrito. */
export function EncabezadoDetalle({ titulo, textoCambiar, alCambiar }: { titulo: string; textoCambiar: string; alCambiar: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
      <h3 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)' }}>{titulo}</h3>
      <button
        type="button"
        onClick={alCambiar}
        style={{ minHeight: '44px', minWidth: '44px', padding: '0 14px', borderRadius: '10px', border: '1.5px solid var(--cp-navy)', backgroundColor: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
      >
        {textoCambiar}
      </button>
    </div>
  );
}

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" {...trazo}>{children}</svg>
);

export const iconos = {
  yape: <IconoMedioPago medio="YAPE" tamano={32} ariaHidden />,
  plin: <IconoMedioPago medio="PLIN" tamano={32} ariaHidden />,
  efectivo: <IconoMedioPago medio="EFECTIVO" tamano={30} ariaHidden />,
  tarjeta: <IconoMedioPago medio="TARJETA" tamano={28} ariaHidden />,
  transferencia: <IconoMedioPago medio="TRANSFERENCIA" tamano={30} ariaHidden />,
  culqi: <IconoMedioPago medio="CULQI" tamano={30} ariaHidden />,
  pagoEnLinea: <IconoMedioPago medio="PAGO_EN_LINEA" tamano={30} ariaHidden />,
  dividido: <Svg><path d="M12 3v6M12 9L5 21M12 9l7 12" /></Svg>,
  gps: <Svg><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></Svg>,
  mapa: <Svg><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>,
  escribir: <Svg><path d="M4 20h4L19 9l-4-4L4 16v4z" /></Svg>,
};
