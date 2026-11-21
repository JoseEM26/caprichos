import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PanelVivo, type PropsPanel } from '../PanelVivo';
import { salonEjemplo } from './datosEjemplo';

const props = (extra: Partial<PropsPanel> = {}): PropsPanel => {
  const d = salonEjemplo();
  return {
    datos: d, piso: d.pisos[0], bitacora: [{ hora: '20:01', texto: 'CP-W903 completo en despacho 🔔' }],
    meseros: [{ nombre: 'Capri', esCapri: true, ocupado: true, texto: 'Lleva CP-W903 · Mesa 2' }, { nombre: 'Mozo Luis', esCapri: false, ocupado: false, texto: 'Libre' }],
    reloj: '20:05', interna: true, onVista: vi.fn(), pestana: 'pedidos', onPestana: vi.fn(), tema: 'normal', onTema: vi.fn(),
    hora: 'auto', horaTxt: 'Automática · noche', onHora: vi.fn(), ...extra,
  };
};

describe('PanelVivo', () => {
  it('muestra los números del día con datos reales', () => {
    render(<PanelVivo {...props()} />);
    const kpis = document.querySelector('.sv-kpis')!;
    expect(within(kpis as HTMLElement).getByText('1/2')).toBeTruthy();
    expect(within(kpis as HTMLElement).getByText('Personas')).toBeTruthy();
    expect(screen.getByText('20:05')).toBeTruthy();
  });

  it('separa caja, cocina con chips por área, despacho y reparto', () => {
    render(<PanelVivo {...props()} />);
    expect(within(screen.getByLabelText('Pedidos por cobrar')).getByText('Marco')).toBeTruthy();
    const cocina = screen.getByLabelText('Pedidos en cocina');
    expect(within(cocina).getAllByText(/^CP-W90[12]$|^W90[12]$/).length).toBeGreaterThan(0);
    expect(cocina.querySelectorAll('.sv-area.prep').length).toBe(2);
    expect(cocina.querySelectorAll('.sv-area.ok').length).toBe(2);
    expect(within(screen.getByLabelText('Pedidos listos en despacho')).getByText('Todo listo · esperando mesero', { exact: false })).toBeTruthy();
    expect(within(screen.getByLabelText('Pedidos en reparto')).getByText('En camino', { exact: false })).toBeTruthy();
  });

  it('marca en rojo la demora de 15 minutos o más y muestra la carga por área del plano', () => {
    render(<PanelVivo {...props()} />);
    expect(document.querySelectorAll('.sv-demora.alerta').length).toBe(1);
    const cargas = document.querySelector('.sv-cargas')!;
    expect(within(cargas as HTMLElement).getByText('Bebidas')).toBeTruthy();
    expect(within(cargas as HTMLElement).getByText(/2 en prep\./)).toBeTruthy();
    expect(within(cargas as HTMLElement).getByText('Postres')).toBeTruthy();
    expect(within(cargas as HTMLElement).queryByText('Despacho')).toBeNull();
  });

  it('muestra los meseros y los últimos movimientos', () => {
    render(<PanelVivo {...props()} />);
    expect(screen.getByText('Lleva CP-W903 · Mesa 2')).toBeTruthy();
    expect(screen.getByText('1/2 ocupados')).toBeTruthy();
    expect(screen.getByText(/CP-W903 completo en despacho/)).toBeTruthy();
  });

  it('la vista pública esconde el bloque del día', () => {
    const { container, rerender } = render(<PanelVivo {...props()} />);
    expect(container.querySelector('.sv-panel.publica')).toBeNull();
    rerender(<PanelVivo {...props({ interna: false })} />);
    expect(container.querySelector('.sv-panel.publica [data-interno]')).not.toBeNull();
  });

  it('pestaña Mesas: estados, reserva y personas', () => {
    render(<PanelVivo {...props({ pestana: 'mesas' })} />);
    expect(screen.getByText('2/2 pers. · CP-W901')).toBeTruthy();
    expect(screen.getByText(/Esperando pedido · falta Bebidas/)).toBeTruthy();
    expect(within(screen.getByLabelText('Reservas próximas')).getByText('Rosa')).toBeTruthy();
    expect(document.querySelectorAll('.sv-mesa').length).toBe(2);
  });

  it('pestaña Temática: cambia hora y temática; sin 3D no la ofrece', () => {
    const p = props({ pestana: 'tema' });
    render(<PanelVivo {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Noche' }));
    expect(p.onHora).toHaveBeenCalledWith('noche');
    fireEvent.click(screen.getByRole('button', { name: /Navidad/ }));
    expect(p.onTema).toHaveBeenCalledWith('navidad');
    expect(screen.getByText('Automática · noche')).toBeTruthy();
  });

  it('sin 3D no hay pestaña de temática', () => {
    render(<PanelVivo {...props({ sin3d: true, meseros: [] })} />);
    expect(screen.queryByRole('tab', { name: 'Temática' })).toBeNull();
    expect(screen.queryByText('Meseros')).toBeNull();
  });
});
