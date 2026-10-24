import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { PanelCuenta } from '../PanelCuenta';

const base = {
  panelAbierto: true,
  abrirPanel: vi.fn(),
  cerrarPanel: vi.fn(),
  ingresar: vi.fn(),
  registrar: vi.fn(),
  actualizarPerfil: vi.fn(),
  subirFoto: vi.fn(),
  quitarFoto: vi.fn(),
  salir: vi.fn(),
  refrescar: vi.fn(),
};

const clienteCon = (telefono: string | null) => ({
  partyId: '100',
  nombre: 'Ana Pérez',
  dniMascara: '4521****',
  correo: 'ana@ejemplo.com',
  telefono,
  fotoUrl: null,
  cumpleanos: '14/03',
  puntos: 12,
});

const mockCuenta = (valores: Partial<ReturnType<typeof cuentaModulo.useCuenta>>) =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...base, cliente: null, ...valores } as any);

describe('PanelCuenta ▸ registro con teléfono', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('crear cuenta exige el teléfono celular de 9 dígitos que empiece con 9', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    mockCuenta({ registrar });
    render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getByLabelText('DNI'), { target: { value: '45217890' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'ClaveSegura2026' } });
    fireEvent.change(screen.getByLabelText(/Cumpleaños \(obligatorio\)/), { target: { value: '1995-03-14' } });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El teléfono celular debe tener 9 dígitos y empezar con 9.');
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Teléfono celular (9 dígitos)'), { target: { value: '812345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El teléfono celular debe tener 9 dígitos y empezar con 9.');
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Teléfono celular (9 dígitos)'), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
    await waitFor(() =>
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ dni: '45217890', telefono: '912345678', aceptaDatos: true })),
    );
  });
});

describe('PanelCuenta ▸ editar mi perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('guardar pide Sí/No: No no guarda y Sí guarda y muestra el éxito', async () => {
    const actualizarPerfil = vi.fn().mockResolvedValue(undefined);
    mockCuenta({ cliente: clienteCon('912345678'), actualizarPerfil });
    render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar mi perfil' }));
    const dni = screen.getByLabelText('DNI') as HTMLInputElement;
    expect(dni.value).toBe('4521****');
    expect(dni).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Teléfono celular (9 dígitos)'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByText('¿Guardar los cambios de tu perfil?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(actualizarPerfil).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() =>
      expect(actualizarPerfil).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Ana Pérez', telefono: '987654321', correo: 'ana@ejemplo.com' })),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Tus datos se guardaron.');
  });

  it('muestra el mensaje de error del servidor si no se pudo guardar', async () => {
    const actualizarPerfil = vi.fn().mockRejectedValue(new Error('El correo no es válido.'));
    mockCuenta({ cliente: clienteCon('912345678'), actualizarPerfil });
    render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar mi perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo no es válido.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cuenta sin teléfono muestra el aviso y lleva directo al formulario', () => {
    mockCuenta({ cliente: clienteCon(null) });
    render(<PanelCuenta />);

    expect(screen.getByText('Agrega tu teléfono para que no tengas que escribirlo en cada pedido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar mi teléfono' }));
    expect(screen.getByLabelText('Teléfono celular (9 dígitos)')).toHaveValue('');
  });

  it('cuenta con teléfono no muestra el aviso', () => {
    mockCuenta({ cliente: clienteCon('912345678') });
    render(<PanelCuenta />);

    expect(screen.queryByText(/Agrega tu teléfono/)).not.toBeInTheDocument();
    expect(screen.getByText('Celular 912345678')).toBeInTheDocument();
  });
});

describe('PanelCuenta ▸ foto de perfil opcional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const archivo = (contenido: string | ArrayBuffer, tipo: string, nombre = 'foto.png') =>
    new File([contenido], nombre, { type: tipo });

  it('subir foto envía el archivo elegido y el círculo muestra la foto cuando llega', async () => {
    const subirFoto = vi.fn().mockResolvedValue(undefined);
    mockCuenta({ cliente: clienteCon('912345678'), subirFoto });
    render(<PanelCuenta />);

    const foto = archivo('png', 'image/png');
    fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [foto] } });

    await waitFor(() => expect(subirFoto).toHaveBeenCalledWith(foto));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rechaza tipos que no son JPEG, PNG o WebP antes de enviar', async () => {
    const subirFoto = vi.fn();
    mockCuenta({ cliente: clienteCon('912345678'), subirFoto });
    render(<PanelCuenta />);

    fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [archivo('gif', 'image/gif', 'foto.gif')] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se aceptan fotos JPEG, PNG o WebP.');
    expect(subirFoto).not.toHaveBeenCalled();
  });

  it('rechaza una foto de más de 2 MB antes de enviar', async () => {
    const subirFoto = vi.fn();
    mockCuenta({ cliente: clienteCon('912345678'), subirFoto });
    render(<PanelCuenta />);

    const grande = archivo(new Uint8Array(2 * 1024 * 1024 + 1).buffer, 'image/jpeg', 'grande.jpg');
    fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [grande] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('La foto no puede pasar de 2 MB.');
    expect(subirFoto).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor si la subida falla', async () => {
    const subirFoto = vi.fn().mockRejectedValue(new Error('Solo se aceptan fotos JPEG, PNG o WebP.'));
    mockCuenta({ cliente: clienteCon('912345678'), subirFoto });
    render(<PanelCuenta />);

    fireEvent.change(screen.getByLabelText('Elegir foto de perfil'), { target: { files: [archivo('x', 'image/png')] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo se aceptan fotos JPEG, PNG o WebP.');
  });

  it('quitar la foto pide Sí/No: No no quita y Sí quita', async () => {
    const quitarFoto = vi.fn().mockResolvedValue(undefined);
    mockCuenta({ cliente: { ...clienteCon('912345678'), fotoUrl: '/archivos/publico/2026/10/ana.webp' }, quitarFoto });
    render(<PanelCuenta />);

    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(screen.getByText('¿Quitar tu foto de perfil?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(quitarFoto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(quitarFoto).toHaveBeenCalledTimes(1));
  });

  it('la foto se puede cambiar al editar el perfil y nunca se exige al crear la cuenta', () => {
    mockCuenta({ cliente: clienteCon('912345678') });
    const { unmount } = render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mi perfil' }));
    expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
    unmount();

    vi.restoreAllMocks();
    mockCuenta({ cliente: null });
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    expect(screen.queryByLabelText('Elegir foto de perfil')).not.toBeInTheDocument();
  });
});
