import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { maquetarGeneral, lineasTicketPago } from '@caprichos/compartido';
import { EtiquetaGeneral, TicketPagoPrevia } from '../EtiquetaPrevia';
import { armarTicketPago } from '../etiquetasPedido';
import type { EtiquetaGeneralDatos } from '../etiquetasPedido';
import type { Pedido } from '../pedidosApi';

const datos: EtiquetaGeneralDatos = {
  codigo: 'CP-W999', modalidad: 'Mesa', modalidadPill: 'MESA 3', who: 'Jose Espinoza', canal: 'Mozo', hora: '21:59', fecha: '25/10/2026',
  cantidadProductos: 1, nota: null, printer: 'Etiquetera de caja', productos: [{ cantidad: 1, nombre: 'Frappe Oreo', tamano: '16oz' }],
};

describe('vista previa SVG = maqueta compartida', () => {
  it('dibuja una forma por primitiva y cada texto en su fuente', () => {
    const m = maquetarGeneral(datos);
    const { container } = render(<EtiquetaGeneral datos={datos} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${m.W} ${m.H}`);
    const textos = m.primitivas.filter((p) => p.t === 'texto');
    const dibujados = [...svg.querySelectorAll('text')];
    expect(dibujados.map((t) => t.textContent)).toEqual(textos.map((t) => (t.t === 'texto' ? t.texto : '')));
    expect(dibujados.map((t) => t.getAttribute('data-fuente'))).toEqual(textos.map((t) => (t.t === 'texto' ? t.fuente : '')));
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(m.primitivas.filter((p) => p.t === 'barra').length);
  });
});

describe('ticket de pago', () => {
  const pedido = {
    id: '1', codigo: 'CP-7', modalidad: 'MESA', total: 40, pago_metodo: 'EFECTIVO', creado_en: '2026-10-25T21:59:00.000Z',
    cliente_nombre: 'Jose', lineas: [{ id: 'l', nombre: 'Frappe Oreo', cantidad: 2, precio_unit: 20, subtotal: 40 }],
  } as unknown as Pedido;

  it('muestra las mismas lineas que imprime la ticketera y cambia a 58 mm', () => {
    const t = armarTicketPago(pedido);
    render(<TicketPagoPrevia datos={t} />);
    const pre = screen.getByTestId('ticket-pago');
    expect(pre.querySelectorAll('div')).toHaveLength(lineasTicketPago(t, 48).length);
    expect(pre).toHaveTextContent('Pedido CP-7');
    expect(pre).toHaveTextContent(/TOTAL\s+S\/ 40\.00/);
    fireEvent.click(screen.getByRole('button', { name: 'Papel 58 mm' }));
    expect(screen.getByTestId('ticket-pago')).toHaveAttribute('data-columnas', '32');
  });

  it('la vista previa sigue el tipo de comprobante: simple, boleta y factura', () => {
    const simple = render(<TicketPagoPrevia datos={armarTicketPago(pedido)} />);
    expect(screen.getByTestId('ticket-pago')).toHaveTextContent('COMPROBANTE SIMPLE');
    expect(screen.getByTestId('ticket-pago')).not.toHaveTextContent('IGV');
    simple.unmount();
    const factura = { ...pedido, comprobante_tipo: 'FACTURA', comprobante_doc: '20123456789', comprobante_razon: 'ACME SAC', comprobante_direccion: 'Av. Sol 1' } as Pedido;
    const t = armarTicketPago(factura);
    render(<TicketPagoPrevia datos={t} />);
    const pre = screen.getByTestId('ticket-pago');
    expect(pre).toHaveTextContent('FACTURA ELECTRÓNICA');
    expect(pre).toHaveTextContent('RUC: 20123456789');
    expect(pre).toHaveTextContent('IGV (18%)');
    expect(pre.querySelectorAll('div')).toHaveLength(lineasTicketPago(t, 48).length);
  });
});
