import { fireEvent, screen } from '@testing-library/react';

/** Paso 3: toca la tarjeta del medio (si se ofrecen) y devuelve el botón de enviar. */
export async function alEnvio(nombre = 'Yape') {
  const btn = await screen.findByRole('button', { name: /Enviar pedido|Elige cómo pagas/i });
  if (!/Elige/.test(btn.textContent || '')) return btn;
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${nombre}$`, 'i') }));
  return screen.findByRole('button', { name: /Enviar pedido/i });
}

/** Desde el detalle de un medio: «Cambiar» y toca otra tarjeta. */
export function cambiarMedio(nombre: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Cambiar$/ }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${nombre}$`, 'i') }));
}
