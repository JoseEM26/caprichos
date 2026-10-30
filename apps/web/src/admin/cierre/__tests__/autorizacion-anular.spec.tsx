import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalAnular } from '../../pedidos/ModalAnular';
import { api } from '../../../comun/api';
import { limpiarAutorizacionSupervisor } from '../../../comun/autorizacionSupervisor';

async function anular(codigo?: string) {
  const alAnularExitoso = vi.fn();
  const { unmount } = render(
    <ModalAnular pedidoId={1} codigoPedido="CP-001" alCerrar={vi.fn()} alAnularExitoso={alAnularExitoso} />,
  );
  fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'Pedido duplicado' } });
  if (codigo) fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: codigo } });
  fireEvent.click(screen.getByText('Confirmar anulación'));
  fireEvent.click(await screen.findByText('Sí, anular'));
  await waitFor(() => expect(alAnularExitoso).toHaveBeenCalled());
  unmount();
}

describe('Cierre: el código del supervisor se pide una sola vez', () => {
  beforeEach(() => {
    limpiarAutorizacionSupervisor();
    vi.restoreAllMocks();
  });

  it('anula dos pendientes escribiendo el código solo en el primero', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({} as any);
    await anular('123456');
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    await anular();
    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][2] as any).headers['X-Codigo-Supervisor']).toBe('123456');
    expect((post.mock.calls[1][2] as any).headers['X-Codigo-Supervisor']).toBeUndefined();
  });
});
