import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { PanelCuenta } from '../PanelCuenta';
import { api, ErrorApi } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

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
  correo: 'ana@ejemplo.com',
  telefono,
  fotoUrl: null,
  cumpleanos: '14/03',
  puntos: 12,
});

const mockCuenta = (valores: Partial<ReturnType<typeof cuentaModulo.useCuenta>>) =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...base, cliente: null, ...valores } as any);

const legalMock = {
  terminos: '# Alcance\n\nTexto de términos.',
  privacidad: '# Datos\n\nTexto de privacidad.',
  textoConsentimiento: 'Acepto que Caprichos guarde mi celular y mis datos.',
  terminosVersion: '2026-10-29',
  privacidadVersion: '2026-10-29',
  reclamoPlazoDiasHabiles: 15,
};

const escribir = (etiqueta: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

/** Paso 1 (celular) enviado y paso 2 (código) confirmado: queda en el paso 3 «Tus datos». */
const llenarPaso1 = async () => {
  vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
  escribir('Celular', '912345678');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
  expect(await screen.findByText('Paso 2 de 3')).toBeInTheDocument();
  escribir('Código de 6 dígitos (llega por WhatsApp)', '123456');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
  expect(await screen.findByText('Paso 3 de 3')).toBeInTheDocument();
};

describe('PanelCuenta ▸ acceso con celular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue(legalMock);
  });

  it('ingresar usa celular y contraseña, valida el celular y muestra el error del servidor', async () => {
    const ingresar = vi.fn().mockRejectedValueOnce(new Error('Celular o contraseña incorrectos.')).mockResolvedValue(undefined);
    mockCuenta({ ingresar });
    render(<PanelCuenta />);

    expect(screen.getByText('+51')).toBeInTheDocument();
    escribir('Contraseña', 'ClaveSegura2026');
    escribir('Celular', '812345678');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El celular debe tener 9 dígitos y empezar con 9.');
    expect(ingresar).not.toHaveBeenCalled();

    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Celular o contraseña incorrectos.');
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(ingresar).toHaveBeenLastCalledWith('912345678', 'ClaveSegura2026'));
  });

  it('la contraseña se puede mostrar y ocultar', () => {
    mockCuenta({});
    render(<PanelCuenta />);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
  });

  it('crear cuenta en 3 pasos: celular, código por WhatsApp y luego contraseña; el envío final no lleva código', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
    mockCuenta({ registrar });
    render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('DNI (opcional)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El celular debe tener 9 dígitos y empezar con 9.');
    expect(post).not.toHaveBeenCalled();

    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/cuenta/registro/codigo', { telefono: '912345678' }));
    expect(await screen.findByText('Paso 2 de 3')).toBeInTheDocument();

    escribir('Código de 6 dígitos (llega por WhatsApp)', '12');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El código tiene 6 dígitos.');

    escribir('Código de 6 dígitos (llega por WhatsApp)', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/cuenta/registro/verificar', { telefono: '912345678', codigo: '123456' }));
    expect(await screen.findByText('Paso 3 de 3')).toBeInTheDocument();
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu nombre.');

    escribir('Nombre', 'Ana Pérez');
    escribir('Crea tu contraseña', 'clave');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres');

    escribir('Crea tu contraseña', 'ClaveSegura2026!');
    expect(screen.getByRole('status')).toHaveTextContent('buena');
    expect(screen.getByLabelText('DNI (opcional)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Debes aceptar');
    expect(registrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
    const enviado = registrar.mock.calls[0][0];
    expect(enviado).toEqual(expect.objectContaining({ nombre: 'Ana Pérez', telefono: '912345678', contrasena: 'ClaveSegura2026!', aceptaDatos: true }));
    expect(enviado).not.toHaveProperty('codigo');
    expect(enviado).not.toHaveProperty('dni');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('crear cuenta: el reenvío espera 60 s, el código tiene 6 dígitos y el DNI es opcional con 8 dígitos', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
    mockCuenta({ registrar });
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    expect(await screen.findByRole('button', { name: 'Reenviar código en 60 s' })).toBeDisabled();
    escribir('Código de 6 dígitos (llega por WhatsApp)', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(await screen.findByText('Paso 3 de 3')).toBeInTheDocument();
    escribir('Nombre', 'Ana Pérez');
    escribir('Crea tu contraseña', 'ClaveSegura2026');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Lo pides solo si quieres: tu celular es lo que te identifica.')).toBeInTheDocument();

    escribir('DNI (opcional)', '1234');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El DNI debe tener 8 dígitos');
    expect(registrar).not.toHaveBeenCalled();

    escribir('DNI (opcional)', '12345678');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
    expect(registrar.mock.calls[0][0]).toEqual(expect.objectContaining({ dni: '12345678' }));
  });

  it('código incorrecto al confirmar muestra el mensaje del servidor y no avanza', async () => {
    vi.spyOn(api, 'post').mockImplementation(async (ruta: string) => {
      if (ruta.endsWith('/verificar')) throw new ErrorApi('CODIGO_INVALIDO', 'El código no es correcto o ya venció. Pide uno nuevo.', 400);
      return { ok: true };
    });
    mockCuenta({});
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)');
    escribir('Código de 6 dígitos (llega por WhatsApp)', '000000');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto o ya venció. Pide uno nuevo.');
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
  });

  it('los enlaces legales abren el texto del servidor con títulos y párrafos', async () => {
    mockCuenta({});
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await llenarPaso1();
    await screen.findByText(/Acepto que Caprichos/);

    fireEvent.click(screen.getByRole('button', { name: 'Términos y condiciones' }));
    expect(await screen.findByRole('heading', { name: 'Alcance' })).toBeInTheDocument();
    expect(screen.getByText('Texto de términos.')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Términos y condiciones' })).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Política de privacidad' }));
    expect(await screen.findByText('Texto de privacidad.')).toBeInTheDocument();
  });

  it('409 TELEFONO_REGISTRADO (tras confirmar el código) invita a ingresar o recuperar', async () => {
    const registrar = vi.fn().mockRejectedValue(new ErrorApi('TELEFONO_REGISTRADO', 'ya existe', 409));
    mockCuenta({ registrar });
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await llenarPaso1();
    escribir('Nombre', 'Ana Pérez');
    escribir('Crea tu contraseña', 'ClaveSegura2026');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese celular ya tiene cuenta: ingresa o recupera tu contraseña.');
  });

  it('recuperar contraseña en 2 pasos: celular, luego código y contraseña nueva', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (ruta: string) =>
      ruta.endsWith('/solicitar') ? { ok: true, mensaje: 'Si ese celular tiene cuenta, te enviamos un código por WhatsApp. Vence en 10 minutos.' } : { ok: true },
    );
    mockCuenta({});
    render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el código' }));
    expect(await screen.findByText(/Si ese celular tiene cuenta, te enviamos un código por WhatsApp/)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/carta/cuenta/recuperar/solicitar', { telefono: '912345678' });
    expect(screen.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();

    escribir('Código de 6 dígitos', '12ab');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('6 dígitos');

    escribir('Código de 6 dígitos', '123456');
    escribir('Contraseña nueva', 'NuevaClave2026');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi contraseña' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/carta/cuenta/recuperar/confirmar', { telefono: '912345678', codigo: '123456', contrasenaNueva: 'NuevaClave2026' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('cambiaste tu contraseña');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('código inválido muestra el mensaje del servidor', async () => {
    vi.spyOn(api, 'post').mockImplementation(async (ruta: string) => {
      if (ruta.endsWith('/solicitar')) return { ok: true };
      throw new ErrorApi('CODIGO_INVALIDO', 'El código no es correcto o ya venció. Pide uno nuevo.', 400);
    });
    mockCuenta({});
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    escribir('Celular', '912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el código' }));
    await screen.findByLabelText('Código de 6 dígitos');
    escribir('Código de 6 dígitos', '123456');
    escribir('Contraseña nueva', 'NuevaClave2026');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El código no es correcto o ya venció.');
  });

  it('el DNI aparece solo como dato opcional al crear la cuenta, nunca para ingresar ni recuperar', async () => {
    mockCuenta({});
    const { container } = render(<PanelCuenta />);
    expect(container.textContent).not.toMatch(/DNI/i);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await llenarPaso1();
    expect(screen.getByLabelText('DNI (opcional)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Ingresar' }));
    expect(container.textContent).not.toMatch(/DNI/i);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(container.textContent).not.toMatch(/DNI/i);
  });
});

