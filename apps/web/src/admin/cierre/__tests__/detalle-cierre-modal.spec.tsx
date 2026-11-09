import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DetalleCierreModal } from '../DetalleCierreModal';
import { cierreApi } from '../cierreApi';
import { ticketEjemplo } from './ticketCierreEjemplo';

const detalleDe = (ticket = ticketEjemplo()) => ({
  cajaId: 5, fecha: '2026-10-21T00:00:00Z', apertura: 100, resultado: 'NO_CUADRA' as const, aprobadoPor: 1, nota: null,
  cerradaPor: 2, cerradaEn: '2026-10-21T21:00:00Z', conteo: null, medios: [], ajustesMedio: [], ticket,
});

const abrir = (o: { ticket?: any; puedeImprimir?: boolean; esAdmin?: boolean } = {}) =>
  render(
    <DetalleCierreModal
      cajaId={5}
      detalle={detalleDe(o.ticket)}
      cargando={false}
      error={null}
      esAdmin={o.esAdmin ?? true}
      puedeImprimir={o.puedeImprimir ?? true}
      alCerrar={vi.fn()}
    />,
  );

describe('Detalle del cierre', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('es un diálogo con Resumen: quién abrió y cerró, apertura, resultado con diferencia, aprobación y nota', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: /Detalle del cierre #5/ })).toBeInTheDocument();
    const r = screen.getByTestId('seccion-resumen');
    expect(r).toHaveTextContent('Ana Cajera');
    expect(r).toHaveTextContent('Luis Cajero · 16:00');
    expect(r).toHaveTextContent('S/ 100.00');
    expect(screen.getByTestId('resultado-cierre')).toHaveTextContent('NO CUADRA · diferencia −S/ 4.00');
    expect(r).toHaveTextContent('Rosa Supervisora');
    expect(r).toHaveTextContent('Faltante de 4 soles');
  });

  it('Efectivo: tabla por denominación con cantidad × valor, total contado, esperado y diferencia', () => {
    abrir();
    fireEvent.click(screen.getByRole('tab', { name: 'Efectivo' }));
    const t = screen.getByTestId('desglose-efectivo');
    expect(t).toHaveTextContent('Billete S/ 100.00');
    expect(t).toHaveTextContent('3 × S/ 100.00');
    expect(t).toHaveTextContent('S/ 300.00');
    expect(t).toHaveTextContent('Moneda S/ 1.00');
    const s = screen.getByTestId('seccion-efectivo');
    expect(s).toHaveTextContent('Total contado');
    expect(s).toHaveTextContent('S/ 351.00');
    expect(s).toHaveTextContent('S/ 355.00');
    expect(s).toHaveTextContent('−S/ 4.00');
  });

  it('un cierre sin desglose lo dice y no inventa billetes', () => {
    abrir({ ticket: ticketEjemplo({ efectivo: { desglose: null, contado: 351, esperado: 355, diferencia: -4 } }) });
    fireEvent.click(screen.getByRole('tab', { name: 'Efectivo' }));
    expect(screen.getByTestId('sin-desglose')).toHaveTextContent('Este cierre no guardó el detalle por billetes');
    expect(screen.queryByTestId('desglose-efectivo')).not.toBeInTheDocument();
    expect(screen.getByTestId('seccion-efectivo')).toHaveTextContent('S/ 351.00');
  });

  it('muestra los intentos de conteo', () => {
    abrir({
      ticket: ticketEjemplo({
        intentos: [
          { n: 1, hora: '15:50', por: 'Luis Cajero', resultado: 'NO_CUADRA', total: 300, desglose: [{ valor: 100, cantidad: 3, subtotal: 300 }] },
          { n: 2, hora: '15:55', por: 'Luis Cajero', resultado: 'CUADRA', total: 351, desglose: null },
        ],
      }),
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Efectivo' }));
    const i = screen.getByTestId('intentos-conteo');
    expect(i).toHaveTextContent('Intento 1');
    expect(i).toHaveTextContent('Intento 2');
    expect(i).toHaveTextContent('S/ 351.00');
  });

  it('Medios de pago: sistema, visto y diferencia por medio; no admin no los ve', () => {
    const { unmount } = abrir();
    fireEvent.click(screen.getByRole('tab', { name: 'Medios de pago' }));
    const t = screen.getByTestId('detalle-medios');
    expect(within(t).getByText('YAPE').closest('tr')).toHaveTextContent('S/ 200.00S/ 200.00Cuadra');
    expect(within(t).getByText('EFECTIVO').closest('tr')).toHaveTextContent('−S/ 4.00');
    unmount();
    abrir({ esAdmin: false });
    fireEvent.click(screen.getByRole('tab', { name: 'Medios de pago' }));
    expect(screen.queryByTestId('detalle-medios')).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-detalle-restringido')).toBeInTheDocument();
  });

  it('Movimientos: egresos, liquidaciones y cobros anulados', () => {
    abrir();
    fireEvent.click(screen.getByRole('tab', { name: 'Movimientos' }));
    const m = screen.getByTestId('seccion-movimientos');
    expect(m).toHaveTextContent('Compra de hielo');
    expect(m).toHaveTextContent('Carlos Repartidor entregó S/ 80.00');
    expect(m).toHaveTextContent('CP-0042');
  });

  it('«Ver como ticket» muestra el papel de 80 mm monoespaciado con el cierre y vuelve al detalle', () => {
    abrir();
    fireEvent.click(screen.getByTestId('ver-ticket'));
    const papel = screen.getByTestId('pv-ticket');
    expect(papel).toHaveAttribute('data-columnas', '48');
    expect(papel).toHaveTextContent('CIERRE DE CAJA CZ-0005');
    expect(papel).toHaveTextContent('3 x S/ 100.00');
    fireEvent.click(screen.getByTestId('ver-ticket'));
    expect(screen.queryByTestId('pv-ticket')).not.toBeInTheDocument();
  });

  it('Imprimir manda el cierre a la ticketera de Caja y avisa', async () => {
    const imprimir = vi.spyOn(cierreApi, 'imprimirCierre').mockResolvedValue({ ok: true, mensaje: 'Se encoló el ticket de cierre' });
    abrir();
    fireEvent.click(screen.getByTestId('imprimir-cierre'));
    await waitFor(() => expect(imprimir).toHaveBeenCalledWith(5));
    expect(await screen.findByTestId('aviso-impresion')).toHaveTextContent('Se encoló el ticket de cierre');
  });

  it('si la impresión falla, muestra el motivo', async () => {
    vi.spyOn(cierreApi, 'imprimirCierre').mockRejectedValue(new Error('La PC está en pausa'));
    abrir();
    fireEvent.click(screen.getByTestId('imprimir-cierre'));
    expect(await screen.findByTestId('aviso-impresion')).toHaveTextContent('La PC está en pausa');
  });

  it('sin permiso no hay botón Imprimir, pero sí «Ver como ticket»', () => {
    abrir({ puedeImprimir: false });
    expect(screen.queryByTestId('imprimir-cierre')).not.toBeInTheDocument();
    expect(screen.getByTestId('ver-ticket')).toBeInTheDocument();
  });

  it('Esc cierra y el foco queda dentro del diálogo', () => {
    const alCerrar = vi.fn();
    render(<DetalleCierreModal cajaId={5} detalle={detalleDe()} cargando={false} error={null} esAdmin puedeImprimir alCerrar={alCerrar} />);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCerrar).toHaveBeenCalled();
  });
});
