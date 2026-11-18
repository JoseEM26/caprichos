import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { VerificacionWhatsapp } from '../VerificacionWhatsapp';
import { api, ErrorApi } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

/** Respuesta del servidor en modo WHATSAPP_ENTRANTE (token de un solo uso y enlace wa.me). */
const RESPUESTA_WA = (token: string) => ({
  ok: true,
  modo: 'WHATSAPP_ENTRANTE',
  token,
  enlace: `https://wa.me/51999000111?text=${encodeURIComponent(`Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`)}`,
  vence_seg: 600,
  mensaje: 'Toca el botón, envía el mensaje en WhatsApp y vuelve aquí. Vence en 10 minutos.',
});

const AVISO = 'Tu WhatsApp oculta tu número. Te mandamos un código por WhatsApp.';
const ESPERA_SONDEO = { timeout: 4000 };

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

describe('VerificacionWhatsapp: sondeo con sin_numero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('al recibir sin_numero avisa al padre una sola vez y deja de sondear', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ estado: 'sin_numero' });
    const alSinNumero = vi.fn();
    render(
      <VerificacionWhatsapp token="ABCD2345" enlace="https://wa.me/51999000111" alVerificar={vi.fn()} alSinNumero={alSinNumero} alReenviar={vi.fn()} puedeReenviar={false} esperaSeg={0} />,
    );
    await waitFor(() => expect(alSinNumero).toHaveBeenCalledTimes(1), ESPERA_SONDEO);
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    const llamadas = get.mock.calls.length;
    await new Promise((r) => setTimeout(r, 2500));
    expect(get.mock.calls.length).toBe(llamadas);
    expect(alSinNumero).toHaveBeenCalledTimes(1);
  });
});

describe('FormularioAcceso: WhatsApp oculta el número (sin_numero) pasa al código de 6 dígitos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCuenta();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue({ terminos: '', privacidad: '', textoConsentimiento: '' } as any);
  });

  it('el sondeo devuelve sin_numero: pide el código con forzarCodigo, muestra el mensaje y el campo de 6 dígitos', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (ruta: string, cuerpo: any) => {
      if (ruta === '/carta/cuenta/registro/codigo' && cuerpo?.forzarCodigo) return { ok: true, mensaje: 'Te enviamos un código por WhatsApp. Vence en 10 minutos.' };
      if (ruta === '/carta/cuenta/registro/codigo') return RESPUESTA_WA('ABCD2345');
      return { ok: true };
    });
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'sin_numero' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '999000111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)', {}, ESPERA_SONDEO)).toBeInTheDocument();
    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp y enviar mensaje' })).toBeNull();
    expect(post).toHaveBeenCalledWith('/carta/cuenta/registro/codigo', { telefono: '999000111', forzarCodigo: true });
  });

  it('con el código de 6 dígitos el registro sigue: verifica y pasa a «Crea tu contraseña»', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (ruta: string, cuerpo: any) => {
      if (ruta === '/carta/cuenta/registro/codigo' && cuerpo?.forzarCodigo) return { ok: true, mensaje: 'Te enviamos un código por WhatsApp. Vence en 10 minutos.' };
      if (ruta === '/carta/cuenta/registro/codigo') return RESPUESTA_WA('ABCD2345');
      return { ok: true };
    });
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'sin_numero' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '999000111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    fireEvent.change(await screen.findByLabelText('Código de 6 dígitos (llega por WhatsApp)', {}, ESPERA_SONDEO), { target: { value: '428193' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/cuenta/registro/verificar', { telefono: '999000111', codigo: '428193' }));
    expect(await screen.findByLabelText('Crea tu contraseña')).toBeInTheDocument();
  });

  it('si el envío del código falla (503), muestra el error amable y no avanza', async () => {
    vi.spyOn(api, 'post').mockImplementation(async (ruta: string, cuerpo: any) => {
      if (ruta === '/carta/cuenta/registro/codigo' && cuerpo?.forzarCodigo) {
        throw new ErrorApi('CODIGO_NO_ENVIADO', 'No pudimos enviar el código por WhatsApp en este momento. Intenta de nuevo en unos minutos.', 503);
      }
      return RESPUESTA_WA('ABCD2345');
    });
    vi.spyOn(api, 'get').mockResolvedValue({ estado: 'sin_numero' });
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Celular'), { target: { value: '999000111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByRole('alert', {}, ESPERA_SONDEO)).toHaveTextContent('No pudimos enviar el código por WhatsApp');
    expect(screen.queryByLabelText('Código de 6 dígitos (llega por WhatsApp)')).toBeNull();
  });
});
