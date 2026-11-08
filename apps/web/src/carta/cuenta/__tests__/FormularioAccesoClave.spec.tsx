import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { api, ErrorApi } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

const registrar = vi.fn();
const mockCuenta = () =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: null, panelAbierto: true, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar,
    actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(), salir: vi.fn(), refrescar: vi.fn(),
  } as any);

const celular = (v: string) => fireEvent.change(screen.getByLabelText('Celular'), { target: { value: v } });
const boton = (n: string) => fireEvent.click(screen.getByRole('button', { name: n }));

/** Código de 6 dígitos (modo CODIGO_PLANTILLA): el servidor responde sin `modo`. */
async function hastaPasoDatos(post: any) {
  post.mockResolvedValue({ ok: true });
  render(<StrictMode><FormularioAcceso alSeguirInvitado={vi.fn()} /></StrictMode>);
  fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
  celular('912345678');
  boton('Enviar código por WhatsApp');
  fireEvent.change(await screen.findByLabelText(/Código de 6 dígitos/), { target: { value: '123456' } });
  boton('Confirmar código');
  await screen.findByText('Paso 3 de 3');
}

function llenarDatos() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Crea tu contraseña'), { target: { value: 'ClaveSegura1' } });
  fireEvent.change(screen.getByLabelText(/cumpleaños/), { target: { value: '1990-03-14' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto el uso de mis datos' }));
}

describe('FormularioAcceso: crear contraseña y recuperar sin perder la cuenta', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    registrar.mockReset();
    mockCuenta();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue({ terminos: '', privacidad: '', textoConsentimiento: '' } as any);
  });

  it('código correcto: aparece la contraseña con sus requisitos, se verifica una sola vez y se crea la cuenta', async () => {
    const post = vi.spyOn(api, 'post');
    await hastaPasoDatos(post);
    expect(post.mock.calls.filter((c) => c[0] === '/carta/cuenta/registro/verificar')).toHaveLength(1);
    expect(screen.getByLabelText('Crea tu contraseña')).toBeInTheDocument();
    expect(screen.getByText(/Mínimo 8 caracteres/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Crea tu contraseña')).toHaveAttribute('type', 'text');

    llenarDatos();
    registrar.mockResolvedValue(undefined);
    boton('Crear cuenta');
    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ telefono: '912345678', contrasena: 'ClaveSegura1', nombre: 'Ana', aceptaDatos: true }));
  });

  it('si crear la cuenta falla, el mensaje se ve y se queda en el paso de contraseña para reintentar', async () => {
    await hastaPasoDatos(vi.spyOn(api, 'post'));
    llenarDatos();
    registrar.mockRejectedValueOnce(new ErrorApi('ERROR', 'Ese celular ya esta registrado en otra persona', 409));
    boton('Crear cuenta');
    expect(await screen.findByRole('alert')).toHaveTextContent('otra persona');
    expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Crea tu contraseña')).toHaveValue('ClaveSegura1');
  });

  it('verificación vencida (CELULAR_NO_VERIFICADO): vuelve al paso del celular con un aviso claro', async () => {
    await hastaPasoDatos(vi.spyOn(api, 'post'));
    llenarDatos();
    registrar.mockRejectedValueOnce(new ErrorApi('CELULAR_NO_VERIFICADO', 'Primero confirma tu celular', 400));
    boton('Crear cuenta');
    expect(await screen.findByRole('alert')).toHaveTextContent('verificación venció');
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
  });

  it('recuperar con un celular que solo tenía puntos (SIN_CUENTA): pasa a crear la cuenta con el celular ya verificado', async () => {
    const post = vi.spyOn(api, 'post');
    post.mockResolvedValueOnce({ ok: true, mensaje: 'Si ese celular tiene cuenta...' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    boton('¿Olvidaste tu contraseña?');
    celular('912345678');
    boton('Enviarme el código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'ClaveSegura1' } });
    post.mockRejectedValueOnce(new ErrorApi('SIN_CUENTA', 'Ese celular aún no tiene cuenta. Créala ahora: tus puntos se conservan.', 400));
    boton('Cambiar mi contraseña');
    expect(await screen.findByText('Paso 3 de 3')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('tus puntos se conservan');
    expect(screen.getByText('912345678')).toBeInTheDocument();
    expect(screen.getByLabelText('Crea tu contraseña')).toHaveValue('');
  });

  it('recuperar con cuenta: manda código y contraseña nueva, y muestra el aviso de éxito; el reenvío espera 60 s', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    boton('¿Olvidaste tu contraseña?');
    celular('912345678');
    boton('Enviarme el código');
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos'), { target: { value: '654321' } });
    expect(screen.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'ClaveSegura1' } });
    boton('Cambiar mi contraseña');
    await screen.findByText(/cambiaste tu contraseña/);
    expect(post).toHaveBeenLastCalledWith('/carta/cuenta/recuperar/confirmar', { telefono: '912345678', codigo: '654321', contrasenaNueva: 'ClaveSegura1' });
  });

  it('desde recuperar se puede ir a «Crear cuenta»', () => {
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    boton('¿Olvidaste tu contraseña?');
    fireEvent.click(screen.getByRole('button', { name: /¿No tienes cuenta\? Crear cuenta/ }));
    expect(screen.getByRole('tab', { name: 'Crear cuenta' })).toHaveAttribute('aria-selected', 'true');
  });
});
