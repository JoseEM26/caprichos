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

const v = (tipo: 'BOLETA' | 'FACTURA' | null, doc = '', razon = '', direccion = '') => ({ tipo, doc, razon, direccion });

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

  it('sin elegir es error: boleta o factura es obligatoria (no hay nota de venta)', () => {
    expect(errorValorComprobante(VALOR_COMPROBANTE_VACIO)).toEqual({ campo: 'tipo', mensaje: 'Elige boleta o factura' });
    expect(aPayloadComprobante(VALOR_COMPROBANTE_VACIO)).toBeUndefined();
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

  it('el selector es obligatorio: sin elegir ningún botón queda marcado, avisa y no ofrece «Sin elegir»', () => {
    render(<SelectorComprobante idPrefijo="s" valor={VALOR_COMPROBANTE_VACIO} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Comprobante' })).toBeTruthy();
    expect(screen.getByTestId('comprobante-BOLETA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('comprobante-FACTURA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('Elige boleta o factura para continuar.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sin elegir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nota de venta' })).toBeNull();
    expect(screen.queryByLabelText('DNI (opcional)')).toBeNull();
  });

  it('al elegir boleta aparece el DNI opcional y el aviso desaparece', () => {
    const Envoltura = () => {
      const [valor, setValor] = useState(VALOR_COMPROBANTE_VACIO);
      return <SelectorComprobante idPrefijo="s" valor={valor} onChange={setValor} />;
    };
    render(<Envoltura />);
    fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
    expect(screen.getByTestId('comprobante-BOLETA').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('DNI (opcional)')).toBeTruthy();
    expect(screen.queryByText('Elige boleta o factura para continuar.')).toBeNull();
  });
});
