import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalHistorialCupones, HistorialMovimiento } from '../ModalHistorialCupones';

const movimientos: HistorialMovimiento[] = [
  { t: '10:00', who: 'Ana', what: 'Emitió el cupón CUP-A', tag: 'Emisión', bg: '#DDF1E3', fg: '#14502B' },
  { t: '11:00', who: 'Luis', what: 'Canjeó el cupón CUP-B', tag: 'Canje', bg: '#FFF', fg: '#000' },
];

describe('ModalHistorialCupones: filtro por movimiento en combo', () => {
  it('elegir Canjes deja solo los canjes', () => {
    render(<ModalHistorialCupones abierto onCerrar={vi.fn()} movimientos={movimientos} />);
    expect(screen.getByText(/Emitió el cupón CUP-A/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Movimiento: Todo' }));
    fireEvent.click(screen.getByRole('option', { name: 'Canjes' }));

    expect(screen.getByRole('button', { name: 'Movimiento: Canjes' })).toBeInTheDocument();
    expect(screen.getByText(/Canjeó el cupón CUP-B/)).toBeInTheDocument();
    expect(screen.queryByText(/Emitió el cupón CUP-A/)).not.toBeInTheDocument();
  });
});
