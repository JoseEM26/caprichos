import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelRepartidores } from '../PanelRepartidores';
import { CONFIG_REPARTO_DEFECTO } from '../calculoRuta';
import type { PanelRepartidores as Panel } from '../repartosApi';

const ped = (o: any): any => ({
  id: '1', codigo: 'CP-1', cliente_nombre: 'Lucía', zona: 'Norte', minutosEspera: 12,
  tomado_en: '2026-11-06T15:00:00Z', salio_en: null, llego_en: null, estado: 'LISTO', ...o,
});

const panel: Panel = {
  generado_en: '', max_pedidos: 3,
  resumen: { repartidores_libres: 1, repartidores_ocupados: 1, pedidos_sin_tomar: 1 },
  repartidores: [
    { party_id: '1', nombre: 'Ana Pérez', libre: false, efectivo_por_rendir: 70,
      pedidos: [ped({ id: '1', codigo: 'CP-0001', etapa: 'TOMADO' }), ped({ id: '2', codigo: 'CP-0002', etapa: 'EN_CAMINO', salio_en: '2026-11-06T15:10:00Z' })] },
    { party_id: '2', nombre: 'Beto Soto', libre: true, efectivo_por_rendir: 0, pedidos: [] },
  ],
  sin_tomar: [ped({ id: '9', codigo: 'CP-0009' })],
};

describe('PanelRepartidores', () => {
  it('muestra libre, ocupado con 2/3, sin tomar y resumen', () => {
    render(<PanelRepartidores panel={panel} config={CONFIG_REPARTO_DEFECTO} alAbrir={() => {}} />);
    expect(screen.getByText(/1 repartidores libres · 1 ocupados · 1 pedidos sin tomar/)).toBeTruthy();
    expect(screen.getByText('LIBRE')).toBeTruthy();
    expect(screen.getByText('OCUPADO (2)')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText(/Efectivo por rendir: S\/ 70.00/)).toBeTruthy();
    expect(screen.getByText(/CP-0002/).parentElement?.textContent).toContain('En camino');
    expect(screen.getByText(/Sin tomar \(1\)/)).toBeTruthy();
  });

  it('al tocar un pedido avisa su id', () => {
    const alAbrir = vi.fn();
    render(<PanelRepartidores panel={panel} config={CONFIG_REPARTO_DEFECTO} alAbrir={alAbrir} />);
    fireEvent.click(screen.getByText(/CP-0009/));
    expect(alAbrir).toHaveBeenCalledWith('9');
  });
});
