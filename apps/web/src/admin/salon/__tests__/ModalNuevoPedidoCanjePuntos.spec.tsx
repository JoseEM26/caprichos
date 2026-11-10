import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { CanjePuntosLocal } from '../componentes/CanjePuntosLocal';
import { motivoSinCanje, puntosDeTexto, topeCanjeLocal } from '../componentes/puntosLocal';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { api } from '../../../comun/api';

vi.mock('../useSalonSocket', () => ({ useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }) }));
vi.mock('../api', () => ({ salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn(async () => []) }));

const carta = {
  categorias: [
    {
      id: 'c1', nombre: 'Bebidas', orden: 1,
      productos: [{ id: 'p1', nombre: 'Café Americano', descripcion: '', fotoUrl: null, precio: 20, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};
const cuentaAna = { encontrado: true, party: '100', nombre: 'Ana Pérez', telefono: '987654321', puntos: 12.5, direcciones: [] };
let respuestaCuenta: any = cuentaAna;

describe('puntosLocal (reglas del canje en Caja y mozo)', () => {
  it('tope = min(saldo, elegible) sin decimales', () => {
    expect(topeCanjeLocal(12.5, 20)).toBe(12);
    expect(topeCanjeLocal(50, 8.5)).toBe(8);
    expect(topeCanjeLocal(50, null)).toBe(0);
  });
  it('motivos: personal, cupón, invitado, sin saldo, sin elegible; null si se puede', () => {
    const base = { personal: false, cupon: false, tieneCuenta: true, saldo: 10, canjeable: 20 };
    expect(motivoSinCanje(base)).toBeNull();
    expect(motivoSinCanje({ ...base, personal: true })).toMatch(/personal/);
    expect(motivoSinCanje({ ...base, cupon: true })).toMatch(/cupón/);
    expect(motivoSinCanje({ ...base, tieneCuenta: false })).toMatch(/invitado/);
    expect(motivoSinCanje({ ...base, saldo: 0.5 })).toMatch(/suficientes/);
    expect(motivoSinCanje({ ...base, canjeable: 0 })).toMatch(/sin descuento ni promoción/);
  });
  it('puntosDeTexto recorta al tope y descarta decimales', () => {
    expect(puntosDeTexto('', 10)).toBe(0);
    expect(puntosDeTexto('99', 10)).toBe(10);
    expect(puntosDeTexto('3.7', 10)).toBe(10);
  });
});

describe('CanjePuntosLocal', () => {
  const props = { tieneCuenta: true, saldo: 12.5, canjeable: 20, personal: false, cupon: false, valor: '', alCambiar: vi.fn() };
  it('muestra el saldo y «Usar máximo» pone min(saldo, elegible)', () => {
    const alCambiar = vi.fn();
    render(<CanjePuntosLocal {...props} alCambiar={alCambiar} />);
    expect(screen.getByText(/saldo 12 pts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Usar máximo \(12\)/ }));
    expect(alCambiar).toHaveBeenCalledWith('12');
  });
  it.each([
    ['cupón', { cupon: true }, /cupón/],
    ['personal', { personal: true }, /personal/],
    ['invitado', { tieneCuenta: false, saldo: 0 }, /invitado/],
  ])('deshabilitado y explicado con %s', (_n, extra, texto) => {
    render(<CanjePuntosLocal {...props} {...(extra as any)} />);
    expect(screen.getByLabelText('Puntos a canjear')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Usar máximo/ })).toBeDisabled();
    expect(screen.getByRole('note').textContent).toMatch(texto);
  });
});

describe('ModalNuevoPedidoMesa: canje de puntos al llevar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    respuestaCuenta = cuentaAna;
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: 'x', codigo: 'CP-1' } as any);
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta.startsWith('/admin/clientes/por-telefono/') ? respuestaCuenta : { items: [] }));
    vi.mocked(api.post).mockImplementation(async (ruta: string) =>
      ruta === '/admin/ofertas/vista-previa' ? ({ descuentoTotal: 0, montoCanjeable: 20, puntosEstimados: 1 } as any) : ({} as any),
    );
  });

  async function hastaProductos(conCuenta: boolean) {
    respuestaCuenta = conCuenta ? cuentaAna : { encontrado: false };
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    fireEvent.change(screen.getByLabelText(/Celular del cliente/), { target: { value: conCuenta ? '987654321' : '955512345' } });
    if (conCuenta) await screen.findByText('Cliente registrado: Ana Pérez');
    else {
      await screen.findByText(/Celular sin cuenta/);
      fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Pepe' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
  }

  it('con cuenta: saldo, «Usar máximo», total neto y plan de pago sobre el neto; envía puntosCanje', async () => {
    await hastaProductos(true);
    const bloque = await screen.findByTestId('canje-puntos-local');
    expect(bloque.textContent).toMatch(/saldo 12 pts/);
    await waitFor(() => expect(screen.getByRole('button', { name: /Usar máximo \(12\)/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Usar máximo/ }));
    expect(screen.getByTestId('fila-puntos-canjeados').textContent).toMatch(/12.*12\.00/);
    // total neto 20 - 12 = 8
    expect(document.body.textContent).toMatch(/Total\s*S\/ 8\.00/);
    irAlPago();
    expect((await screen.findByTestId('puntos-resumen')).textContent).toMatch(/Puntos canjeados \(12\).*S\/ 12\.00/);
    expect(screen.getByLabelText('Resumen de pago').textContent).toMatch(/Total del pedido\s*S\/ 8\.00/);
  });

  it('sin cuenta (invitado): el canje queda deshabilitado y explicado', async () => {
    await hastaProductos(false);
    const campo = await screen.findByLabelText('Puntos a canjear');
    expect(campo).toBeDisabled();
    expect(screen.getByRole('note').textContent).toMatch(/invitado/);
  });
});
