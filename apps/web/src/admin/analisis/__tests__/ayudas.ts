import { fireEvent, screen } from '@testing-library/react';

/** Cambia de sección (chips) dentro de una pestaña de Análisis. */
export const ir = (nombre: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nombre }));
