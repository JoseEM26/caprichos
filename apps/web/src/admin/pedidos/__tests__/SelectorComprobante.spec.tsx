import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import {
  SelectorComprobante,
  VALOR_COMPROBANTE_VACIO,
  aComprobanteAlta,
  aPayloadComprobante,
  avisoValorComprobante,
  errorValorComprobante,
  type ValorComprobante,
} from '../SelectorComprobante';

const v = (tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA' | null, doc = '', razon = '', direccion = '') => ({ tipo, doc, razon, direccion });

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

  it('el comprobante simple es el valor inicial, no pide datos y manda solo el tipo (sin SUNAT)', () => {
    expect(VALOR_COMPROBANTE_VACIO.tipo).toBe('SIMPLE');
    expect(errorValorComprobante(v('SIMPLE', '12345678', 'X'))).toBeNull();
    expect(aPayloadComprobante(v('SIMPLE', '12345678', 'X'))).toEqual({ tipo: 'SIMPLE' });
    expect(aComprobanteAlta(v('SIMPLE', '12345678', 'X'))).toEqual({ tipo: 'SIMPLE' });
  });

  it('sin elegir (null, pedido antiguo) sigue siendo error y no manda nada', () => {
    expect(errorValorComprobante(v(null))?.campo).toBe('tipo');
    expect(aPayloadComprobante(v(null))).toBeUndefined();
    expect(aComprobanteAlta(v(null))).toBeUndefined();
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

  it('el selector arranca en Comprobante simple, sin aviso y sin ofrecer «Sin elegir»', () => {
    render(<SelectorComprobante idPrefijo="s" valor={VALOR_COMPROBANTE_VACIO} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Comprobante' })).toBeTruthy();
    expect(screen.getByTestId('comprobante-SIMPLE').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('comprobante-BOLETA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('comprobante-FACTURA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Sin elegir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nota de venta' })).toBeNull();
    expect(screen.queryByLabelText('DNI (opcional)')).toBeNull();
  });

  it('un pedido antiguo sin comprobante (null) avisa que hay que elegir', () => {
    render(<SelectorComprobante idPrefijo="s" valor={{ ...VALOR_COMPROBANTE_VACIO, tipo: null }} onChange={() => {}} />);
    expect(screen.getByText('Elige comprobante simple, boleta o factura para continuar.')).toBeTruthy();
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
    expect(screen.queryByText(/para continuar/)).toBeNull();
  });
});

describe('SelectorComprobante: tres opciones', () => {
  it('muestra Comprobante simple, Boleta y Factura; simple no muestra campos', () => {
    const Envoltura = () => {
      const [valor, setValor] = useState<ValorComprobante>(VALOR_COMPROBANTE_VACIO);
      return <SelectorComprobante idPrefijo="t" valor={valor} onChange={setValor} />;
    };
    render(<Envoltura />);
    expect(screen.getByTestId('comprobante-SIMPLE').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByLabelText(/DNI/)).toBeNull();
    fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
    expect(screen.getByLabelText(/DNI/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('comprobante-FACTURA'));
    expect(screen.getByLabelText('RUC')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comprobante-SIMPLE'));
    expect(screen.queryByLabelText('RUC')).toBeNull();
  });
});

describe('SelectorComprobante ▸ autocompleta desde SUNAT', () => {
  it('al completar un RUC rellena razón social y dirección (editables)', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ razon_social: 'SUNAT SA', direccion: 'AV. X 1' });
    function Caja() {
      const [valor, setValor] = useState<ValorComprobante>({ tipo: 'FACTURA', doc: '', razon: '', direccion: '' });
      return <SelectorComprobante valor={valor} onChange={setValor} idPrefijo="t" />;
    }
    render(<Caja />);
    fireEvent.change(screen.getByLabelText(/^RUC/), { target: { value: '20131312955' } });
    await waitFor(() => expect((screen.getByLabelText(/Razón social/) as HTMLInputElement).value).toBe('SUNAT SA'));
    expect(get).toHaveBeenCalledWith('/admin/ruc/20131312955');
    expect((screen.getByLabelText(/Dirección fiscal/) as HTMLInputElement).value).toBe('AV. X 1');
    get.mockRestore();
  });
});

describe('SelectorComprobante: RUC guardado en la cuenta', () => {
  const guardada = { ruc: '20000000015', razonSocial: 'Empresa de Prueba SAC', direccion: 'Av. Falsa 123' };
  const Envoltura = ({ g }: { g: typeof guardada | null }) => {
    const [valor, setValor] = useState<ValorComprobante>({ ...VALOR_COMPROBANTE_VACIO, tipo: 'FACTURA' });
    return <SelectorComprobante idPrefijo="g" valor={valor} onChange={setValor} guardada={g} />;
  };

  it('al elegir factura rellena RUC, razón social y dirección guardados (editables) sin consultar SUNAT', async () => {
    const get = vi.spyOn(api, 'get');
    render(<Envoltura g={guardada} />);
    await waitFor(() => expect(screen.getByLabelText('RUC')).toHaveValue('20000000015'));
    expect(screen.getByLabelText('Razón social')).toHaveValue('Empresa de Prueba SAC');
    expect(screen.getByText(/RUC guardado en la cuenta/)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Otra SAC' } });
    expect(screen.getByLabelText('Razón social')).toHaveValue('Otra SAC');
    get.mockRestore();
  });

  it('cuenta sin RUC guardado: el formulario queda vacío', () => {
    render(<Envoltura g={null} />);
    expect(screen.getByLabelText('RUC')).toHaveValue('');
  });
});
