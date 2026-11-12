import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditarUsuarioModal } from '../EditarUsuarioModal';
import { CrearUsuarioModal } from '../CrearUsuarioModal';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  clienteFetch: vi.fn(),
  ErrorApi: class extends Error {
    codigo = '';
  },
}));
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' }, salir: vi.fn() }),
}));

const PERSONA = { id: '5', partyId: '50', nombres: 'Ana', apellidos: 'Paz', dni: '12****78', rol: 'CAJERO', activo: true, debeCambiar: false };
const CUENTA = { nombre: 'Ana Paz', celularEnmascarado: '···123' };

function abrir(alUsuarioEditado = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/admin/usuarios']}>
      <Routes>
        <Route path="/admin/usuarios" element={<EditarUsuarioModal abierto usuario={PERSONA} alCerrar={vi.fn()} alUsuarioEditado={alUsuarioEditado} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function previa(r: unknown) {
  vi.mocked(api.post).mockImplementation(async (url: string) => (url.endsWith('/celular/previa') ? r : {}) as any);
}

describe('Editar usuario: aviso de vinculación del celular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ horarios: [], reemplazos: [] });
  });

  it('celular de una cuenta de cliente: avisa con nombre y celular enmascarado y guarda en una sola acción', async () => {
    previa({ estado: 'VINCULARA_CUENTA', cuenta: CUENTA, mismoNombre: true });
    vi.mocked(api.patch).mockResolvedValue({ ...PERSONA, cuentaClienteVinculada: { nombre: 'Ana Paz', celular: '···123' } });
    const editado = vi.fn();
    abrir(editado);
    fireEvent.change(await screen.findByLabelText('Celular (deja vacío para no cambiarlo)'), { target: { value: '900000123' } });
    expect(await screen.findByText(/Al guardar, se vinculará a/)).toBeInTheDocument();
    expect(screen.getByText('Ana Paz', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/···123/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, es la misma persona' })).not.toBeInTheDocument(); // mismo nombre: sin casilla
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/admin/usuarios/5/celular/previa');
  });

  it('otra persona: muestra el error claro como alerta', async () => {
    previa({ estado: 'OTRA_PERSONA', motivo: 'USUARIO', mensaje: 'Ese celular ya lo usa otro usuario del equipo' });
    abrir();
    fireEvent.change(await screen.findByLabelText('Celular (deja vacío para no cambiarlo)'), { target: { value: '900000123' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese celular ya lo usa otro usuario del equipo');
  });

  it('nombre distinto: pide Sí/No, no guarda sin confirmar y con «Sí» envía confirmaMismaPersona', async () => {
    previa({ estado: 'VINCULARA_CUENTA', cuenta: { nombre: 'Rosa Otra', celularEnmascarado: '···123' }, mismoNombre: false });
    vi.mocked(api.patch).mockResolvedValue({ ...PERSONA });
    abrir();
    fireEvent.change(await screen.findByLabelText('Celular (deja vacío para no cambiarlo)'), { target: { value: '900000123' } });
    await screen.findByText('Sí, es la misma persona');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/Confirma que la cuenta de cliente es de esta persona/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, es la misma persona' }));
    expect(await screen.findByText('Confirmado: es la misma persona.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirmar = await screen.findByRole('button', { name: /^Sí/ });
    fireEvent.click(confirmar);
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(vi.mocked(api.patch).mock.calls[0][1]).toMatchObject({ celular: '900000123', confirmaMismaPersona: true });
  });

  it('«No» vacía el celular', async () => {
    previa({ estado: 'VINCULARA_CUENTA', cuenta: CUENTA, mismoNombre: false });
    abrir();
    const campo = await screen.findByLabelText('Celular (deja vacío para no cambiarlo)');
    fireEvent.change(campo, { target: { value: '900000123' } });
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(campo).toHaveValue('');
  });
});

describe('Nuevo usuario: aviso de vinculación del celular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue([]);
  });

  it('usa la previa de altas (sin id), avisa y muestra el error de otra persona', async () => {
    previa({ estado: 'VINCULARA_CUENTA', cuenta: CUENTA, mismoNombre: true });
    render(<CrearUsuarioModal abierto alCerrar={vi.fn()} alUsuarioCreado={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Celular (opcional)'), { target: { value: '900000123' } });
    expect(await screen.findByText(/Al guardar, se vinculará a/)).toBeInTheDocument();
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/admin/usuarios/celular/previa');
    previa({ estado: 'OTRA_PERSONA', motivo: 'CUENTA_VINCULADA', mensaje: 'Ese celular es de una cuenta de cliente ya vinculada a otra persona' });
    fireEvent.change(screen.getByLabelText('Celular (opcional)'), { target: { value: '900000124' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('ya vinculada a otra persona');
  });
});
