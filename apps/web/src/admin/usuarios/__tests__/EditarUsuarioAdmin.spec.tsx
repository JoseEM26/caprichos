import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditarUsuarioModal } from '../EditarUsuarioModal';
import { api } from '../../../comun/api';

const sesion = vi.hoisted(() => ({ rol: 'ADMIN', salir: vi.fn() }));

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  clienteFetch: vi.fn(),
  ErrorApi: class extends Error {
    codigo = '';
  },
}));

vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { partyId: '1', nombres: 'Admin', rol: sesion.rol }, salir: sesion.salir }),
}));

const PERSONA = { id: '5', partyId: '50', nombres: 'Ana', apellidos: 'Paz', dni: '12****78', rol: 'CAJERO', activo: true, debeCambiar: false };

function abrir(ruta = '/admin/usuarios') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/admin/usuarios"
          element={<EditarUsuarioModal abierto usuario={PERSONA} alCerrar={vi.fn()} alUsuarioEditado={vi.fn()} />}
        />
        <Route path="/admin/ingresar" element={<p>Pantalla de ingreso</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Editar usuario: controles de administración', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesion.rol = 'ADMIN';
    vi.mocked(api.get).mockResolvedValue({ horarios: [], reemplazos: [] });
  });

  it('el ADMIN ve DNI nuevo, correo, foto y el botón Cambiar contraseña', async () => {
    abrir();
    expect(await screen.findByLabelText('Nuevo DNI (deja vacío para no cambiarlo)')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo (deja vacío para no cambiarlo)')).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir foto de la persona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
  });

  it('otros roles (CAJERO) no ven esos controles, pero sí nombres y apellidos', async () => {
    sesion.rol = 'CAJERO';
    abrir();
    await screen.findByLabelText('Nombres');
    expect(screen.queryByLabelText('Nuevo DNI (deja vacío para no cambiarlo)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Correo (deja vacío para no cambiarlo)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Elegir foto de la persona')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).not.toBeInTheDocument();
  });

  it('cumpleaños: solo ADMIN lo ve; una fecha irreal da error y no llama al servidor; válida se envía como día/mes', async () => {
    abrir();
    const campo = await screen.findByLabelText('Cumpleaños, día/mes (opcional)');
    expect(screen.getByText(/Solo la ven Administración y Supervisión/)).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '31/02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Escribe día y mes reales, por ejemplo 14/03')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    vi.mocked(api.patch).mockResolvedValue({ ...PERSONA, reingresar: false });
    fireEvent.change(campo, { target: { value: '14/03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(vi.mocked(api.patch).mock.calls[0][1]).toMatchObject({ cumpleanos: '14/03' });
  });

  it('cumpleaños: otros roles no ven el campo', async () => {
    sesion.rol = 'CAJERO';
    abrir();
    await screen.findByLabelText('Nombres');
    expect(screen.queryByLabelText('Cumpleaños, día/mes (opcional)')).not.toBeInTheDocument();
  });

  it('cambiar el DNI sin escribir la contraseña del administrador muestra error y no llama al servidor', async () => {
    abrir();
    fireEvent.change(await screen.findByLabelText('Nuevo DNI (deja vacío para no cambiarlo)'), {
      target: { value: '87654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Escribe tu contraseña de administrador para cambiar el DNI')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('cambiar el DNI pide confirmación Sí/No y envía la contraseña del administrador', async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...PERSONA, reingresar: false });
    abrir();
    fireEvent.change(await screen.findByLabelText('Nuevo DNI (deja vacío para no cambiarlo)'), {
      target: { value: '87654321' },
    });
    fireEvent.change(screen.getByLabelText('Tu contraseña de administrador'), { target: { value: 'Clave-admin-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/admin/usuarios/5',
        expect.objectContaining({ tipoDocumento: 'DNI', documento: '87654321', claveAdmin: 'Clave-admin-1' }),
      ),
    );
  });

  it('cambiar la contraseña pide la contraseña del administrador y la envía con la nueva', async () => {
    vi.mocked(api.post).mockResolvedValue({ reingresar: false, mensaje: 'ok' });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    const dialogo = screen.getByRole('dialog', { name: /Cambiar contraseña de Ana/ });

    fireEvent.change(within(dialogo).getByLabelText('Contraseña nueva'), { target: { value: 'NuevaClave-2' } });
    fireEvent.change(within(dialogo).getByLabelText('Confirmar contraseña nueva'), { target: { value: 'NuevaClave-2' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }));
    expect(within(dialogo).getByText('Escribe tu contraseña de administrador.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialogo).getByLabelText('Tu contraseña de administrador'), { target: { value: 'Clave-admin-1' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cambiar' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/usuarios/5/clave', {
        claveNueva: 'NuevaClave-2',
        claveAdmin: 'Clave-admin-1',
      }),
    );
  });

  it('si el servidor pide reingresar, cierra la sesión y lleva a /admin/ingresar con aviso', async () => {
    vi.mocked(api.post).mockResolvedValue({ reingresar: true, mensaje: 'ok' });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    const dialogo = screen.getByRole('dialog', { name: /Cambiar contraseña de Ana/ });
    fireEvent.change(within(dialogo).getByLabelText('Contraseña nueva'), { target: { value: 'NuevaClave-2' } });
    fireEvent.change(within(dialogo).getByLabelText('Confirmar contraseña nueva'), { target: { value: 'NuevaClave-2' } });
    fireEvent.change(within(dialogo).getByLabelText('Tu contraseña de administrador'), { target: { value: 'Clave-admin-1' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar contraseña' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cambiar' }));

    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument();
    expect(sesion.salir).toHaveBeenCalled();
  });

  it('se reparte en pestañas: Datos, Roles, Horario, Reemplazos e Historial', async () => {
    abrir();
    await screen.findByLabelText('Nombres');
    const nombres = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(nombres).toEqual(['Datos', 'Roles', 'Horario', 'Reemplazos', 'Historial']);
    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }));
    expect(screen.getByRole('tab', { name: 'Roles' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Roles temporales')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Horario' }));
    expect(screen.getByRole('button', { name: 'Guardar horario y reemplazos' })).toBeInTheDocument();
  });

  it('cambiar de pestaña no pierde lo escrito', async () => {
    abrir();
    fireEvent.change(await screen.findByLabelText('Nombres'), { target: { value: 'Ana María' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Datos' }));
    expect(screen.getByLabelText('Nombres')).toHaveValue('Ana María');
  });

  it('un error de validación en Roles lleva a esa pestaña; en Datos, a Datos', async () => {
    abrir();
    fireEvent.change(await screen.findByLabelText('Nombres'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Los nombres son requeridos')).toBeVisible();
    expect(screen.getByRole('tab', { name: /Datos/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('con cambios sin guardar avisa antes de cerrar; sin cambios cierra directo', async () => {
    const alCerrar = vi.fn();
    render(
      <MemoryRouter>
        <EditarUsuarioModal abierto usuario={PERSONA} alCerrar={alCerrar} alUsuarioEditado={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findByLabelText('Nombres');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(alCerrar).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Otra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: 'No, seguir editando' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar' }));
    expect(alCerrar).toHaveBeenCalledTimes(2);
  });
});
