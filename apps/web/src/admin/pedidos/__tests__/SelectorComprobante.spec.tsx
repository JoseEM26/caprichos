import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SelectorComprobante,
  VALOR_COMPROBANTE_VACIO,
  aComprobanteAlta,
  aPayloadComprobante,
  avisoValorComprobante,
  errorValorComprobante,
} from '../SelectorComprobante';

const v = (tipo: 'NOTA_VENTA' | 'BOLETA' | 'FACTURA' | null, doc = '', razon = '', direccion = '') => ({ tipo, doc, razon, direccion });

describe('reglas del comprobante (espejo de la API)', () => {
  it('boleta: DNI opcional y 8 dígitos si se escribe; sobre S/ 700 sin DNI solo hay aviso, no error', () => {
    expect(errorValorComprobante(v('BOLETA'))).toBeNull();
    expect(errorValorComprobante(v('BOLETA', '1234567'))?.mensaje).toMatch(/8 dígitos/);
    expect(errorValorComprobante(v('BOLETA', '', '', ''))).toBeNull();
    expect(avisoValorComprobante(v('BOLETA'), 700)).toBeNull();
    expect(avisoValorComprobante(v('BOLETA'), 700.01)).toMatch(/pide el DNI/);
    expect(avisoValorComprobante(v('BOLETA', '12345678'), 900)).toBeNull();
  });

  it('factura: RUC de 11 dígitos con prefijo válido y razón social obligatoria', () => {
    expect(errorValorComprobante(v('FACTURA', '1234567890', 'X'))?.campo).toBe('doc');
    expect(errorValorComprobante(v('FACTURA', '20123456789', '  '))?.campo).toBe('razon');
    expect(errorValorComprobante(v('FACTURA', '20123456789', 'Acme SAC'))).toBeNull();
  });

  it('nota de venta y sin elegir no piden datos', () => {
    expect(errorValorComprobante(v('NOTA_VENTA'))).toBeNull();
    expect(errorValorComprobante(VALOR_COMPROBANTE_VACIO)).toBeNull();
  });

  it('el cuerpo para la API omite lo vacío; el de alta usa dni, ruc y razonSocial', () => {
    expect(aPayloadComprobante(v('BOLETA'))).toEqual({ tipo: 'BOLETA' });
    expect(aPayloadComprobante(v('FACTURA', '20123456789', ' Acme SAC ', ' Av. Uno '))).toEqual({
      tipo: 'FACTURA',
      doc: '20123456789',
      razon: 'Acme SAC',
      direccion: 'Av. Uno',
    });
    expect(aComprobanteAlta(v('BOLETA', '12345678'))).toEqual({ tipo: 'BOLETA', dni: '12345678' });
    expect(aComprobanteAlta(v('FACTURA', '20123456789', 'Acme SAC'))).toEqual({ tipo: 'FACTURA', ruc: '20123456789', razonSocial: 'Acme SAC' });
    expect(aComprobanteAlta(VALOR_COMPROBANTE_VACIO)).toBeUndefined();
  });
});

describe('SelectorComprobante', () => {
  it('muestra el error al lado del RUC, marcado con aria-invalid, y lo corrige al escribir bien', () => {
    const Envoltura = () => {
      const [valor, setValor] = useState(v('FACTURA'));
      return <SelectorComprobante idPrefijo="t" valor={valor} onChange={setValor} />;
    };
    render(<Envoltura />);
    const ruc = screen.getByLabelText('RUC');
    fireEvent.change(ruc, { target: { value: '1234' } });
    expect(screen.getByRole('alert').textContent).toMatch(/El RUC debe tener 11 dígitos/);
    expect(ruc.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(ruc, { target: { value: '20123456789' } });
    expect(screen.getByRole('alert').textContent).toMatch(/razón social/);
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Acme SAC' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(ruc.getAttribute('aria-invalid')).toBe('false');
  });

  it('sin elegir no marca ningún botón; al elegir boleta aparece el DNI opcional', () => {
    render(<SelectorComprobante idPrefijo="s" valor={VALOR_COMPROBANTE_VACIO} onChange={() => {}} permiteSinElegir ayuda="Sale por defecto" />);
    expect(screen.getByTestId('comprobante-BOLETA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Sale por defecto')).toBeTruthy();
    expect(screen.queryByLabelText('DNI (opcional)')).toBeNull();
  });
});
