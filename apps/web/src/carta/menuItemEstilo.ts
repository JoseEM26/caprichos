import type { CSSProperties } from 'react';

/** Fila de una opción del menú «Opciones» de la cabecera (≥ 44 px de alto, ancho completo). */
export const estiloItemMenu: CSSProperties = {
  width: '100%',
  minHeight: 48,
  boxSizing: 'border-box',
  padding: '0 14px',
  border: 0,
  borderRadius: 12,
  background: 'transparent',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 14,
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
};
