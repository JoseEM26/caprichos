import type { CSSProperties } from 'react';

/** Objetivo táctil mínimo (también en celular). */
export const TACTIL_RESERVA = 44;

export const etiquetaReserva: CSSProperties = {
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.02em',
  color: 'var(--cp-navy)',
  margin: '0 0 8px',
};

export function estiloChip(activo: boolean, deshabilitado = false): CSSProperties {
  return {
    flex: 'none',
    minWidth: 64,
    minHeight: TACTIL_RESERVA,
    padding: '0 14px',
    borderRadius: 9999,
    border: '1.5px solid var(--cp-navy)',
    background: activo ? 'var(--cp-navy)' : 'var(--cp-white)',
    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
    fontFamily: 'var(--fuente-titulos)',
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: 'nowrap',
    opacity: deshabilitado ? 0.4 : 1,
    textDecoration: deshabilitado ? 'line-through' : 'none',
    cursor: deshabilitado ? 'not-allowed' : 'pointer',
  };
}

/** Fila de chips que se desplaza en horizontal sin salirse de la hoja. */
export const filaChips: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 4,
  maxWidth: '100%',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
};

export const campoReserva: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: TACTIL_RESERVA,
  borderRadius: 12,
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  padding: '10px 14px',
  // 16 px evita que iOS haga zoom al enfocar el campo
  fontSize: 16,
  fontFamily: 'var(--fuente-texto)',
  outline: 'none',
};

export const botonPrimarioReserva: CSSProperties = {
  flex: 1,
  minHeight: TACTIL_RESERVA,
  borderRadius: 12,
  border: 0,
  background: 'var(--cp-orange)',
  color: '#FFFFFF',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 15,
  padding: '0 16px',
  cursor: 'pointer',
};

export const botonSecundarioReserva: CSSProperties = {
  minHeight: TACTIL_RESERVA,
  borderRadius: 12,
  border: '1.5px solid var(--cp-navy)',
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 14,
  padding: '0 16px',
  cursor: 'pointer',
};
