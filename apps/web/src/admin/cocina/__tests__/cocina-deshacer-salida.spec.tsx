import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CocinaAdminView } from '../CocinaAdminView';
import { SEGUNDOS_DESHACER } from '../ComandaTarjeta';
import type { Comanda, LineaComanda } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

const latte = (listas: number): LineaComanda => ({ id: '1', nombre: 'Latte', cantidad: 3, listas, despachadas: 0 });

// Pedido CP-0007 con una sola área (Bebidas): tiene 2 de 3 listas
const comandaArea = (listas: number): Comanda => ({
  id: '7-1',
  pedidoId: '7',
  areaId: '1',
  areaNombre: 'Bebidas',
  ticket: 'CP-0007',
  codigo: 'CP-0007',
  canal: 'WEB',
  modalidad: 'LLEVAR',
  mesa: null,
  minutos: 3,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [latte(listas)],
  areas: [{ areaId: '1', areaNombre: 'Bebidas', despejada: false, lineas: [latte(listas)] }],
});

/**
 * Simula el servidor: mientras el área no esté despejada la comanda se lista; al despejarla (última unidad)
 * deja de listarse, y al deshacer (bajar la unidad) vuelve a listarse como pendiente.
 */
function simularServidor() {
  const estado = { despejada: false, listas: 2 };
  vi.spyOn(cocinaApi, 'listarComandasArea').mockImplementation(async () =>
    estado.despejada ? [] : [comandaArea(estado.listas)],
  );
  const marcar = vi.spyOn(cocinaApi, 'marcarUnidadesLinea').mockImplementation(async (_id, listas) => {
    estado.listas = listas;
    estado.despejada = listas >= 3;
    return { despejada: estado.despejada, reabierta: !estado.despejada };
  });
  return { marcar };
}

describe('Cocina: la última unidad despeja el área con 5 s de Deshacer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const preparar = async () => {
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Cocina', rol: 'COCINA' },
      permisos: ['cocina/ver', 'cocina/despejar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      tiene: vi.fn((p: string) => p === 'cocina/ver' || p === 'cocina/despejar'),
    } as any);
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Bebidas', comandasPendientes: 1 } as any]);
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true } as any);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false } as any);
    const servidor = simularServidor();

    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );
    // Vista de área (no Todas): la casilla de cada unidad solo aparece aquí
    fireEvent.click(await screen.findByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Bebidas' }));
    const casilla = await screen.findByRole('button', { name: /Latte: 2 de 3 listas/ });
    return { ...servidor, casilla };
  };

  it('al completar el área la tarjeta queda en verde con Deshacer, sigue aunque haya recarga, y sale a los 5 s', async () => {
    const { casilla, marcar } = await preparar();
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(casilla);
    });

    expect(marcar).toHaveBeenCalledWith('1', 3);
    // El servidor ya no lista la comanda (el área se despejó), pero la tarjeta sigue en verde con Deshacer
    expect(screen.getByTestId('comanda-CP-0007')).toHaveAttribute('data-despejada', 'true');
    expect(within(screen.getByTestId('deshacer-salida')).getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime((SEGUNDOS_DESHACER - 1) * 1000);
    });
    expect(screen.getByTestId('comanda-CP-0007')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('comanda-CP-0007')).toBeNull();
  });

  it('Deshacer durante los 5 s baja la unidad: el área vuelve a pendiente y la tarjeta no sale', async () => {
    const { casilla, marcar } = await preparar();
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(casilla);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    });

    expect(marcar).toHaveBeenLastCalledWith('1', 2);
    expect(screen.queryByTestId('deshacer-salida')).toBeNull();
    expect(screen.getByTestId('comanda-CP-0007')).toHaveAttribute('data-despejada', 'false');

    await act(async () => {
      vi.advanceTimersByTime((SEGUNDOS_DESHACER + 1) * 1000);
    });
    expect(screen.getByTestId('comanda-CP-0007')).toHaveAttribute('data-despejada', 'false');
  });
});
