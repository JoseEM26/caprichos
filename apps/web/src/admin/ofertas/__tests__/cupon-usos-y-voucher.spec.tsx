import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalUsosCupon } from '../ModalUsosCupon';
import { ModalVistaPreviaCupon } from '../ModalVistaPreviaCupon';
import { ofertasApi, type CuponItem, type UsosCupon } from '../ofertasApi';

const cupon = (extra: Partial<CuponItem> = {}): CuponItem => ({
  id: '5',
  codigoBase: '25OFF',
  descripcion: '25% de descuento',
  modo: 'COMPARTIDO',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 25,
  usosActuales: 3,
  orden: 1,
  activo: true,
  creadoEn: '2027-03-01T00:00:00Z',
  ...extra,
});

const dias = Array.from({ length: 30 }, (_, i) => ({ dia: `2027-03-${String(i + 1).padStart(2, '0')}`, usos: i === 29 ? 2 : 0, soles: i === 29 ? 25 : 0 }));
const usos = (pagina = 1): UsosCupon => ({
  cuponId: '5',
  modo: 'COMPARTIDO',
  resumen: { usos: 3, tope: 10, quedan: 7, descuentoTotal: 25, clientesDistintos: 2, anulados: 1 },
  porTrabajador: [{ partyId: '77', nombre: 'Rosa Prueba', usos: 2, soles: 25 }],
  porDia: dias,
  historial: {
    items: [
      { fecha: '2027-03-19T20:00:00Z', pedidoCodigo: 'CP-100', canal: 'CAJA', aplicadoPor: 'Rosa Prueba', cliente: { nombre: 'Lucía Ejemplo', celular: '9•••••321' }, totalPedido: 37.5, descuento: 12.5, anulado: false },
      { fecha: '2027-03-18T20:00:00Z', pedidoCodigo: 'CP-101', canal: 'CARTA', aplicadoPor: null, cliente: { nombre: null, celular: null, sinCuenta: true }, totalPedido: 20, descuento: 5, anulado: true },
    ],
    total: 12,
    pagina,
    tamano: 10,
    totalPaginas: 2,
  },
});

describe('ModalUsosCupon', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra cifras, barras por día, trabajadores y el historial con celular enmascarado y pedido anulado marcado', async () => {
    const espia = vi.spyOn(ofertasApi, 'usosDeCupon').mockImplementation(async (_id, p) => usos(p));
    render(<ModalUsosCupon cupon={cupon()} onCerrar={() => {}} />);

    expect(await screen.findByText('3 de 10')).toBeTruthy();
    expect(screen.getByText('S/ 25.00')).toBeTruthy();
    expect(screen.getByTestId('barras-dia')).toBeTruthy();
    expect(screen.getByText(/1 pedido anulado no suma/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Por trabajador' }));
    expect(screen.getByText('Rosa Prueba')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Historial/ }));
    expect(screen.getByText(/Lucía Ejemplo · 9•••••321/)).toBeTruthy();
    expect(screen.getByText('Sin cuenta')).toBeTruthy();
    expect(screen.getByText('ANULADO')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(espia).toHaveBeenLastCalledWith('5', 2, 10));
  });

  it('si el servidor falla avisa y permite reintentar', async () => {
    const espia = vi.spyOn(ofertasApi, 'usosDeCupon').mockRejectedValueOnce(new Error('x')).mockResolvedValue(usos());
    render(<ModalUsosCupon cupon={cupon()} onCerrar={() => {}} />);
    expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/No pudimos cargar/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(await screen.findByText('3 de 10')).toBeTruthy();
    expect(espia).toHaveBeenCalledTimes(2);
  });
});

describe('ModalVistaPreviaCupon', () => {
  it('COMPARTIDO: muestra el descuento calculado con sus datos y la nota de que no imprime su código', () => {
    render(<ModalVistaPreviaCupon cupon={cupon()} onCerrar={() => {}} />);
    expect(screen.getByTestId('nota-cupon-voucher').textContent).toBe('Este cupón no imprime su código: solo aparece el descuento.');
    const ticket = screen.getByTestId('pv-ticket').textContent ?? '';
    expect(ticket).toMatch(/Cupón 25OFF\s+-S\/ 13\.13/);
    expect(ticket).not.toContain('próxima compra');
    expect(screen.getByRole('img', { name: 'Logo de Caprichos' })).toBeTruthy();
  });

  it('UNICO_COMPROBANTE: muestra el bloque del cupón al pie con un código de ejemplo', () => {
    render(<ModalVistaPreviaCupon cupon={cupon({ modo: 'UNICO_COMPROBANTE', codigoBase: 'DULCE10', descuentoTipo: 'MONTO', descuentoValor: 10 })} onCerrar={() => {}} />);
    const ticket = screen.getByTestId('pv-ticket').textContent ?? '';
    expect(ticket).toMatch(/Cupón DULCE10\s+-S\/ 10\.00/);
    expect(ticket).toContain('Tu cupón para tu próxima compra');
    expect(ticket).toContain('DULCE10-A1B2C3');
  });

  it('envío gratis: el ticket nombra el cupón', () => {
    render(<ModalVistaPreviaCupon cupon={cupon({ codigoBase: 'ENVIOFREE', descuentoTipo: 'ENVIO_GRATIS', descuentoValor: 0 })} onCerrar={() => {}} />);
    expect(screen.getByTestId('pv-ticket').textContent).toContain('Cupón ENVIOFREE (envío gratis)');
  });
});
