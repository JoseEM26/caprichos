import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResumenPagoDespacho } from '../ResumenPagoDespacho';

const pago = { estado: 'POR_COBRAR' as const, medios: [{ medio: 'EFECTIVO', monto: 40 }], total: 40, descuento: 0, propina: 0, efectivo: 40, recibido: 50, vuelto: 10, llevaVuelto: true };

describe('ResumenPagoDespacho', () => {
  it('muestra medio, total, estado y que SÍ lleva vuelto', () => {
    render(<ResumenPagoDespacho pedidoId="1" pago={pago} />);
    expect(screen.getByTestId('pago-estado-1').textContent).toBe('Por cobrar');
    expect(screen.getByTestId('vuelto-1').textContent).toContain('SÍ lleva vuelto: S/ 10.00');
    expect(screen.getByText('Efectivo')).toBeTruthy();
  });
  it('sin vuelto y con celular de delivery', () => {
    render(<ResumenPagoDespacho pedidoId="2" pago={{ ...pago, llevaVuelto: false, vuelto: 0 }} telefono="987654321" />);
    expect(screen.getByTestId('vuelto-2').textContent).toContain('NO lleva vuelto');
    expect(screen.getByText('987654321')).toBeTruthy();
  });
  it('efectivo sin dato: avisa que no indicó', () => {
    render(<ResumenPagoDespacho pedidoId="3" pago={{ ...pago, llevaVuelto: null, vuelto: null, recibido: null }} />);
    expect(screen.getByTestId('vuelto-3').textContent).toContain('no indicó');
  });
});
