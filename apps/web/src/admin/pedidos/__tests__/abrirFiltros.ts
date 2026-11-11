import { fireEvent, screen } from '@testing-library/react';

/** Las pastillas de estado, «Todo el día» y los chips activos viven dentro del panel «Filtros»: lo abre si está cerrado. */
export function abrirFiltros() {
  const boton = screen.getByRole('button', { name: /^Filtros/ });
  if (boton.getAttribute('aria-expanded') !== 'true') fireEvent.click(boton);
}
