import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalVistaPreviaCupon, fechaDentroDe } from '../ModalVistaPreviaCupon';
import type { CuponItem } from '../ofertasApi';

const asignado = {
  id: '3',
  codigoBase: 'AMIGO15',
  descripcion: 'Para un amigo',
  modo: 'ASIGNADO_PERSONAL',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 25,
  totalDados: 2,
  topeUsos: 200,
  usosActuales: 0,
  diasValidez: 15,
  aplicaA: 'PRODUCTO',
  productoNombre: 'Dona glaseada',
} as unknown as CuponItem;

describe('ModalVistaPreviaCupon: el cupón de colección con datos reales', () => {
  it('muestra la misma plantilla del ticket con valor, alcance, vigencia y «Dados 2 de 200»', () => {
    render(<ModalVistaPreviaCupon cupon={asignado} onCerrar={() => {}} />);
    const voucher = document.body.textContent ?? '';
    expect(voucher).toContain('C A P R I C H O S');
    expect(voucher).toContain('25 % DE DESCUENTO');
    expect(voucher).toContain('Alcance: Solo Dona glaseada');
    expect(voucher).toContain(`Válido hasta ${fechaDentroDe(15)}`);
    expect(voucher).toContain('AMIGO15-A1B2C3');
    expect(voucher).toContain('N.º 0003 de 0200');
    expect(screen.getByTestId('dados-cupon').textContent).toBe('Dados 2 de 200');
  });

  it('un cupón de código único no lleva «Dados»', () => {
    render(<ModalVistaPreviaCupon cupon={{ ...asignado, modo: 'UNICO_COMPROBANTE', productoNombre: null, topeUsos: null } as unknown as CuponItem} onCerrar={() => {}} />);
    expect(screen.queryByTestId('dados-cupon')).not.toBeInTheDocument();
    expect(document.body.textContent).toContain('Alcance: Toda la carta');
  });

  it('fechaDentroDe suma días en formato dd/mm/aaaa', () => {
    expect(fechaDentroDe(1, new Date(2026, 4, 14))).toBe('15/05/2026');
    expect(fechaDentroDe(15, new Date(2026, 0, 20))).toBe('04/02/2026');
  });
});
