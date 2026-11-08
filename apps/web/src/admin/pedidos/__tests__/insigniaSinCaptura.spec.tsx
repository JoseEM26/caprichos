import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChipCobroMozo } from '../PedidosAdminView';
import { textoConfirmaSinCaptura, esPedidoLocal } from '../mediosPago';

describe('Pagado sin captura (Caja)', () => {
  it('la tarjeta muestra la insignia ámbar con quién confirmó', () => {
    render(<ChipCobroMozo cobro={{ en: '2026-11-07T12:00:00Z', medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: false, sinCaptura: true }} />);
    expect(screen.getByTestId('insignia-sin-captura').textContent).toContain('Pagado sin captura · confirmó Juan Mozo');
  });

  it('con voucher no aparece la insignia', () => {
    render(<ChipCobroMozo cobro={{ en: '2026-11-07T12:00:00Z', medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: false, sinCaptura: false }} />);
    expect(screen.queryByTestId('insignia-sin-captura')).toBeNull();
  });

  it('texto de la casilla y qué pedidos son del local', () => {
    expect(textoConfirmaSinCaptura('PLIN')).toBe('Confirmo que ya hablé con el cliente y pagó con Plin (sin captura)');
    expect(esPedidoLocal({ canal: 'MOZO', modalidad: 'MESA' })).toBe(true);
    expect(esPedidoLocal({ canal: 'CAJA', modalidad: 'RECOGER' })).toBe(true);
    expect(esPedidoLocal({ canal: 'CARTA', modalidad: 'RECOGER' })).toBe(false);
    expect(esPedidoLocal({ canal: 'MOZO', modalidad: 'DELIVERY' })).toBe(false);
  });
});
