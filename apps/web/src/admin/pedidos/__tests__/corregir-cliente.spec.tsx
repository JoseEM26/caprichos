import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { ModalCorregirCliente, errorCelular } from '../ModalCorregirCliente';
import { Pedido, pedidosApi } from '../pedidosApi';

let permisos: string[] = ['pedidos/corregir_cliente'];
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario: null }),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const pedido = (extra: Partial<Pedido> = {}) =>
  ({ id: '7', codigo: 'CP-W007', canal: 'CAJA', modalidad: 'DELIVERY', estado: 'ENTREGADO', pago_estado: 'PAGADO', subtotal: 20, descuento: 0, total: 20, lineas: [], cliente_nombre: 'Ana', cliente_telefono: '987654320', entrega_direccion: 'Av. Uno', entrega_referencia: '', ...extra }) as unknown as Pedido;

beforeEach(() => {
  permisos = ['pedidos/corregir_cliente'];
  vi.restoreAllMocks();
});

describe('Corregir datos del cliente ▸ botón', () => {
  // El botón vive en la capa «Cliente y entrega»
  const ver = (p: Pedido) => {
    const r = render(<MemoryRouter><PedidoDetalle pedido={p} alActualizar={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Cliente y entrega' }));
    return r;
  };
  it('con permiso aparece, también en un pedido entregado y cobrado, y abre el modal', () => {
    ver(pedido());
    fireEvent.click(screen.getByRole('button', { name: 'Corregir datos del cliente' }));
    expect(screen.getByRole('dialog', { name: 'Corregir datos del cliente' })).toBeTruthy();
  });
  it('sin permiso o con pedido anulado/rechazado no aparece', () => {
    permisos = [];
    ver(pedido());
    expect(screen.queryByRole('button', { name: 'Corregir datos del cliente' })).toBeNull();
  });
  it.each(['ANULADO', 'RECHAZADO'])('no aparece en %s', (estado) => {
    ver(pedido({ estado } as any));
    expect(screen.queryByRole('button', { name: 'Corregir datos del cliente' })).toBeNull();
  });
});

describe('Corregir datos del cliente ▸ modal', () => {
  it('valida el celular en vivo', () => {
    expect(errorCelular('')).toMatch(/Escribe/);
    expect(errorCelular('887654321')).toMatch(/empezar con 9/);
    expect(errorCelular('9876')).toMatch(/Faltan 5/);
    expect(errorCelular('9876543210')).toMatch(/Sobran/);
    expect(errorCelular('987654321')).toBe('');
  });

  it('con celular inválido bloquea Guardar y Probar en WhatsApp', () => {
    render(<ModalCorregirCliente pedido={pedido()} alCerrar={() => {}} alGuardar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Celular / WhatsApp'), { target: { value: '8123' } });
    expect(screen.getByText(/empezar con 9/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Probar en WhatsApp' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Probar en WhatsApp abre wa.me/51<número> en pestaña nueva', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ModalCorregirCliente pedido={pedido()} alCerrar={() => {}} alGuardar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar en WhatsApp' }));
    expect(abrir).toHaveBeenCalledWith('https://wa.me/51987654320', '_blank', 'noopener');
  });

  it('guarda con dirección y referencia en delivery, y cierra', async () => {
    const api = vi.spyOn(pedidosApi, 'corregirCliente').mockResolvedValue({ avisosPendientes: 0, numeroDeCuenta: null });
    const alGuardar = vi.fn();
    render(<ModalCorregirCliente pedido={pedido()} alCerrar={() => {}} alGuardar={alGuardar} />);
    fireEvent.change(screen.getByLabelText('Celular / WhatsApp'), { target: { value: '987654321' } });
    fireEvent.change(screen.getByLabelText('Referencia'), { target: { value: 'Portón negro' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Error al escribir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(alGuardar).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('7', { nombre: 'Ana', telefono: '987654321', direccion: 'Av. Uno', referencia: 'Portón negro', motivo: 'Error al escribir' });
  });

  it('si no es delivery no pide ni envía dirección', async () => {
    const api = vi.spyOn(pedidosApi, 'corregirCliente').mockResolvedValue({ avisosPendientes: 0, numeroDeCuenta: null });
    render(<ModalCorregirCliente pedido={pedido({ modalidad: 'RECOGER' } as any)} alCerrar={() => {}} alGuardar={() => {}} />);
    expect(screen.queryByLabelText('Dirección')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(api.mock.calls[0][1]).not.toHaveProperty('direccion');
  });

  it('muestra el error del servidor y no cierra', async () => {
    vi.spyOn(pedidosApi, 'corregirCliente').mockRejectedValue(new Error('Pedido anulado'));
    const alGuardar = vi.fn();
    render(<ModalCorregirCliente pedido={pedido()} alCerrar={() => {}} alGuardar={alGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Pedido anulado')).toBeTruthy();
    expect(alGuardar).not.toHaveBeenCalled();
  });
});
