import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClientesAdminView } from '../ClientesAdminView';
import { AvatarCliente } from '../AvatarCliente';
import * as clientesApi from '../clientesApi';
import type { ClienteItem } from '../tipos';

const cli = (id: string, nombre: string, extra: Partial<ClienteItem> = {}): ClienteItem => ({
  id, nombre, tipo: 'Persona', telefono: '999888777', correo: 'sin correo', cumpleanos: '—', pedidos: 0, puntos: 1,
  creditoPersonal: false, envioFijo: null, descuentoEnvio: null, activo: true, ...extra,
});

describe('Clientes ▸ avatar', () => {
  it('retrato circular si hay url; iniciales si no', () => {
    const { unmount } = render(<AvatarCliente cliente={{ nombre: 'Ana Pérez', avatar: { url: '/archivos/a.png', personalizado: true } }} />);
    expect(screen.getByTestId('retrato-avatar')).toHaveAttribute('src', '/archivos/a.png');
    unmount();
    render(<AvatarCliente cliente={{ nombre: 'Ana Pérez' }} />);
    expect(screen.getByTestId('avatar-cliente-iniciales')).toHaveTextContent('AP');
  });

  it('el chip filtra por avatar personalizado y muestra el contador', async () => {
    const espia = vi.spyOn(clientesApi, 'listarClientes').mockResolvedValue({
      items: [cli('1', 'Ana', { avatar: { url: '/archivos/a.png', personalizado: true } })], total: 1, pagina: 1, paginas: 1,
      contadores: { verificados: 0, sinVerificar: 1, gastanPuntos: 0, avatarPersonalizado: 7 },
    });
    render(<ClientesAdminView />);
    const chip = await screen.findByRole('button', { name: /Con avatar personalizado \(7\)/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    await waitFor(() => expect(espia).toHaveBeenLastCalledWith(expect.objectContaining({ avatar: 'personalizado' })));
    expect(screen.getAllByTestId('retrato-avatar').length).toBeGreaterThan(0);
  });
});
