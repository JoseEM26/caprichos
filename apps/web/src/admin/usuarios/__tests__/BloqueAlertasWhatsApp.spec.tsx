import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BloqueAlertasWhatsApp } from '../BloqueAlertasWhatsApp';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
  ErrorApi: class extends Error {
    codigo: string;
    constructor(codigo: string, mensaje: string) {
      super(mensaje);
      this.codigo = codigo;
    }
  },
}));

describe('BloqueAlertasWhatsApp (Panel esp-web)', () => {
  const usuarioId = 'usr-admin-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada si el rol no es ADMIN', () => {
    const { container } = render(
      <BloqueAlertasWhatsApp usuarioId={usuarioId} rol="CAJERO" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza para rol ADMIN con prefijo visual +51 y estado inicial', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: '987654321',
      activa: true,
      confirmado: true,
      confirmadoEn: '2026-10-27T10:00:00Z',
      estado: 'Confirmado',
    });

    render(<BloqueAlertasWhatsApp usuarioId={usuarioId} rol="ADMIN" />);

    expect(await screen.findByText('Alertas por WhatsApp')).toBeInTheDocument();
    expect(screen.getByTestId('prefijo-visual-51')).toHaveTextContent('+51');

    const inputNumero = screen.getByLabelText(/celular para alertas/i) as HTMLInputElement;
    expect(inputNumero.value).toBe('987654321');

    const casilla = screen.getByLabelText(/recibir alertas por whatsapp/i) as HTMLInputElement;
    expect(casilla.checked).toBe(true);

    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('muestra estado Pendiente de confirmar y permite solicitar mensaje de prueba con Confirmar Sí/No', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: '987654321',
      activa: true,
      confirmado: false,
      confirmadoEn: null,
      estado: 'Pendiente de confirmar',
    });

    render(<BloqueAlertasWhatsApp usuarioId={usuarioId} rol="ADMIN" />);

    expect(await screen.findByText('Pendiente de confirmar')).toBeInTheDocument();

    const btnPrueba = screen.getByRole('button', { name: /enviar prueba de nuevo/i });
    expect(btnPrueba).toBeInTheDocument();

    // Click abre modal Confirmar Sí/No
    fireEvent.click(btnPrueba);

    expect(screen.getByText('¿Enviar mensaje de prueba?')).toBeInTheDocument();
    expect(screen.getByText(/se enviará un mensaje interactivo por whatsapp/i)).toBeInTheDocument();

    vi.mocked(api.post).mockResolvedValueOnce({ ok: true, mensaje: 'Prueba enviada' });
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: '987654321',
      activa: true,
      confirmado: false,
      estado: 'Pendiente de confirmar',
    });

    const btnSi = screen.getByRole('button', { name: 'Sí, enviar prueba' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/admin/usuarios/${usuarioId}/alertas-whatsapp/enviar-prueba`,
        {},
      );
    });
  });

  it('valida número celular peruano de 9 dígitos empezando con 9 al guardar', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: null,
      activa: false,
      confirmado: false,
      estado: 'Sin alertas',
    });

    render(<BloqueAlertasWhatsApp usuarioId={usuarioId} rol="ADMIN" />);

    await screen.findByText('Sin alertas');

    const casilla = screen.getByLabelText(/recibir alertas por whatsapp/i);
    fireEvent.click(casilla);

    const inputNumero = screen.getByLabelText(/celular para alertas/i);
    fireEvent.change(inputNumero, { target: { value: '123456789' } }); // no empieza con 9

    const btnGuardar = screen.getByRole('button', { name: /guardar alertas/i });
    fireEvent.click(btnGuardar);

    expect(
      screen.getByText('Debe ser un celular peruano de 9 dígitos que empiece con 9'),
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('guarda con Confirmar Sí/No y actualiza el estado', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: null,
      activa: false,
      confirmado: false,
      estado: 'Sin alertas',
    });

    render(<BloqueAlertasWhatsApp usuarioId={usuarioId} rol="ADMIN" />);

    await screen.findByText('Sin alertas');

    const casilla = screen.getByLabelText(/recibir alertas por whatsapp/i);
    fireEvent.click(casilla);

    const inputNumero = screen.getByLabelText(/celular para alertas/i);
    fireEvent.change(inputNumero, { target: { value: '999888777' } });

    const btnGuardar = screen.getByRole('button', { name: /guardar alertas/i });
    fireEvent.click(btnGuardar);

    // Diálogo Confirmar Sí/No
    expect(screen.getByText('¿Guardar configuración de alertas?')).toBeInTheDocument();

    vi.mocked(api.put).mockResolvedValueOnce({
      numero: '51999888777',
      activa: true,
      confirmado: false,
      estado: 'Pendiente de confirmar',
    });

    const btnSi = screen.getByRole('button', { name: 'Sí, guardar' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        `/admin/usuarios/${usuarioId}/alertas-whatsapp`,
        {
          numero: '999888777',
          activa: true,
        },
      );
    });

    expect(await screen.findByText('Alertas guardadas correctamente.')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de confirmar')).toBeInTheDocument();
  });

  it('no contiene emojis en sus textos ni botones', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      numero: '987654321',
      activa: true,
      confirmado: true,
      estado: 'Confirmado',
    });

    const { container } = render(<BloqueAlertasWhatsApp usuarioId={usuarioId} rol="ADMIN" />);
    await screen.findByText('Alertas por WhatsApp');

    const textoCompleto = container.textContent || '';
    const regexEmojis = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(regexEmojis.test(textoCompleto)).toBe(false);
  });
});
