import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PanelVistaPrevia, type PcPrevia } from '../PanelVistaPrevia';
import { comoPrecuenta, ejemploPrevia, CANTIDAD_EJEMPLOS } from '../ejemplosPrevia';

const PCS: PcPrevia[] = [
  { id: '1', nombre: 'PC Caja', bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 100, altoMm: 100 } },
  { id: '2', nombre: 'PC Barra', bebida: { anchoMm: 60, altoMm: 40 }, general: { anchoMm: 80, altoMm: 60 } },
];
const tab = (p: string) => fireEvent.click(screen.getByTestId(`pv-tab-${p}`));
const textoPapel = () => screen.getByTestId('pv-ticket').textContent ?? '';

describe('PanelVistaPrevia', () => {
  it('nace abierto y dibuja los 3 stickers con la maqueta real (SVG)', () => {
    render(<PanelVistaPrevia pcs={PCS} />);
    expect(screen.getByTestId('panel-previa').querySelector('details')).toHaveAttribute('open');
    for (const p of ['bebida', 'area', 'general']) {
      tab(p);
      expect(screen.getByTestId(`pv-pieza-${p}`).querySelector('svg[role="img"]')).not.toBeNull();
    }
  });

  it('el tamaño sale de la PC elegida y cambia la maqueta', () => {
    render(<PanelVistaPrevia pcs={PCS} />);
    tab('bebida');
    const a = screen.getByTestId('pv-pieza-bebida').querySelector('svg')!.getAttribute('data-maqueta');
    expect(screen.getByTestId('pv-texto')).toHaveTextContent('76 × 38 mm (PC Caja)');
    fireEvent.change(screen.getByTestId('pv-pc'), { target: { value: '2' } });
    expect(screen.getByTestId('pv-texto')).toHaveTextContent('60 × 40 mm (PC Barra)');
    expect(screen.getByTestId('pv-pieza-bebida').querySelector('svg')!.getAttribute('data-maqueta')).not.toBe(a);
  });

  it('ticket de pago: marca, líneas, totales, pago, hash y QR; 58 mm usa 32 columnas', () => {
    render(<PanelVistaPrevia pcs={PCS} />);
    tab('pago');
    const t = textoPapel();
    expect(t).toContain('CAPRICHOS');
    expect(t).toContain('TOTAL');
    expect(t).toContain('Pago:');
    expect(t).toContain('Hash:');
    expect(screen.getByTestId('pv-qr')).toBeInTheDocument();
    expect(screen.getByTestId('pv-ticket')).toHaveAttribute('data-columnas', '48');
    fireEvent.click(screen.getByTestId('pv-papel-32'));
    expect(screen.getByTestId('pv-ticket')).toHaveAttribute('data-columnas', '32');
    fireEvent.click(screen.getByTestId('pv-anulado'));
    expect(textoPapel()).toContain('*** ANULADO ***');
  });

  it('precuenta: rótulo PRE-CUENTA, sin pagos ni comprobante', () => {
    render(<PanelVistaPrevia pcs={PCS} />);
    tab('precuenta');
    const t = textoPapel();
    expect(t).toContain('PRE-CUENTA - SIN PAGAR');
    expect(t).toContain('TOTAL');
    expect(t).not.toContain('Pago:');
    expect(t).not.toContain('Hash:');
    expect(screen.queryByTestId('pv-qr')).toBeNull();
  });

  it('comanda de cocina y «Otro ejemplo» cambia el pedido; zoom marca el botón', () => {
    render(<PanelVistaPrevia pcs={PCS} />);
    tab('comanda');
    expect(textoPapel()).toContain('COMANDA');
    const antes = screen.getByTestId('pv-texto').textContent;
    fireEvent.click(screen.getByTestId('pv-otro'));
    expect(screen.getByTestId('pv-texto').textContent).not.toBe(antes);
    fireEvent.click(screen.getByTestId('pv-zoom-2'));
    expect(screen.getByTestId('pv-zoom-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /Ejemplo de comanda de cocina/ })).toBeInTheDocument();
  });

  it('«Ver ejemplos» de una PC (abrir + pcId) abre el panel plegado con los tamaños de esa PC', async () => {
    const { rerender } = render(<PanelVistaPrevia pcs={PCS} />);
    fireEvent.click(screen.getByText('Vista previa de lo que se imprime'));
    await waitFor(() => expect(screen.getByTestId('panel-previa').querySelector('details')).not.toHaveAttribute('open'));
    rerender(<PanelVistaPrevia pcs={PCS} pcId="2" abrir={1} />);
    await waitFor(() => expect(screen.getByTestId('panel-previa').querySelector('details')).toHaveAttribute('open'));
    expect((screen.getByTestId('pv-pc') as HTMLSelectElement).value).toBe('2');
  });
});

describe('ejemplosPrevia', () => {
  it('hay un ejemplo con nombre larguísimo, delivery, extras, vuelto y combo', () => {
    const todos = Array.from({ length: CANTIDAD_EJEMPLOS }, (_, i) => ejemploPrevia(i, 'Ana'));
    expect(todos.some((e) => e.nombre.length > 40)).toBe(true);
    expect(todos.some((e) => e.pago.modalidad === 'Delivery' && e.pago.pagos.some((p) => p.vuelto))).toBe(true);
    expect(todos.some((e) => e.pago.lineas.some((l) => l.partes?.length))).toBe(true);
    expect(todos.some((e) => e.pago.lineas.some((l) => l.opciones?.some((o) => o.extra)))).toBe(true);
    for (const e of todos) expect(e.pago.pagos.reduce((a, p) => a + p.monto, 0)).toBeCloseTo(e.pago.total, 2);
  });
  it('comoPrecuenta limpia el cobro', () => {
    const p = comoPrecuenta(ejemploPrevia(0, 'Ana').pago);
    expect(p.pagos).toEqual([]);
    expect(p.comprobante).toBeNull();
  });
});
