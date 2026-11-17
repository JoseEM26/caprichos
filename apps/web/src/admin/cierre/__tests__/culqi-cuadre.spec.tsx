import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BloqueCulqi, estadoOperacionCulqi } from '../BloqueCulqi';
import type { CulqiTurno, OperacionCulqi } from '../cierreApi';

/** Escenario del día: 3 cobros Culqi (CP-1 tarjeta 52.50; CP-2 Yape 30 con devolución parcial de 10; CP-3 tarjeta 40). */
const culqiDelDia: CulqiTurno = {
  yape: 20,
  tarjeta: 92.5,
  cobradoYape: 30,
  cobradoTarjeta: 92.5,
  devueltoYape: 10,
  devueltoTarjeta: 0,
  total: 112.5,
  operaciones: [
    { pedidoId: '1', pedidoCodigo: 'CP-1', medio: 'TARJETA', monto: 52.5, en: '2026-11-17T18:00:00.000Z', operacion: 'chr_1', estado: 'COBRADO', devueltoPor: [], comision: 2.83, devueltoCulqi: 0 },
    { pedidoId: '2', pedidoCodigo: 'CP-2', medio: 'YAPE', monto: 30, en: '2026-11-17T19:00:00.000Z', operacion: 'chr_2', estado: 'DEVUELTO_CULQI', devueltoPor: [], comision: null, devueltoCulqi: 10 },
    { pedidoId: '3', pedidoCodigo: 'CP-3', medio: 'TARJETA', monto: 40, en: '2026-11-17T20:00:00.000Z', operacion: 'chr_3', estado: 'COBRADO', devueltoPor: [], comision: 1.77, devueltoCulqi: 0 },
  ],
  comision: { pagos: 3, porConfirmar: 1, estimadas: 1, bruto: 112.5, devueltoCulqi: 10, total: 4.6, fijo: 0.6, variable: 3.3, igv: 0.7, neto: 107.9 },
};

describe('Bloque Culqi del cierre: números del escenario', () => {
  it('muestra el total Culqi exacto (cobrado menos devuelto), la devolución y la comisión con el neto', () => {
    render(<BloqueCulqi culqi={culqiDelDia} />);
    expect(screen.getByTestId('culqi-total')).toHaveTextContent('112.50');
    expect(screen.getByTestId('culqi-devuelto')).toHaveTextContent('10.00');
    expect(screen.getByTestId('culqi-cobros')).toHaveTextContent('3');
    expect(screen.getByTestId('comision-total')).toHaveTextContent('4.60');
    expect(screen.getByTestId('comision-devuelto')).toHaveTextContent('10.00');
    expect(screen.getByTestId('comision-neto')).toHaveTextContent('107.90');
    expect(screen.getByTestId('comision-por-confirmar')).toHaveTextContent('1 pago con comisión por confirmar');
  });

  it('la devolución parcial se ve como parcial y con su monto, no como devolución total', () => {
    render(<BloqueCulqi culqi={culqiDelDia} />);
    const filas = screen.getAllByTestId('estado-operacion-culqi');
    expect(filas[1]).toHaveTextContent('Devuelto por Culqi (parcial: S/ 10.00)');
    expect(filas[0]).toHaveTextContent('Cobrado');
  });

  it('una alerta de cobro sin registrar se muestra aunque el cobro no tenga operaciones de hoy', () => {
    const solo: CulqiTurno = {
      yape: 0, tarjeta: 0, cobradoYape: 0, cobradoTarjeta: 0, devueltoYape: 0, devueltoTarjeta: 0, total: 0,
      alertas: [{ pedidoId: '9', pedidoCodigo: 'CP-9', monto: 20, tipo: 'SIN_REGISTRAR', mensaje: 'Culqi aprobó el pago y el cobro no se registró en Caja.' }],
    };
    render(<BloqueCulqi culqi={solo} />);
    const alerta = screen.getByTestId('alertas-culqi');
    expect(alerta).toHaveTextContent('Cobro Culqi para revisar (1)');
    expect(within(alerta).getByTestId('alerta-culqi')).toHaveTextContent('CP-9 · S/ 20.00');
  });

  it('estados de operación: devuelto por fuera nombra el medio del local; anulado sin devolver', () => {
    const base: Omit<OperacionCulqi, 'estado'> = { pedidoId: '1', pedidoCodigo: 'CP-1', medio: 'YAPE', monto: 25, en: '2026-11-17T18:00:00.000Z', operacion: 'chr_1', devueltoPor: [], comision: null };
    expect(estadoOperacionCulqi({ ...base, estado: 'DEVUELTO_FUERA', devueltoPor: ['YAPE'] })).toBe('Devuelto por fuera (Yape del local)');
    expect(estadoOperacionCulqi({ ...base, estado: 'ANULADO' })).toBe('Cobro anulado, sin devolver');
    expect(estadoOperacionCulqi({ ...base, estado: 'DEVUELTO_CULQI', devueltoCulqi: 25 })).toBe('Devuelto por Culqi');
  });
});
