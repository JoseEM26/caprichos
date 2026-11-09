import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MesasOcupadas } from '../componentes/MesasOcupadas';
import { RellenoMesa } from '../componentes/RellenoMesa';
import { progDe } from './progresoMesa.spec';
import type { MesaSalon, MiPedido } from '../tipos';

const mesa = {
  id: '5', pisoId: '1', tipo: 'MESA', numero: 4, nombre: null, asientos: 4, x: 1, y: 1, ancho: 2, alto: 2, activo: true,
  estado: 'OCUPADA',
  pedido: {
    id: '50', codigo: 'CP-50', mozo: 'Ana', cliente: 'José', total: 40, estado: 'PREPARANDO', creadoEn: '2026-11-09T18:00:00Z',
    lineas: [{ cantidad: 2, nombre: 'Ceviche', detalle: '' }],
    progreso: progDe([['Cocina', [[2, 2]]]]),
  },
} as unknown as MesaSalon;

const extra = (id: string, listas: number): MiPedido =>
  ({
    id, codigo: `CP-${id}`, estado: 'PREPARANDO', modalidad: 'MESA', mesaNombre: 'Mesa 4', pedidoOrigenId: '50', total: 10,
    creadoEn: '2026-11-09T19:00:00Z', lineas: [{ nombre: 'Chicha', cantidad: 2 }], progreso: progDe([['Bebidas', [[2, listas]]]]),
  }) as unknown as MiPedido;

describe('MesasOcupadas', () => {
  it('suma original y extras, muestra contador y deja abierto solo lo pendiente o último', () => {
    render(<MesasOcupadas mesas={[mesa]} extras={[extra('51', 0), extra('52', 2)]} alAbrirCuenta={vi.fn()} />);
    expect(screen.getByText('2 extras')).toBeTruthy();
    const barra = screen.getAllByRole('progressbar', { name: /Avance de Mesa/ })[0];
    expect(barra.getAttribute('aria-valuenow')).toBe('67'); // 4 de 6 piezas
    const orig = screen.getByRole('button', { name: /Pedido CP-50/ });
    expect(orig.getAttribute('aria-expanded')).toBe('false'); // completo y no es el último
    expect(screen.getByRole('button', { name: /Extra CP-51/ }).getAttribute('aria-expanded')).toBe('true'); // pendiente
    expect(screen.getByRole('button', { name: /Extra CP-52/ }).getAttribute('aria-expanded')).toBe('true'); // última
    fireEvent.click(orig);
    expect(orig.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Cocina 2/2').length).toBeGreaterThan(0);
  });

  it('«+ Pedido extra» solo con permiso y llama con la mesa', () => {
    const alExtra = vi.fn();
    const { rerender } = render(<MesasOcupadas mesas={[mesa]} extras={[]} alAbrirCuenta={vi.fn()} />);
    expect(screen.queryByText('+ Pedido extra')).toBeNull();
    rerender(<MesasOcupadas mesas={[mesa]} extras={[]} alAbrirCuenta={vi.fn()} alAgregarExtra={alExtra} />);
    fireEvent.click(screen.getByText('+ Pedido extra'));
    expect(alExtra).toHaveBeenCalledWith(mesa);
  });

  it('al 100% dice «Todo listo» además del color', () => {
    const { container } = render(<RellenoMesa nombre="Mesa 4" progreso={{ total: 2, listas: 2, porcentaje: 100, porArea: [] }} />);
    expect(within(container).getByText('Todo listo')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});
