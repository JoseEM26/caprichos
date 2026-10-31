import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { requiereCodigo } from '../../../comun/autorizacionSupervisor';

// El rol de la sesión decide si la vista pide el código del supervisor (ADMIN no lo escribe nunca).
const sesion = { rol: 'ADMIN' as string };
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: sesion.rol }, tiene: () => true }),
}));

import { ModalAnular } from '../ModalAnular';
import { ExcepcionSinVoucher } from '../CapturasPlanDigital';

describe('requiereCodigo', () => {
  it('ADMIN y SUPERVISOR no piden código; los demás roles sí', () => {
    expect(requiereCodigo({ rol: 'ADMIN' })).toBe(false);
    expect(requiereCodigo({ rol: 'admin' })).toBe(false);
    expect(requiereCodigo({ rol: 'SUPERVISOR' })).toBe(false);
    expect(requiereCodigo({ rol: 'CAJERO' })).toBe(true);
    expect(requiereCodigo({ rol: 'MOZO' })).toBe(true);
    expect(requiereCodigo(null)).toBe(true);
  });
});

describe('vistas según el rol', () => {
  beforeEach(() => {
    sesion.rol = 'ADMIN';
  });

  it('ADMIN no ve el campo de código al anular un pedido', () => {
    render(<ModalAnular pedidoId="1" codigoPedido="CP-1" alCerrar={() => {}} alAnularExitoso={() => {}} />);
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    expect(screen.queryByText(/Código del supervisor/)).toBeNull();
  });

  it('ADMIN no ve el código en la excepción sin voucher (solo motivo)', () => {
    render(<ExcepcionSinVoucher motivo="" onMotivo={() => {}} pin="" onPin={() => {}} alVolver={() => {}} />);
    expect(screen.getByTestId('motivo-sin-voucher')).toBeTruthy();
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
  });

  it('CAJERO sí ve el campo de código al anular y en la excepción sin voucher', () => {
    sesion.rol = 'CAJERO';
    const { unmount } = render(
      <ModalAnular pedidoId="1" codigoPedido="CP-1" alCerrar={() => {}} alAnularExitoso={() => {}} />,
    );
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
    unmount();
    render(<ExcepcionSinVoucher motivo="" onMotivo={() => {}} pin="" onPin={() => {}} alVolver={() => {}} />);
    expect(screen.getByTestId('input-codigo-supervisor')).toBeTruthy();
  });
});
