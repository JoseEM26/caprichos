import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { textoPago } from '../columnasCaja';
import { EtiquetaEsperaPagoEnLinea, esperaPagoEnLinea, TEXTO_ESPERA_PAGO_EN_LINEA, TITULO_ESPERA_PAGO_EN_LINEA } from '../EsperaPagoEnLinea';
import { CambioMedioEnLinea } from '../CambioMedioEnLinea';
import { pedidosApi } from '../pedidosApi';

// Pedidos sintéticos
const enLinea: any = { id: '10', codigo: 'CP-T010', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', total: 29, es_personal: false };

describe('Caja: pedido que espera el pago en línea (C)', () => {
  it('la columna Estado de pago dice «Esperando pago en línea (Culqi)», no «Por cobrar»', () => {
    expect(textoPago(enLinea)).toBe(TEXTO_ESPERA_PAGO_EN_LINEA);
    expect(textoPago(enLinea)).not.toBe('Por cobrar');
  });

  it('la etiqueta lleva ícono de Culqi, data-testid y el título que explica la espera', () => {
    render(<EtiquetaEsperaPagoEnLinea />);
    const e = screen.getByTestId('espera-pago-en-linea');
    expect(e.textContent).toContain('Esperando pago en línea (Culqi)');
    expect(e.getAttribute('title')).toBe(TITULO_ESPERA_PAGO_EN_LINEA);
    expect(TITULO_ESPERA_PAGO_EN_LINEA).toMatch(/pasa a cocina solo cuando pague/);
  });

  it('cuando se aprueba (PAGADO, en cocina) vuelve a verse normal «Pagado»', () => {
    const pagado = { ...enLinea, estado: 'COLA', pago_estado: 'PAGADO' };
    expect(textoPago(pagado)).toBe('Pagado');
    expect(esperaPagoEnLinea(pagado)).toBe(false);
  });

  it('un anulado no figura como «espera de pago»', () => {
    expect(esperaPagoEnLinea({ estado: 'ANULADO', pago_estado: 'PENDIENTE_ONLINE' })).toBe(false);
  });
});

describe('Caja: cambiar el medio de un pedido que espera Culqi (E2)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('elige Yape y confirma: llama al endpoint de cambio y avisa', async () => {
    const cambio = vi.spyOn(pedidosApi, 'cambiarMedioEnLinea').mockResolvedValue({ ok: true, estado: 'COLA', medio: 'YAPE', mensaje: 'Cambiaste el pago a Yape.' });
    const alExito = vi.fn();
    render(<CambioMedioEnLinea pedido={enLinea} alExito={alExito} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar medio de pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yape' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar el cambio' }));
    await waitFor(() => expect(cambio).toHaveBeenCalledWith('10', 'YAPE'));
    await waitFor(() => expect(alExito).toHaveBeenCalledWith('Cambiaste el pago a Yape.'));
  });

  it('muestra el error del servidor (p. ej. cargo en curso) y no avisa éxito', async () => {
    vi.spyOn(pedidosApi, 'cambiarMedioEnLinea').mockRejectedValue(new Error('Hay un pago en curso o aprobado; espera unos segundos o revisa el cobro'));
    const alExito = vi.fn();
    render(<CambioMedioEnLinea pedido={enLinea} alExito={alExito} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar medio de pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar el cambio' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/pago en curso/);
    expect(alExito).not.toHaveBeenCalled();
  });
});
