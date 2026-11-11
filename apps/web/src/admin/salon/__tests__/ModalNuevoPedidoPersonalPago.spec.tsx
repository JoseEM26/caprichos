import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { continuarYEnviar, irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { PagoPersonalBloque, errorPagaConPersonal, textoPagoPersonal } from '../componentes/PagoPersonalBloque';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { listarPersonalActivo } from '../../creditos/creditosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn() }));

const carta = {
  categorias: [
    {
      id: 'cat-1', nombre: 'Bebidas', orden: 1,
      productos: [{ id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};

const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

function sesion(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p), usuario: { rol: 'MOZO' } } as any);
}

/** Para llevar, pedido del personal (María Soto) con un café, hasta el formulario final */
async function llegarAlFormularioFinal() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
  fireEvent.click(await screen.findByRole('button', { name: /María Soto/ }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'María' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  irAlPago();
}

describe('Pedido del personal en Nuevo pedido: bloque propio de pago', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([{ partyId: '2', nombre: 'María Soto', rol: 'MOZO', descuentoPct: 25 }]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: '9', codigo: 'CP-W009' } as any);
  });

  it('reemplaza el bloque genérico, va a crédito por defecto y el botón lo dice', async () => {
    sesion(['creditos/cobrar_ahora']);
    await llegarAlFormularioFinal();
    const bloque = await screen.findByTestId('pago-personal');
    expect(screen.queryByRole('group', { name: '¿Cómo paga?' })).toBeNull();
    expect(screen.queryByText('¿Con cuánto paga?')).toBeNull();
    expect(within(bloque).getByRole('button', { name: /Cargar a su crédito/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Enviar a cocina/ })).toHaveTextContent('se carga a su crédito');

    elegirBoleta();
    continuarYEnviar();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any;
    expect(payload.esPersonal).toBe(true);
    expect(payload.pagoPersonal).toEqual({ modo: 'CREDITO' });
    // El pago del personal NO usa el plan de pago normal: un plan vacío lo rechaza el servidor («necesita al menos un medio»)
    expect(payload.pago?.plan === undefined || payload.pago.plan.length > 0).toBe(true);
    expect(vi.mocked(api.post).mock.calls.some((c) => String(c[0]).includes('/creditos/saldar'))).toBe(false);
  });

  it('pagar ahora en efectivo: exige «con cuánto paga», «Pago exacto» lo llena y viaja en la misma llamada', async () => {
    sesion(['creditos/cobrar_ahora']);
    await llegarAlFormularioFinal();
    fireEvent.click(await screen.findByRole('button', { name: /Pagar ahora/ }));
    const medios = within(screen.getByRole('radiogroup', { name: 'Medio de pago' })).getAllByRole('radio').map((r) => r.textContent);
    expect(medios).toEqual(['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia']);
    expect(screen.getByRole('button', { name: /^Enviar a cocina/ })).toHaveTextContent('paga ahora en efectivo');

    continuarYEnviar();
    expect(await screen.findByText(/Indica con cuánto paga/)).toBeInTheDocument();
    expect(pedidosApi.crearPedidoAdmin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Pago exacto' }));
    expect((document.querySelector('#personal-paga-con') as HTMLInputElement).value).toBe('8.50');
    elegirBoleta();
    continuarYEnviar();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    const payloadAhora = vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any;
    expect(payloadAhora.pagoPersonal).toEqual({ modo: 'AHORA', medio: 'EFECTIVO', pagaCon: 8.5 });
    expect(payloadAhora.pago?.plan === undefined || payloadAhora.pago.plan.length > 0).toBe(true);
    expect(vi.mocked(api.post).mock.calls.some((c) => String(c[0]).includes('/creditos/saldar'))).toBe(false);
  });

  it('pagar ahora con Transferencia no pide «con cuánto paga»', async () => {
    sesion(['creditos/cobrar_ahora']);
    await llegarAlFormularioFinal();
    fireEvent.click(await screen.findByRole('button', { name: /Pagar ahora/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Transferencia' }));
    expect(screen.queryByLabelText(/¿Con cuánto paga\?/)).toBeNull();
    elegirBoleta();
    continuarYEnviar();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    expect((vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any).pagoPersonal).toEqual({ modo: 'AHORA', medio: 'TRANSFERENCIA', pagaCon: undefined });
  });

  it('sin el permiso creditos/cobrar_ahora solo existe «Cargar a su crédito»', async () => {
    sesion([]);
    await llegarAlFormularioFinal();
    await screen.findByTestId('pago-personal');
    expect(screen.queryByRole('button', { name: /Pagar ahora/ })).toBeNull();
  });
});

describe('PagoPersonalBloque (piezas)', () => {
  it('error de efectivo, texto del botón y vuelto', () => {
    expect(errorPagaConPersonal('credito', 'EFECTIVO', 20, '')).toBeNull();
    expect(errorPagaConPersonal('ahora', 'YAPE', 20, '')).toBeNull();
    expect(errorPagaConPersonal('ahora', 'EFECTIVO', 20, '')).toMatch(/Indica con cuánto paga/);
    expect(errorPagaConPersonal('ahora', 'EFECTIVO', 20, '15')).toMatch(/S\/ 20\.00 o más/);
    expect(errorPagaConPersonal('ahora', 'EFECTIVO', 20, '50')).toBeNull();
    expect(textoPagoPersonal('credito', 'EFECTIVO')).toBe('se carga a su crédito');
    expect(textoPagoPersonal('ahora', 'TRANSFERENCIA')).toBe('paga ahora en transferencia');
    render(<PagoPersonalBloque modo="ahora" onModo={() => {}} medio="EFECTIVO" onMedio={() => {}} total={20} pagaCon="50" onPagaCon={() => {}} puedeCobrarAhora error={null} mostrarError={false} />);
    expect(screen.getByTestId('personal-vuelto')).toHaveTextContent('Vuelto: S/ 30.00');
  });
});
