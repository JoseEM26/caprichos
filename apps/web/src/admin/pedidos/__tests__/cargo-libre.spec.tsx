import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { CapaProductos } from '../CapaProductos';
import { ModalCargoLibre, errorMontoCargo, etiquetaCargoLibre } from '../ModalCargoLibre';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { ServiciosLibresCierre } from '../../cierre/ServiciosLibresCierre';

let permisos: string[] = ['pedidos/cargo_libre', 'pedidos/extra'];
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario: null }),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const linea = (o: Record<string, unknown>) => ({ id: '1', nombre: 'Brownie', cantidad: 1, precio_unit: 12, subtotal: 12, producto_id: '5', ...o });
const pedido = (extra: Partial<Pedido> = {}) =>
  ({ id: '1', codigo: 'CP-W045', canal: 'CAJA', modalidad: 'MESA', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', subtotal: 12, descuento: 0, total: 12, lineas: [linea({})], ...extra }) as unknown as Pedido;
const ver = (p: Pedido, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={() => {}} alAgregarExtra={() => {}} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  permisos = ['pedidos/cargo_libre', 'pedidos/extra'];
  vi.restoreAllMocks();
});

describe('ModalCargoLibre', () => {
  it('valida descripción y monto antes de confirmar', () => {
    const alConfirmar = vi.fn();
    render(<ModalCargoLibre alCerrar={() => {}} alConfirmar={alConfirmar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(alConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText(/Escribe qué es/)).toBeInTheDocument();
    expect(screen.getByText('Escribe el monto.')).toBeInTheDocument();
  });

  it('confirma con descripción limpia, monto a 2 decimales y el producto elegido', () => {
    const alConfirmar = vi.fn();
    render(<ModalCargoLibre productos={[{ id: '1', nombre: 'Brownie' }]} alCerrar={() => {}} alConfirmar={alConfirmar} />);
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: '  Texto:   Feliz cumple Ana ' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '3,5' } });
    fireEvent.change(screen.getByLabelText(/¿Para qué producto/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(alConfirmar).toHaveBeenCalledWith({ descripcion: 'Texto: Feliz cumple Ana', monto: 3.5, paraId: '1' });
  });

  it('el monto debe ser mayor a 0, hasta S/ 500 y con 2 decimales', () => {
    expect(errorMontoCargo('0')).toMatch(/mayor a 0/);
    expect(errorMontoCargo('500.01')).toMatch(/máximo/);
    expect(errorMontoCargo('1.234')).toMatch(/2 decimales/);
    expect(errorMontoCargo('500')).toBe('');
    expect(errorMontoCargo('2,50')).toBe('');
  });

  it('la etiqueta dice quién y a qué hora', () => {
    expect(etiquetaCargoLibre({ agregadoPor: 'Rosa', agregadoEn: '2027-03-09T20:42:00Z' })).toBe('Servicio/producto libre · agregado por Rosa a las 15:42');
  });
});

describe('Detalle del pedido ▸ Servicio o producto', () => {
  it('sin cobrar: agrega por el endpoint del pedido (con el producto elegido) y refresca', async () => {
    const agregar = vi.spyOn(pedidosApi, 'agregarCargoLibre').mockResolvedValue({ id: '1', codigo: 'CP-W045', version: 2, total: 15.5, totalAnterior: 12 });
    const alActualizar = vi.fn();
    ver(pedido(), { alActualizar });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio o producto' }));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Topping de fresa' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '3.50' } });
    fireEvent.change(screen.getByLabelText(/¿Para qué producto/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(agregar).toHaveBeenCalledWith('1', { descripcion: 'Topping de fresa', monto: 3.5, paraLineaId: '1' }));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('ya cobrado: abre un pedido extra con el cargo y no llama al endpoint del pedido', async () => {
    const agregar = vi.spyOn(pedidosApi, 'agregarCargoLibre');
    const alAgregarExtra = vi.fn();
    const p = pedido({ estado: 'ENTREGADO', pago_estado: 'PAGADO' });
    ver(p, { alAgregarExtra });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio o producto' }));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Bola de helado extra' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(alAgregarExtra).toHaveBeenCalledWith(p, { descripcion: 'Bola de helado extra', monto: 4, paraId: '' });
    expect(agregar).not.toHaveBeenCalled();
  });

  it('un error del servidor se muestra en el modal', async () => {
    vi.spyOn(pedidosApi, 'agregarCargoLibre').mockRejectedValue(new Error('Este pedido ya está cobrado'));
    ver(pedido());
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio o producto' }));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Topping' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Este pedido ya está cobrado')).toBeInTheDocument();
  });

  it('sin permiso o anulado no aparece el botón', () => {
    permisos = ['pedidos/extra'];
    ver(pedido());
    expect(screen.queryByRole('button', { name: 'Agregar servicio o producto' })).toBeNull();
    permisos = ['pedidos/cargo_libre'];
    ver(pedido({ estado: 'ANULADO' }));
    expect(screen.queryByRole('button', { name: 'Agregar servicio o producto' })).toBeNull();
  });

  it('la línea libre sale destacada con quién y a qué hora, sin botón de cortesía', () => {
    const p = pedido({
      lineas: [
        linea({}),
        linea({ id: '2', nombre: 'Topping de fresa', producto_id: null, cargo_libre: true, cargoLibre: true, precio_unit: 3.5, subtotal: 3.5, agregadoPor: 'Rosa', agregadoEn: '2027-03-09T20:42:00Z' }),
      ],
    } as Partial<Pedido>);
    render(
      <MemoryRouter>
        <CapaProductos pedido={p} puedeDarCortesia alCortesia={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('etiqueta-cargo-libre')).toHaveTextContent('Servicio/producto libre · agregado por Rosa a las 15:42');
    expect(screen.getAllByText('Dar como cortesía')).toHaveLength(1);
  });
});

describe('Cierre ▸ Servicios y productos libres', () => {
  it('lista pedido, descripción, monto, medio, quién lo agregó y el total del turno', () => {
    render(
      <ServiciosLibresCierre
        datos={{
          total: 7.5,
          lista: [
            { pedidoId: '1', pedidoCodigo: 'CP-W045', descripcion: 'Topping de fresa', monto: 3.5, medios: ['EFECTIVO'], agregadoPor: 'Rosa Mozo', agregadoEn: '2027-03-09T20:42:00Z' },
            { pedidoId: '2', pedidoCodigo: 'CP-W046', descripcion: 'Bola de helado extra', monto: 4, medios: ['YAPE', 'EFECTIVO'], agregadoPor: null, agregadoEn: null },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Servicios y productos libres' })).toBeInTheDocument();
    const filas = screen.getAllByTestId('servicio-libre-fila');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('CP-W045');
    expect(filas[0]).toHaveTextContent('Topping de fresa');
    expect(filas[0]).toHaveTextContent('S/ 3.50');
    expect(filas[0]).toHaveTextContent('Rosa Mozo');
    expect(filas[0]).toHaveTextContent('15:42');
    expect(screen.getByTestId('servicios-libres-total')).toHaveTextContent('S/ 7.50');
  });

  it('sin cargos dice que no hubo; sin dato (servidor viejo) no muestra nada', () => {
    const { container, rerender } = render(<ServiciosLibresCierre datos={{ lista: [], total: 0 }} />);
    expect(screen.getByText('Ningún servicio ni producto libre en este turno.')).toBeInTheDocument();
    rerender(<ServiciosLibresCierre />);
    expect(container).toBeEmptyDOMElement();
  });
});
