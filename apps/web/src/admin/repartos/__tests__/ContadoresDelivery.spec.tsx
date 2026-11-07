import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import * as socketModulo from '../../../comun/socket';
import { repartosApi } from '../repartosApi';
import { ContadoresDeliveryChips, useContadoresDelivery, RESPALDO_CONTADORES_MS } from '../ContadoresDelivery';

function Prueba() {
  return <ContadoresDeliveryChips datos={useContadoresDelivery()} />;
}

let alEvento: (() => void) | undefined;
let eventos: readonly string[] = [];
const dato = (o: object) => ({ enCocina: 0, listos: 0, enCamino: 0, pendientes: 0, entregadosHoy: 0, ...o });

beforeEach(() => {
  alEvento = undefined;
  vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation((e: readonly string[], cb: () => void) => {
    eventos = e;
    alEvento = cb;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Contadores del delivery', () => {
  it('muestra los chips con rótulos y números', async () => {
    vi.spyOn(repartosApi, 'contadoresDelivery').mockResolvedValue(dato({ enCocina: 2, listos: 3, enCamino: 1, pendientes: 6, entregadosHoy: 9 }));
    render(<Prueba />);
    await waitFor(() => expect(screen.getByLabelText('Pendientes: 6')).toBeTruthy());
    expect(screen.getByLabelText('En cocina: 2').textContent).toContain('En cocina');
    expect(screen.getByLabelText('Listos para repartir: 3')).toBeTruthy();
    expect(screen.getByLabelText('En camino: 1')).toBeTruthy();
    expect(screen.getByLabelText('Entregados hoy: 9').getAttribute('aria-live')).toBe('polite');
  });

  it('cuando cocina despacha (pedido:estado) se actualiza sin recargar', async () => {
    const api = vi.spyOn(repartosApi, 'contadoresDelivery').mockResolvedValueOnce(dato({ enCocina: 1, pendientes: 1 }));
    render(<Prueba />);
    await screen.findByLabelText('En cocina: 1');
    expect(eventos).toEqual(expect.arrayContaining(['pedido:estado', 'pedido:nuevo', 'cocina:comanda']));
    api.mockResolvedValueOnce(dato({ listos: 1, pendientes: 1 }));
    act(() => alEvento!());
    await screen.findByLabelText('Listos para repartir: 1');
    expect(screen.getByLabelText('En cocina: 0')).toBeTruthy();
  });

  it('respaldo periódico: recarga cada 45 s aunque no llegue ningún evento', async () => {
    vi.useFakeTimers();
    const api = vi.spyOn(repartosApi, 'contadoresDelivery').mockResolvedValue(dato({}));
    render(<Prueba />);
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(RESPALDO_CONTADORES_MS);
    });
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('si la recarga falla conserva el último número', async () => {
    const api = vi.spyOn(repartosApi, 'contadoresDelivery').mockResolvedValueOnce(dato({ enCamino: 4, pendientes: 4 }));
    render(<Prueba />);
    await screen.findByLabelText('En camino: 4');
    api.mockRejectedValueOnce(new Error('sin red'));
    act(() => alEvento!());
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('En camino: 4')).toBeTruthy();
  });
});
