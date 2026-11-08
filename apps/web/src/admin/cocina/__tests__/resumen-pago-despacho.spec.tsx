import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResumenPagoDespacho, etiquetaMedio } from '../ResumenPagoDespacho';

const pago = { estado: 'POR_COBRAR' as const, medios: [{ medio: 'EFECTIVO', monto: 40 }], total: 40, descuento: 0, propina: 0, efectivo: 40, recibido: 50, vuelto: 10, llevaVuelto: true };

describe('ResumenPagoDespacho', () => {
  it('muestra medio, total, estado y que SÍ lleva vuelto', () => {
    render(<ResumenPagoDespacho pedidoId="1" pago={pago} />);
    expect(screen.getByTestId('pago-estado-1').textContent).toBe('POR COBRAR');
    expect(screen.getByTestId('vuelto-1').textContent).toContain('SÍ lleva vuelto: S/ 10.00');
    expect(screen.getByText('Efectivo')).toBeTruthy();
  });
  it('sin vuelto y con celular de delivery', () => {
    render(<ResumenPagoDespacho pedidoId="2" pago={{ ...pago, llevaVuelto: false, vuelto: 0 }} telefono="987654321" />);
    expect(screen.getByTestId('vuelto-2').textContent).toContain('NO lleva vuelto');
    expect(screen.getByText('987654321')).toBeTruthy();
  });
  it('delivery sin pagar: banner COBRAR AL ENTREGAR igual que el sticker; el personal no cobra', () => {
    render(<ResumenPagoDespacho pedidoId="4" pago={{ ...pago, cobrarAlEntregar: 40 }} />);
    expect(screen.getByTestId('cobrar-entregar-4').textContent).toContain('COBRAR AL ENTREGAR: S/ 40.00');
    render(<ResumenPagoDespacho pedidoId="5" pago={{ ...pago, cobrarAlEntregar: 40 }} esPersonal />);
    expect(screen.queryByTestId('cobrar-entregar-5')).toBeNull();
  });
  it('efectivo sin dato: avisa que no indicó', () => {
    render(<ResumenPagoDespacho pedidoId="3" pago={{ ...pago, llevaVuelto: null, vuelto: null, recibido: null }} />);
    expect(screen.getByTestId('vuelto-3').textContent).toContain('no indicó');
  });
  it('pago ya hecho se ve como YA PAGADO con su medio legible', () => {
    render(<ResumenPagoDespacho pedidoId="4" pago={{ ...pago, estado: 'PAGADO', medios: [{ medio: 'YAPE', monto: 40 }], efectivo: 0, recibido: null, vuelto: null, llevaVuelto: false }} />);
    expect(screen.getByTestId('pago-estado-4').textContent).toBe('YA PAGADO');
    expect(screen.getByText('Yape')).toBeTruthy();
  });
  it('consumo del personal: nunca muestra el código crudo y dice que no hay cobro en caja', () => {
    render(
      <ResumenPagoDespacho
        pedidoId="5"
        esPersonal
        pago={{ ...pago, estado: 'PAGADO', medios: [{ medio: 'CREDITO_PERSONAL', monto: 23.25 }], total: 23.25, descuento: 7.75, efectivo: 0, recibido: null, vuelto: null, llevaVuelto: false }}
      />,
    );
    expect(screen.queryByText('CREDITO_PERSONAL')).toBeNull();
    expect(screen.getByText('Crédito del personal')).toBeTruthy();
    expect(screen.getByTestId('pago-estado-5').textContent).toContain('PERSONAL');
    expect(screen.getByText('Descuento de personal')).toBeTruthy();
    expect(screen.getByTestId('vuelto-5').textContent).toContain('Sin cobro en caja');
  });
  it('un medio desconocido se muestra legible, sin guiones bajos', () => {
    expect(etiquetaMedio('OTRO_MEDIO_NUEVO')).toBe('Otro medio nuevo');
    expect(etiquetaMedio('CREDITO_PERSONAL')).toBe('Crédito del personal');
  });
});
