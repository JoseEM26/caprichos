import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let permisos: string[] = ['pedidos/ajustar_pago', 'caja/cobrar'];
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: (p: string) => permisos.includes(p) }) }));
vi.mock('../SeccionVouchersPedido', () => ({ SeccionVouchersPedido: () => <div /> }));
vi.mock('../CapturasPlanDigital', () => ({ CapturasPlanDigital: () => <div /> }));

import { BotonCambiarPago } from '../CambiarPago';
import { CapaPago } from '../CapaPago';
import { pedidosApi, type Pedido } from '../pedidosApi';

const pedido = (extra: Partial<Pedido> = {}): Pedido =>
  ({ id: '7', codigo: 'CP-7', canal: 'CAJA', modalidad: 'LLEVAR', estado: 'ENTREGADO', pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO', subtotal: 41, descuento: 0, total: 41, propina: 0, ...extra }) as Pedido;

describe('Cambiar método de pago en Caja (siempre, sin código de supervisor)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permisos = ['pedidos/ajustar_pago', 'caja/cobrar'];
  });

  it('el botón está en un pedido PAGADO y ENTREGADO, y también en uno por cobrar', () => {
    const { rerender } = render(<BotonCambiarPago permitido pedido={pedido()} />);
    expect(screen.getByTestId('btn-cambiar-pago-caja')).toBeInTheDocument();
    expect(screen.getByTestId('btn-agregar-metodo')).toBeInTheDocument();
    rerender(<BotonCambiarPago permitido pedido={pedido({ pago_estado: 'PENDIENTE', estado: 'COLA' })} />);
    expect(screen.getByTestId('btn-cambiar-pago-caja')).toBeInTheDocument();
  });

  it('sin permiso o con el pedido anulado no se ofrece', () => {
    const { rerender } = render(<BotonCambiarPago permitido={false} pedido={pedido()} />);
    expect(screen.queryByTestId('btn-cambiar-pago-caja')).toBeNull();
    rerender(<BotonCambiarPago permitido pedido={pedido({ estado: 'ANULADO' })} />);
    expect(screen.queryByTestId('btn-cambiar-pago-caja')).toBeNull();
  });

  it('muestra «Antes → Ahora», confirma Sí/No sin PIN y llama al servidor; éxito «Pago actualizado»', async () => {
    const ajustar = vi.spyOn(pedidosApi, 'ajustarPago').mockResolvedValue({ ok: true, mensaje: 'Pago actualizado', avisos: ['El comprobante ya emitido conserva el medio original'], ajustePosteriorAlCierre: false });
    const alExito = vi.fn();
    render(<BotonCambiarPago permitido pedido={pedido()} alExito={alExito} />);
    fireEvent.click(screen.getByTestId('btn-cambiar-pago-caja'));
    fireEvent.click(screen.getByRole('button', { name: 'Yape' }));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'pagó con Yape' } });
    fireEvent.click(screen.getByTestId('continuar-cambio-pago'));
    const dialogo = screen.getByRole('dialog', { name: 'Elegir método de pago' });
    expect(document.body).toHaveTextContent('Antes: Efectivo S/ 41.00 → Ahora: Yape S/ 41.00');
    expect(document.querySelector('input[type="password"]')).toBeNull(); // sin código de supervisor ni PIN
    expect(dialogo).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(ajustar).toHaveBeenCalledWith('7', { plan: [{ medio: 'YAPE', monto: 41 }], pagaCon: null, motivo: 'pagó con Yape' }));
    await waitFor(() => expect(alExito).toHaveBeenCalledWith('Pago actualizado. El comprobante ya emitido conserva el medio original'));
  });

  it('Agregar otro método: abre con el medio actual y una fila nueva por completar', () => {
    render(<BotonCambiarPago permitido pedido={pedido()} />);
    fireEvent.click(screen.getByTestId('btn-agregar-metodo'));
    expect(screen.getByRole('dialog', { name: 'Elegir método de pago' })).toHaveTextContent('Agregar otro método');
    expect(screen.getAllByRole('button', { name: /Quitar/ }).length).toBeGreaterThan(0);
  });

  it('CapaPago: la marca «Pago modificado por…» y el aviso del repartidor salen del historial', () => {
    const { rerender } = render(
      <CapaPago pedido={pedido({ ajustePago: { por: 'Ana Paz', en: '2027-01-04T15:00:00Z', texto: 'Pago modificado: Efectivo 41.00 → Yape 41.00' } })} esMesa={false} estaPagado cambioCobroPendiente={false} alRechazarCobroMozo={() => {}} alExito={() => {}} alActualizar={() => {}} />,
    );
    expect(screen.getByTestId('marca-pago-modificado')).toHaveTextContent('Pago modificado por Ana Paz');
    expect(screen.getByTestId('btn-cambiar-pago-caja')).toBeInTheDocument();
    rerender(
      <CapaPago pedido={pedido({ ajustePago: { por: 'Luis Ruiz', en: '2027-01-04T15:00:00Z', texto: 'Pago modificado por el repartidor: Efectivo 41.00 → Yape 41.00' } })} esMesa={false} estaPagado cambioCobroPendiente={false} alRechazarCobroMozo={() => {}} alExito={() => {}} alActualizar={() => {}} />,
    );
    expect(screen.getByTestId('marca-pago-modificado')).toHaveTextContent('Cambio de pago hecho por el repartidor Luis Ruiz');
    expect(screen.getByTestId('marca-pago-modificado')).toHaveTextContent('Efectivo 41.00 → Yape 41.00');
  });

  it('CapaPago de un pedido anulado: sin botón y con la razón', () => {
    render(<CapaPago pedido={pedido({ estado: 'ANULADO' })} esMesa={false} estaPagado={false} cambioCobroPendiente={false} alRechazarCobroMozo={() => {}} alExito={() => {}} alActualizar={() => {}} />);
    expect(screen.queryByTestId('btn-cambiar-pago-caja')).toBeNull();
    expect(screen.getByText(/anulado: no se puede cambiar el pago/)).toBeInTheDocument();
  });

  it('un supervisor (mismo permiso) lo ve igual que el cajero', () => {
    permisos = ['pedidos/ajustar_pago', 'caja/ver'];
    render(<CapaPago pedido={pedido()} esMesa={false} estaPagado cambioCobroPendiente={false} alRechazarCobroMozo={() => {}} alExito={() => {}} alActualizar={() => {}} />);
    expect(screen.getByTestId('btn-cambiar-pago-caja')).toBeInTheDocument();
  });
});
