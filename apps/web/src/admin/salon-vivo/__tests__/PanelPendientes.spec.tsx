import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PanelPendientes, pendientesDe } from '../PanelPendientes';
import { pedido, salonEjemplo } from './datosEjemplo';

const PEND = [{ nombre: 'Bebidas', estado: 'PENDIENTE' as const }];

describe('Pedidos pendientes del salón en vivo', () => {
  it('solo pendientes: caja, cocina y listos; lo despachado (en reparto) no sale', () => {
    const d = salonEjemplo();
    d.caja = [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], areas: PEND })];
    const l = pendientesDe(d);
    expect(l.map((p) => [p.codigo, p.etapa])).toEqual([
      ['CP-W903', 'LISTO'],
      ['CP-W902', 'COCINA'],
      ['CP-W901', 'COCINA'],
      ['CP-W905', 'CAJA'],
    ]);
    expect(l.find((p) => p.codigo === 'CP-W904')).toBeUndefined();
    expect(l[0].porcentaje).toBe(100);
    expect(l.find((p) => p.codigo === 'CP-W905')!.porcentaje).toBe(12);
    // en cocina con una de dos áreas lista: 25 + 55/2
    expect(l.find((p) => p.codigo === 'CP-W901')!.porcentaje).toBe(53);
  });

  it('un pedido que está en caja y en cocina sale una sola vez, en cocina', () => {
    const d = salonEjemplo();
    d.caja = [pedido('CP-W901', { areas: PEND })];
    d.cocina = [pedido('CP-W901', { areas: PEND })];
    d.despacho = [];
    expect(pendientesDe(d)).toHaveLength(1);
    expect(pendientesDe(d)[0].etapa).toBe('COCINA');
  });

  it('dibuja cada pedido con su barra de avance y su estado', () => {
    render(<PanelPendientes datos={salonEjemplo()} reloj="19:05" />);
    const barra = screen.getByRole('progressbar', { name: /CP-W903/ });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
    const lista = screen.getByRole('list');
    expect(within(lista).getAllByText('En cocina')).toHaveLength(2);
    expect(within(lista).getByText('¡Listo!')).toBeTruthy();
    expect(screen.queryByText(/Meseros|En reparto|Últimos movimientos/)).toBeNull();
  });

  it('sin pendientes lo dice', () => {
    const d = salonEjemplo();
    d.caja = []; d.cocina = []; d.despacho = [];
    render(<PanelPendientes datos={d} reloj="19:05" />);
    expect(screen.getByText(/No hay pedidos pendientes/)).toBeTruthy();
  });
});
