import { fireEvent, screen, waitFor } from '@testing-library/react';

/** La lista de Mis pedidos viene plegada (acordeón): espera el texto y despliega todas las cuentas. */
export async function abrirTodas(textoEsperado?: string | RegExp) {
  if (textoEsperado) await screen.findAllByText(textoEsperado);
  else await waitFor(() => expect(document.querySelector('.mp-acc-cab')).not.toBeNull());
  document.querySelectorAll<HTMLElement>('.mp-acc-cab[aria-expanded="false"]').forEach((b) => fireEvent.click(b));
}
