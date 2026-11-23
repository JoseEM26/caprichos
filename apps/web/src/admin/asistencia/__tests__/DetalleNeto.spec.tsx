import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DetalleNeto, fechaLegible } from '../DetalleNeto';

const base: any = {
  partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-16', hasta: '2026-11-22' },
  resultado: { neto: 130.5 },
};

describe('DetalleNeto', () => {
  it('fecha legible', () => expect(fechaLegible('2026-11-17')).toBe('Mar 17 nov'));

  it('muestra un bloque por día con sus líneas, subtotal y el total del neto', () => {
    const d = {
      ...base,
      movimientos: [
        { fecha: '2026-11-17', concepto: '8 h trabajadas', monto: 160, tipo: 'INGRESO' },
        { fecha: '2026-11-17', concepto: 'Horas extra (30 min)', monto: 0, detalle: 'Sin aprobar, no se paga', tipo: 'INFO' },
        { fecha: '2026-11-17', concepto: 'Penalidad por tardanza', monto: -5, tipo: 'RESTA' },
        { fecha: '2026-11-18', concepto: 'Descuento: Daño', monto: -10, detalle: 'Vaso roto', tipo: 'RESTA' },
        { fecha: null, concepto: 'Cuota 1 de 3 del préstamo', monto: -14.5, tipo: 'RESTA' },
      ],
    };
    const cerrar = vi.fn();
    render(<DetalleNeto d={d} alCerrar={cerrar} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const martes = screen.getByRole('region', { name: 'Mar 17 nov' });
    expect(within(martes).getByText('8 h trabajadas')).toBeInTheDocument();
    expect(within(martes).getByText('Sin aprobar, no se paga')).toBeInTheDocument();
    expect(martes).toHaveTextContent('Subtotal + S/ 155.00');
    expect(screen.getByRole('region', { name: 'Mié 18 nov' })).toHaveTextContent('Vaso roto');
    expect(screen.getByRole('region', { name: 'Del período' })).toHaveTextContent('Cuota 1 de 3 del préstamo');
    expect(screen.getByTestId('dn-total')).toHaveTextContent('S/ 130.50');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cerrar).toHaveBeenCalled();
  });

  it('un pago antiguo sin movimientos lo dice', () => {
    render(<DetalleNeto d={base} alCerrar={() => undefined} />);
    expect(screen.getByText('No disponible para este pago antiguo.')).toBeInTheDocument();
  });
});
