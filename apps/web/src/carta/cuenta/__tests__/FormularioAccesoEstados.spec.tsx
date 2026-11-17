import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { api, ErrorApi } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

const mockCuenta = (registrar = vi.fn().mockResolvedValue(undefined)) =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: null,
    panelAbierto: true,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
    ingresar: vi.fn(),
    registrar,
    actualizarPerfil: vi.fn(),
    subirFoto: vi.fn(),
    quitarFoto: vi.fn(),
    salir: vi.fn(),
    refrescar: vi.fn(),
  } as any);

/** Lleva el formulario a «Crear cuenta», paso 1, con un celular escrito. */
const irAPasoCelular = () => {
  fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
  fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '999000111' } });
};

describe('FormularioAcceso: estados de crear cuenta', () => {
  beforeEach(() => {
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockRejectedValue(new Error('sin legal'));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sin red: muestra «No hay conexión», no el texto técnico del navegador', async () => {
    mockCuenta();
    vi.spyOn(api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));
    render(<FormularioAcceso alSeguirInvitado={() => {}} />);
    irAPasoCelular();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión. Revisa tu internet e inténtalo de nuevo.'));
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });

  it('el servidor dice que el código no salió: se muestra su mensaje claro y no se avanza al paso del código', async () => {
    mockCuenta();
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('CODIGO_NO_ENVIADO', 'No pudimos enviar el código por WhatsApp en este momento. Intenta de nuevo en unos minutos.', 503));
    render(<FormularioAcceso alSeguirInvitado={() => {}} />);
    irAPasoCelular();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos enviar el código'));
    expect(screen.queryByLabelText('Código de 6 dígitos (llega por WhatsApp)')).toBeNull();
  });

  it('reenviar muestra la cuenta regresiva y el campo del código recibe el foco', async () => {
    mockCuenta();
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true, mensaje: 'Te enviamos un código por WhatsApp. Vence en 10 minutos.' });
    render(<FormularioAcceso alSeguirInvitado={() => {}} />);
    irAPasoCelular();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    const campo = await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)');
    expect(campo).toHaveFocus();
    expect(screen.getByRole('button', { name: /Reenviar código en \d+ s/ })).toBeDisabled();
  });

  it('crear cuenta: al terminar avisa del éxito al padre y registra con el celular verificado', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    mockCuenta(registrar);
    const alCrearCuenta = vi.fn();
    vi.spyOn(api, 'post').mockImplementation(async (ruta: string) =>
      ruta.endsWith('/registro/codigo') ? { ok: true, mensaje: 'enviado' } : { ok: true },
    );
    render(<FormularioAcceso alSeguirInvitado={() => {}} alCrearCuenta={alCrearCuenta} />);
    irAPasoCelular();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Ana Prueba' } });
    fireEvent.change(screen.getByLabelText('Tu cumpleaños, para saludarte'), { target: { value: '1990-05-10' } });
    fireEvent.change(screen.getByLabelText('Crea tu contraseña'), { target: { value: 'clave-prueba-1' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acepto el uso de mis datos' }));
    expect(alCrearCuenta).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(alCrearCuenta).toHaveBeenCalledTimes(1));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ telefono: '999000111', nombre: 'Ana Prueba', aceptaDatos: true }));
  });
});
