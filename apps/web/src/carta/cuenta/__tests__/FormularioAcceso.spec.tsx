import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as cuentaModulo from '../CuentaContext';
import { FormularioAcceso } from '../FormularioAcceso';
import { api, ErrorApi } from '../../../comun/api';
import { comprobantesApi } from '../../../admin/comprobantes/comprobantesApi';

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

const MENSAJE_CUENTA = 'Este celular ya tiene cuenta. Ingresa con tu contraseña o usa «¿Olvidaste tu contraseña?».';

const escribirCelular = (valor: string) => fireEvent.change(screen.getByLabelText('Celular'), { target: { value: valor } });

describe('FormularioAcceso: celular con cuenta o límite de códigos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCuenta();
    vi.spyOn(comprobantesApi, 'obtenerCartaLegal').mockResolvedValue({ terminos: '', privacidad: '', textoConsentimiento: '' } as any);
  });

  it('CUENTA_EXISTENTE: muestra el mensaje y ofrece «Ingresar» y «Olvidé mi contraseña»', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('CUENTA_EXISTENTE', MENSAJE_CUENTA, 409));
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_CUENTA);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Olvidé mi contraseña' })).toBeInTheDocument();
  });

  it('«Olvidé mi contraseña» cambia al modo de recuperar y conserva el celular', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('CUENTA_EXISTENTE', MENSAJE_CUENTA, 409));
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Olvidé mi contraseña' }));

    expect(screen.getByRole('button', { name: 'Enviarme el código' })).toBeInTheDocument();
    expect(screen.getByLabelText('Celular')).toHaveValue('912345678');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('«Ingresar» cambia al modo de ingreso', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('CUENTA_EXISTENTE', MENSAJE_CUENTA, 409));
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));

    expect(screen.getByRole('tab', { name: 'Ingresar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('límite por celular (429 DEMASIADOS_CODIGOS): muestra el aviso de esperar, sin ofrecer cambiar de modo', async () => {
    const msg = 'Pediste varios códigos seguidos. Espera una hora e inténtalo de nuevo.';
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('DEMASIADOS_CODIGOS', msg, 429));
    render(<FormularioAcceso alSeguirInvitado={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    escribirCelular('912345678');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código por WhatsApp' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(msg);
    expect(screen.queryByRole('button', { name: 'Olvidé mi contraseña' })).toBeNull();
  });
});