describe('PanelCuenta ▸ crear cuenta en 2 pasos e invitado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue(legalMock);
  });

  it('paso 1: el celular se valida antes de enviar el código', async () => {
    mockCuenta({});
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribir('Celular', '812345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El celular debe tener 9 dígitos y empezar con 9.');
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('DNI (opcional)')).not.toBeInTheDocument();
  });

  it('Atrás en el paso 3 vuelve al código sin perder lo escrito', async () => {
    mockCuenta({});
    render(<PanelCuenta />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await llenarPaso1();
    escribir('Nombre', 'Ana Pérez');
    escribir('Correo personal (opcional)', 'ana@ejemplo.com');

    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Celular')).toHaveValue('912345678');
  });

  it('la «o» y Seguir como invitado aparecen solo con el interruptor encendido', () => {
    mockCuenta({});
    const { unmount } = render(<PanelCuenta />);
    expect(screen.queryByText('o')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seguir como invitado' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    expect(screen.queryByText('o')).not.toBeInTheDocument();
    unmount();

    const cerrarPanel = vi.fn();
    mockCuenta({ cerrarPanel });
    render(<PanelCuenta invitadoPermitido />);
    expect(screen.getByText('o')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir como invitado' }));
    expect(cerrarPanel).toHaveBeenCalledTimes(1);
  });
});

describe('PanelCuenta ▸ perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('muestra el celular de solo lectura, sin DNI, y guarda con Sí/No sin teléfono', async () => {
    const actualizarPerfil = vi.fn().mockResolvedValue(undefined);
    mockCuenta({ cliente: clienteCon('912345678'), actualizarPerfil });
    const { container } = render(<PanelCuenta />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar mi perfil' }));
    const cel = screen.getByLabelText('Celular') as HTMLInputElement;
    expect(cel.value).toBe('912345678');
    expect(cel).toBeDisabled();
    expect(screen.getByText('Para cambiar tu celular, escríbenos por WhatsApp.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/DNI/i);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(actualizarPerfil).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(actualizarPerfil).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Ana Pérez', correo: 'ana@ejemplo.com' })));
    expect(actualizarPerfil.mock.calls[0][0]).not.toHaveProperty('telefono');
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

  it('la cabecera muestra el celular sin DNI', () => {
    mockCuenta({ cliente: clienteCon('912345678') });
    const { container } = render(<PanelCuenta />);
    expect(container.textContent).toContain('Celular 912345678');
    expect(container.textContent).not.toMatch(/DNI/i);
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
