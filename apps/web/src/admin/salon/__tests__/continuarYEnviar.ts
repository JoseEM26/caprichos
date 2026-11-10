import { fireEvent, screen } from '@testing-library/react';

/**
 * El Nuevo pedido tiene dos pasos: «Pedido» y «Pago». Desde el paso 1 toca «Continuar» (si está habilitado) y,
 * en el paso 2, el botón final «Enviar a cocina · S/ …» (o «Registrar extra · S/ …»).
 */
export function continuarYEnviar() {
  const continuar = screen.queryByRole('button', { name: 'Continuar' });
  if (continuar) fireEvent.click(continuar);
  fireEvent.click(screen.getByRole('button', { name: /^(Enviar a cocina|Registrar extra)/ }));
}

/** Pasa al paso 2 «Pago» (sin enviar). */
export function irAlPago() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}
