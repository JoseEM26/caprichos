import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { api } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

/** Respuesta del servidor en modo WHATSAPP_ENTRANTE (token de un solo uso y enlace wa.me). */
const RESPUESTA_WA = (token: string) => ({
  ok: true,
  modo: 'WHATSAPP_ENTRANTE',
  token,
  enlace: `https://wa.me/51914244077?text=${encodeURIComponent(`Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`)}`,
  vence_seg: 600,
  mensaje: 'Toca el botón, envía el mensaje en WhatsApp y vuelve aquí. Vence en 10 minutos.',
});

const mockCuenta = () =>
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: null,
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
  } as any);

const escribirCelular = (valor: string) => fireEvent.change(screen.getByLabelText('Celular'), { target: { value: valor } });

/** Sondeo cada 2 s: el primer resultado llega a los ~2 s. */
const ESPERA_SONDEO = { timeout: 4000 };

describe('FormularioAcceso en modo WHATSAPP_ENTRANTE (crear cuenta)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCuenta();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue({ terminos: '', privacidad: '', textoConsentimiento: '' } as any);
  });

  it('muestra el botón a WhatsApp con el enlace, y no pide ningún código de 6 dígitos', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(RESPUESTA_WA('ABCD2345'));
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'pendiente' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    const enlace = await screen.findByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' });
    expect(enlace.getAttribute('href')).toContain('https://wa.me/51914244077?text=');
    expect(enlace.getAttribute('href')).toContain(encodeURIComponent('Mi código: ABCD2345'));
    expect(screen.queryByLabelText(/Código de 6 dígitos/)).toBeNull();
    expect(screen.getByText(/Esperando tu mensaje de WhatsApp/)).toBeInTheDocument();
  });

  it('cuando el servidor confirma el celular, pasa sola al paso de datos', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(RESPUESTA_WA('ABCD2345'));
    const get = vi.spyOn(api, 'get').mockResolvedValue({ estado: 'verificado' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByText('Paso 3 de 3', {}, ESPERA_SONDEO)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/carta/cuenta/verificar/estado?token=ABCD2345');
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });

  it('con el estado pendiente se queda esperando', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(RESPUESTA_WA('ABCD2345'));
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'pendiente' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    await screen.findByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' });
    await new Promise((r) => setTimeout(r, 2300));
    expect(screen.getByText('Paso 2 de 3')).toBeInTheDocument();
  });

  it('con el token vencido ofrece pedir un enlace nuevo', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(RESPUESTA_WA('ABCD2345'));
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'vencido' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByText('El enlace venció. Pide uno nuevo.', {}, ESPERA_SONDEO)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir un enlace nuevo' })).toBeInTheDocument();
  });
});

describe('FormularioAcceso en modo CODIGO_PLANTILLA (anterior)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCuenta();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue({ terminos: '', privacidad: '', textoConsentimiento: '' } as any);
  });

  it('si el servidor no manda modo WHATSAPP_ENTRANTE, pide el código de 6 dígitos como antes', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true, mensaje: 'Te enviamos un código por WhatsApp. Vence en 10 minutos.' });
    const get = vi.spyOn(api, 'get');
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' })).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('FormularioAcceso en modo WHATSAPP_ENTRANTE (recuperar contraseña)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCuenta();
  });

  it('no deja cambiar la contraseña hasta que el celular llegue por WhatsApp, y luego la cambia sin código', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (ruta: string) => {
      if (ruta === '/carta/cuenta/recuperar/solicitar') return RESPUESTA_WA('QWER2345');
      return { ok: true };
    });
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'verificado' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Enviarme el código' }));

    expect(await screen.findByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'clave-nueva-123' } });
    // Mientras no llegue el mensaje, no se puede confirmar
    expect(screen.getByRole('button', { name: 'Cambiar mi contraseña' })).toBeDisabled();

    // Llega el mensaje: el sondeo ya marca verificado y el botón se habilita
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar mi contraseña' })).toBeEnabled(), ESPERA_SONDEO);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi contraseña' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/cuenta/recuperar/confirmar', { telefono: '914244077', contrasenaNueva: 'clave-nueva-123' }));
  });
});
