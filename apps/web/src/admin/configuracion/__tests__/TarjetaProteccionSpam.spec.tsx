import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaProteccionSpam } from '../TarjetaProteccionSpam';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
  ErrorApi: class extends Error {},
}));

describe('TarjetaProteccionSpam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([{ clave: 'spam_bloqueo_min', valor: 30 }]);
    vi.mocked(api.put).mockResolvedValue({});
  });

  it('muestra los 6 valores con su dato guardado o el por defecto', async () => {
    render(<TarjetaProteccionSpam esAdmin />);
    expect(await screen.findByText('Protección contra spam y pedidos falsos')).toBeTruthy();
    expect((screen.getByLabelText('Duración del bloqueo') as HTMLInputElement).value).toBe('30');
    expect((screen.getByLabelText('Mensajes por minuto') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Mensajes por hora') as HTMLInputElement).value).toBe('60');
    expect((screen.getByLabelText('Excesos para bloquear') as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText('Bloqueo por reincidencia') as HTMLInputElement).value).toBe('1440');
    expect((screen.getByLabelText('Pedidos sin pagar por número') as HTMLInputElement).value).toBe('3');
  });

  it('fuera de rango no abre la confirmación ni guarda', async () => {
    render(<TarjetaProteccionSpam esAdmin />);
    const campo = await screen.findByLabelText('Pedidos sin pagar por número');
    fireEvent.change(campo, { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar protección' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/entre 1 y 10/);
    expect(screen.queryByText('¿Guardar la protección contra spam?')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('guarda las 6 claves solo tras confirmar Sí; No no guarda', async () => {
    render(<TarjetaProteccionSpam esAdmin />);
    fireEvent.change(await screen.findByLabelText('Excesos para bloquear'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar protección' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No, cancelar' }));
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar protección' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(6));
    expect(api.put).toHaveBeenCalledWith('/admin/configuracion/spam_bloqueo_excesos', { valor: 5 });
  });

  it('sin ser admin los campos quedan de solo lectura y no hay botón', async () => {
    render(<TarjetaProteccionSpam esAdmin={false} />);
    expect(((await screen.findByLabelText('Duración del bloqueo')) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Guardar protección' })).toBeNull();
  });
});
