import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaNumerosBloqueados, celularValido } from '../TarjetaNumerosBloqueados';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  ErrorApi: class extends Error {},
}));

describe('TarjetaNumerosBloqueados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes('numeros-bloqueados')
        ? { filas: [{ id: '1', celular: '955111222', motivo: 'Spam', bloqueadoPor: 'Ana', bloqueadoEn: '2026-11-08T15:00:00Z' }], propios: ['977123456'] }
        : [{ clave: 'whatsapp_numeros_propios', valor: '977123456' }],
    );
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    vi.mocked(api.put).mockResolvedValue({});
  });

  it('valida celulares de 9 dígitos con 9 al inicio, con o sin +51', () => {
    expect(celularValido('+51 977-123-456')).toBe('977123456');
    expect(celularValido('877123456')).toBe('');
    expect(celularValido('12345')).toBe('');
  });

  it('lista bloqueados con motivo, quién y cuándo, y los números protegidos', async () => {
    render(<TarjetaNumerosBloqueados esAdmin />);
    expect(await screen.findByText('955 111 222')).toBeTruthy();
    expect(screen.getByText(/Spam · por Ana/)).toBeTruthy();
    expect(screen.getByTestId('numeros-protegidos').textContent).toContain('977 123 456');
    expect(screen.getByText('Números del negocio (no se les envía nada)')).toBeTruthy();
  });

  it('un número inválido no abre la confirmación ni llama', async () => {
    render(<TarjetaNumerosBloqueados esAdmin />);
    fireEvent.change(await screen.findByLabelText('Número a bloquear'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear un número' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/9 dígitos/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('bloquea solo tras confirmar Sí', async () => {
    render(<TarjetaNumerosBloqueados esAdmin />);
    fireEvent.change(await screen.findByLabelText('Número a bloquear'), { target: { value: '+51 933 444 555' } });
    fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Prueba' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear un número' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No, cancelar' }));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear un número' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, bloquear' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/whatsapp/numeros-bloqueados', { celular: '933444555', motivo: 'Prueba' }));
  });

  it('desbloquea con confirmación y guarda los números del negocio', async () => {
    render(<TarjetaNumerosBloqueados esAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desbloquear 955 111 222' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, desbloquear' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/whatsapp/numeros-bloqueados/desbloquear', { celular: '955111222' }));

    fireEvent.change(screen.getByLabelText('Números del negocio'), { target: { value: '977 123 456, 999111222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar números del negocio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/configuracion/whatsapp_numeros_propios', { valor: '977123456, 999111222' }));
  });

  it('sin permiso de edición no hay formularios ni botones', async () => {
    render(<TarjetaNumerosBloqueados />);
    await screen.findByText('955 111 222');
    expect(screen.queryByRole('button', { name: 'Bloquear un número' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Desbloquear/ })).toBeNull();
  });
});
