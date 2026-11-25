import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { AYUDA_REENVIO, VerificacionWhatsapp } from '../VerificacionWhatsapp';
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

  it('pide la contraseña nueva recién cuando el celular llega por WhatsApp (2 pasos) y la cambia sin código', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (ruta: string) => {
      if (ruta === '/carta/cuenta/recuperar/solicitar') return RESPUESTA_WA('QWER2345');
      return { ok: true };
    });
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'verificado' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    escribirCelular('914244077');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' })).toBeInTheDocument();
    // Paso 1 de 2: mientras no llegue el mensaje no hay contraseña ni botón que confundan
    expect(screen.getByTestId('paso-recuperar')).toHaveTextContent('Paso 1 de 2: confirma que el celular 914244077 es tuyo');
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cambiar mi contraseña' })).toBeNull();

    // Llega el mensaje: paso 2 con la contraseña nueva
    const campo = await screen.findByLabelText('Contraseña nueva', undefined, ESPERA_SONDEO);
    expect(screen.getByTestId('paso-recuperar')).toHaveTextContent('Paso 2 de 2: crea tu contraseña nueva');
    fireEvent.change(campo, { target: { value: 'clave-nueva-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi contraseña' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/cuenta/recuperar/confirmar', { telefono: '914244077', contrasenaNueva: 'clave-nueva-123' }));
  });
});

describe('VerificacionWhatsapp: si el mensaje no llega', () => {
  it('junto al reenvío aparece la línea de ayuda y la cuenta regresiva llega a «Reenviar» sin pasar de 60 s', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'pendiente' });
    const { rerender } = render(
      <VerificacionWhatsapp token="ABCD2345" enlace="https://wa.me/51914244077" alVerificar={vi.fn()} alReenviar={vi.fn()} puedeReenviar={false} esperaSeg={60} />,
    );
    expect(screen.getByText(AYUDA_REENVIO)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar en 60 s' })).toBeDisabled();
    rerender(<VerificacionWhatsapp token="ABCD2345" enlace="https://wa.me/51914244077" alVerificar={vi.fn()} alReenviar={vi.fn()} puedeReenviar esperaSeg={0} />);
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeEnabled();
  });

  it('en el registro por WhatsApp, el reenvío se habilita a los 60 s y la línea de ayuda queda visible', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(api, 'post').mockResolvedValue(RESPUESTA_WA('ABCD2345'));
      vi.spyOn(api, 'get').mockResolvedValue({ estado: 'pendiente' });
      render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
      escribirCelular('914244077');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
      });
      await act(async () => {});
      expect(screen.getByText(AYUDA_REENVIO)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reenviar en 60 s' })).toBeDisabled();
      // Un tick por segundo: cada tick reprograma la cuenta regresiva al re-renderizar
      for (let i = 0; i < 59; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1_000);
        });
      }
      expect(screen.getByRole('button', { name: 'Reenviar en 1 s' })).toBeDisabled();
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByRole('button', { name: 'Reenviar' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('tras 60 s sin verificar explica qué revisar, en vez de quedarse mudo', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(api, 'get').mockResolvedValue({ estado: 'pendiente' });
      render(
        <VerificacionWhatsapp token="ABCD2345" enlace="https://wa.me/51914244077" alVerificar={vi.fn()} alReenviar={vi.fn()} puedeReenviar />,
      );
      expect(screen.queryByText(/no avanza/)).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      expect(screen.getByText(/no avanza/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
