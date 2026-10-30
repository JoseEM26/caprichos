import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Perfil } from '../Perfil';
import { api, clienteFetch } from '../../comun/api';

const refrescarYo = vi.fn();

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { partyId: '1', nombres: 'Ana', rol: 'MOZO' },
    tiene: () => true,
    salir: vi.fn(),
    refrescarYo,
  }),
}));

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return {
    ...real,
    api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() },
    clienteFetch: vi.fn(),
  };
});

vi.mock('../vouchers/reducirImagenVoucher', () => ({
  reducirImagenVoucher: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}));

const PERFIL = {
  nombres: 'Ana',
  apellidos: 'Pérez',
  correo: '',
  fotoUrl: null,
  rol: 'MOZO',
  dniEnmascarado: '****5678',
  activo: true,
};

function montar() {
  return render(
    <MemoryRouter>
      <Perfil />
    </MemoryRouter>,
  );
}

describe('Mi perfil (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue(PERFIL);
    vi.mocked(api.patch).mockResolvedValue({ ...PERFIL, nombres: 'Ana María' });
    vi.mocked(api.delete).mockResolvedValue({ ...PERFIL, fotoUrl: null });
    vi.mocked(clienteFetch).mockResolvedValue({ ...PERFIL, fotoUrl: '/archivos/publico/nueva.webp' });
  });

  it('muestra rol, usuario y accesos como solo lectura (sin campos editables)', async () => {
    montar();
    expect(await screen.findByText('DATOS DE ACCESO (SOLO LECTURA)')).toBeInTheDocument();
    expect(screen.getByText('****5678')).toBeInTheDocument();
    // Rol aparece como etiqueta, no como campo editable
    expect(screen.getAllByText('Mozo').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/rol/i)).toBeNull();
    expect(screen.queryByLabelText(/usuario de acceso/i)).toBeNull();
    expect(screen.queryByLabelText(/permisos/i)).toBeNull();
  });

  it('cambiar el nombre pide confirmación Sí/No antes de guardar', async () => {
    montar();
    const nombres = await screen.findByLabelText('Nombres');
    fireEvent.change(nombres, { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Guardar tus datos' });
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'No, revisar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guardar tus datos' })).toBeNull());
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Guardar tus datos' })).getByRole('button', { name: 'Sí, guardar' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/auth/perfil', {
      nombres: 'Ana María',
      apellidos: 'Pérez',
      correo: '',
    }));
    await waitFor(() => expect(refrescarYo).toHaveBeenCalled());
  });

  it('no permite guardar un correo con formato inválido', async () => {
    montar();
    const correo = await screen.findByLabelText('Correo electrónico');
    fireEvent.change(correo, { target: { value: 'no-es-correo' } });
    fireEvent.change(await screen.findByLabelText('Nombres'), { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' }));
    expect(await screen.findByText('El correo no tiene un formato válido.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Guardar tus datos' })).toBeNull();
  });

  it('subir foto: previsualiza y guarda solo tras Sí', async () => {
    const { container } = montar();
    await screen.findByText('DATOS DE ACCESO (SOLO LECTURA)');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const archivo = new File(['img'], 'foto.png', { type: 'image/png' });
    URL.createObjectURL = vi.fn(() => 'blob:vista');
    URL.revokeObjectURL = vi.fn();
    fireEvent.change(input, { target: { files: [archivo] } });

    expect(await screen.findByAltText('Vista previa de tu foto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar foto' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Guardar tu foto' });
    expect(vi.mocked(api.get)).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(clienteFetch).toHaveBeenCalledWith('/auth/perfil/foto', expect.objectContaining({ method: 'PUT' })));
  });

  it('quitar foto pide Sí/No y no borra si se responde No', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...PERFIL, fotoUrl: '/archivos/publico/foto.webp' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar foto' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Quitar tu foto' });

    fireEvent.click(within(dialogo).getByRole('button', { name: 'No, dejarla' }));
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quitar tu foto' })).getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/auth/perfil/foto'));
  });
});
