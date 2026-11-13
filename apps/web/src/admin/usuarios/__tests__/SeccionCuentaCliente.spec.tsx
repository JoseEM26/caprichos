import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionCuentaCliente } from '../SeccionCuentaCliente';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  ErrorApi: class extends Error {},
}));

const abrir = (o: { puedeEditar?: boolean; usuarioActivo?: boolean } = {}) =>
  render(<SeccionCuentaCliente usuarioId="5" puedeEditar={o.puedeEditar ?? true} usuarioActivo={o.usuarioActivo ?? true} />);

describe('Vincular su cuenta de cliente', () => {
  beforeEach(() => vi.resetAllMocks());

  it('no se muestra a quien no es ADMIN ni pide nada al servidor', () => {
    abrir({ puedeEditar: false });
    expect(screen.queryByTestId('seccion-cuenta-cliente')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('busca, pide confirmación Sí/No con nombre y celular enmascarado, y vincula', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    vi.mocked(api.post).mockResolvedValueOnce({ nombre: 'Ana Prueba', celular: '···123' }).mockResolvedValueOnce({ ok: true, vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    abrir();
    const campo = await screen.findByLabelText(/Celular de su cuenta/);
    fireEvent.change(campo, { target: { value: '900000123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular su cuenta de cliente' }));
    const texto = await screen.findByTestId('cuenta-encontrada');
    expect(texto.textContent).toContain('Ana Prueba');
    expect(texto.textContent).toContain('···123');
    expect(texto.textContent).not.toContain('900000123');
    expect(api.post).toHaveBeenCalledTimes(1); // nada se vincula hasta decir Sí
    fireEvent.click(screen.getByRole('button', { name: 'Sí, vincular' }));
    await waitFor(() => expect(screen.getByTestId('cuenta-vinculada').textContent).toContain('Ana Prueba'));
    expect(api.post).toHaveBeenLastCalledWith('/admin/usuarios/5/cuenta-cliente', { celular: '900000123' });
  });

  it('«No» cancela sin vincular; celular inválido no llama al servidor', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    vi.mocked(api.post).mockResolvedValue({ nombre: 'Ana Prueba', celular: '···123' });
    abrir();
    const campo = await screen.findByLabelText(/Celular de su cuenta/);
    fireEvent.change(campo, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular su cuenta de cliente' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: '900000123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular su cuenta de cliente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(screen.queryByTestId('cuenta-encontrada')).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('celular de un invitado: pide «¿Continuar?» Sí/No y al confirmar explica cómo entra a la carta', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    vi.mocked(api.post)
      .mockResolvedValueOnce({ nombre: 'Ana Prueba', celular: '···123', creara: true })
      .mockResolvedValueOnce({ ok: true, creada: true, vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    abrir();
    fireEvent.change(await screen.findByLabelText(/Celular de su cuenta/), { target: { value: '900000123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular su cuenta de cliente' }));
    const texto = await screen.findByTestId('cuenta-encontrada');
    expect(texto.textContent).toContain('Se creará su cuenta de cliente y quedará vinculada');
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(screen.getByTestId('cuenta-vinculada')).toBeTruthy());
    expect(screen.getByText(/Crear cuenta/)).toBeTruthy();
  });

  it('muestra el error del servidor (404 sin cuenta)', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    vi.mocked(api.post).mockRejectedValue(new Error('No hay una cuenta de cliente activa con ese celular'));
    abrir();
    fireEvent.change(await screen.findByLabelText(/Celular de su cuenta/), { target: { value: '900000123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vincular su cuenta de cliente' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No hay una cuenta');
  });

  it('muestra el estado vinculado y desvincula con confirmación Sí/No', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: { nombre: 'Ana Prueba', celular: '···123' } });
    vi.mocked(api.delete).mockResolvedValue({ ok: true });
    abrir();
    expect((await screen.findByTestId('cuenta-vinculada')).textContent).toContain('···123');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desvincular' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/usuarios/5/cuenta-cliente'));
    expect(await screen.findByLabelText(/Celular de su cuenta/)).toBeTruthy();
  });

  it('usuario inactivo: no se puede vincular', async () => {
    vi.mocked(api.get).mockResolvedValue({ vinculada: null });
    abrir({ usuarioActivo: false });
    const campo = (await screen.findByLabelText(/Celular de su cuenta/)) as HTMLInputElement;
    expect(campo.disabled).toBe(true);
  });
});
