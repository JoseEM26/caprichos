import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaUmbralesAlertasEspera } from '../TarjetaUmbralesAlertasEspera';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
  ErrorApi: class extends Error {
    codigo: string;
    constructor(codigo: string, mensaje: string) {
      super(mensaje);
      this.codigo = codigo;
    }
  },
}));

vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { rol: 'ADMIN' },
    tiene: vi.fn().mockReturnValue(true),
  }),
}));

describe('TarjetaUmbralesAlertasEspera (Panel esp-web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza la tarjeta si el usuario no es ADMIN', () => {
    const { container } = render(<TarjetaUmbralesAlertasEspera esAdmin={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la tarjeta para ADMIN con los 5 umbrales por defecto', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]); // sin valores en BD, usa sembrados por defecto

    render(<TarjetaUmbralesAlertasEspera esAdmin={true} />);

    expect(await screen.findByText('Umbrales de alertas y espera')).toBeInTheDocument();
    expect(screen.getByText('Solo ADMIN')).toBeInTheDocument();

    const inputV1 = screen.getByLabelText(/primer aviso de voucher sin revisar/i) as HTMLInputElement;
    const inputV2 = screen.getByLabelText(/segundo aviso y urgente voucher/i) as HTMLInputElement;
    const inputCliente = screen.getByLabelText(/aviso de espera al cliente/i) as HTMLInputElement;
    const inputLiberar = screen.getByLabelText(/liberar chat tomado y abandonado/i) as HTMLInputElement;
    const inputPedido = screen.getByLabelText(/aviso pedido sin confirmar en caja/i) as HTMLInputElement;

    expect(inputV1.value).toBe('5');
    expect(inputV2.value).toBe('15');
    expect(inputCliente.value).toBe('10');
    expect(inputLiberar.value).toBe('10');
    expect(inputPedido.value).toBe('5');
  });

  it('carga valores existentes desde /admin/configuracion', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      { clave: 'alerta_voucher_min_1', valor: 6 },
      { clave: 'alerta_voucher_min_2', valor: 18 },
      { clave: 'espera_cliente_aviso_min', valor: 12 },
      { clave: 'chat_tomado_liberar_min', valor: 8 },
      { clave: 'alerta_pedido_sin_confirmar_min', valor: 7 },
    ]);

    render(<TarjetaUmbralesAlertasEspera esAdmin={true} />);

    await screen.findByText('Umbrales de alertas y espera');

    const inputV1 = screen.getByLabelText(/primer aviso de voucher sin revisar/i) as HTMLInputElement;
    expect(inputV1.value).toBe('6');

    const inputV2 = screen.getByLabelText(/segundo aviso y urgente voucher/i) as HTMLInputElement;
    expect(inputV2.value).toBe('18');
  });

  it('valida que los umbrales no sean menores o iguales a 0', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    render(<TarjetaUmbralesAlertasEspera esAdmin={true} />);

    await screen.findByText('Umbrales de alertas y espera');

    const inputV1 = screen.getByLabelText(/primer aviso de voucher sin revisar/i);
    fireEvent.change(inputV1, { target: { value: '0' } });

    const btnGuardar = screen.getByRole('button', { name: /guardar umbrales/i });
    fireEvent.click(btnGuardar);

    expect(
      screen.getByText(/debe ser un número entero mayor a 0/i),
    ).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('guarda los 5 parámetros vía PUT /admin/configuracion/:clave tras confirmar en modal', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    render(<TarjetaUmbralesAlertasEspera esAdmin={true} />);

    await screen.findByText('Umbrales de alertas y espera');

    const inputV1 = screen.getByLabelText(/primer aviso de voucher sin revisar/i);
    fireEvent.change(inputV1, { target: { value: '7' } });

    const btnGuardar = screen.getByRole('button', { name: /guardar umbrales/i });
    fireEvent.click(btnGuardar);

    // Diálogo Confirmar Sí/No
    expect(screen.getByText('¿Guardar umbrales de alerta y espera?')).toBeInTheDocument();

    vi.mocked(api.put).mockResolvedValue({ clave: '', valor: 0 });

    const btnSi = screen.getByRole('button', { name: 'Sí, guardar' });
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/admin/configuracion/alerta_voucher_min_1', { valor: 7 });
      expect(api.put).toHaveBeenCalledWith('/admin/configuracion/alerta_voucher_min_2', { valor: 15 });
      expect(api.put).toHaveBeenCalledWith('/admin/configuracion/espera_cliente_aviso_min', { valor: 10 });
      expect(api.put).toHaveBeenCalledWith('/admin/configuracion/chat_tomado_liberar_min', { valor: 10 });
      expect(api.put).toHaveBeenCalledWith('/admin/configuracion/alerta_pedido_sin_confirmar_min', { valor: 5 });
    });

    expect(await screen.findByText(/guardado a las/i)).toBeInTheDocument();
  });

  it('no contiene emojis en sus textos ni botones', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    const { container } = render(<TarjetaUmbralesAlertasEspera esAdmin={true} />);
    await screen.findByText('Umbrales de alertas y espera');

    const textoCompleto = container.textContent || '';
    const regexEmojis = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(regexEmojis.test(textoCompleto)).toBe(false);
  });
});
