import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionCuentaCliente } from '../SeccionCuentaCliente';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  ErrorApi: class extends Error {},
}));

const abrir = (puedeEditar = true) => render(<SeccionCuentaCliente usuarioId="5" puedeEditar={puedeEditar} />);

describe('Cuenta de cliente (carta): solo estado, el celular es uno solo', () => {
  beforeEach(() => vi.resetAllMocks());

  it('no se muestra a quien no es ADMIN ni pide nada al servidor', () => {
    abrir(false);
    expect(screen.queryByTestId('seccion-cuenta-cliente')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('sin vínculo: explica que se vincula sola y NO ofrece segundo campo de celular ni botón de vincular', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    abrir();
    expect((await screen.findByTestId('cuenta-sin-vincular')).textContent).toContain('Se vincula sola al guardar el celular');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/Celular de su cuenta/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Vincular/ })).toBeNull();
  });

  it('vinculada: muestra nombre y celular enmascarado y desvincula con Sí/No', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    vi.mocked(api.delete).mockResolvedValue({ ok: true });
    abrir();
    const t = (await screen.findByTestId('cuenta-vinculada')).textContent;
    expect(t).toContain('Vinculada a Ana Prueba (···123) — recibe el descuento de personal');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/usuarios/5/cuenta-cliente'));
    expect(await screen.findByTestId('cuenta-sin-vincular')).toBeTruthy();
  });

  it('«No» cancela el desvincular', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desvincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByTestId('cuenta-vinculada')).toBeTruthy();
  });
});
