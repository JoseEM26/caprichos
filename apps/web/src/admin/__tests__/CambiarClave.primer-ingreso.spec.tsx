import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CambiarClave } from '../CambiarClave';
import { api, clienteFetch } from '../../comun/api';

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { partyId: '1', nombres: 'Ana', rol: 'MOZO' },
    debeCambiar: true,
    marcarClaveCambiada: vi.fn(),
    salir: vi.fn(),
  }),
}));

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return {
    ...real,
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
    clienteFetch: vi.fn(),
  };
});

function montar() {
  return render(
    <MemoryRouter>
      <CambiarClave />
    </MemoryRouter>,
  );
}

describe('Primer ingreso: foto de perfil en CambiarClave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ fotoUrl: null });
    vi.mocked(api.delete).mockResolvedValue({ fotoUrl: null });
    vi.mocked(clienteFetch).mockResolvedValue({ fotoUrl: '/archivos/publico/nueva.webp' });
  });

  it('muestra la sección de foto y carga la foto actual del servidor', async () => {
    montar();
    expect(screen.getByText('Foto de perfil')).toBeInTheDocument();
    expect(await screen.findByLabelText('Elegir foto de perfil')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/auth/perfil');
  });

  it('sube una foto propia con PUT /auth/perfil/foto y la muestra', async () => {
    montar();
    const input = await screen.findByLabelText('Elegir foto de perfil');
    const archivo = new File(['img'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() =>
      expect(clienteFetch).toHaveBeenCalledWith('/auth/perfil/foto', expect.objectContaining({ method: 'PUT' })),
    );
    expect(await screen.findByRole('button', { name: 'Quitar' })).toBeInTheDocument();
    expect(screen.getByText('Cambiar foto')).toBeInTheDocument();
  });

  it('quitar la foto pide confirmación Sí/No antes de borrarla', async () => {
    vi.mocked(api.get).mockResolvedValue({ fotoUrl: '/archivos/publico/actual.webp' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Quitar tu foto' });
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'No, dejarla' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quitar tu foto' })).toBeNull());
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quitar tu foto' })).getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/auth/perfil/foto'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull());
  });
});
