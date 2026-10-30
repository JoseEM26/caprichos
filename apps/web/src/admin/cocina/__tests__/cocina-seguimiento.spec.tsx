import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import { CocinaAdminView, agruparPorPedido, ordenarComandasPorHoraLlegada } from '../CocinaAdminView';
import type { Comanda, LineaComanda } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const linea = (id: string, nombre: string): LineaComanda => ({
  id,
  nombre,
  cantidad: 1,
  opciones: [],
  personas: [],
  nota: null,
});

// Pedido CP-301 con líneas en Barra (1), Cocina (2) y Postres (3)
const pedidoAreas = (despejadas: Record<string, boolean>) => [
  { areaId: '1', areaNombre: 'Barra', despejada: !!despejadas['1'], lineas: [linea('l1', 'Americano')] },
  { areaId: '2', areaNombre: 'Cocina', despejada: !!despejadas['2'], lineas: [linea('l2', 'Waffle')] },
  { areaId: '3', areaNombre: 'Postres', despejada: !!despejadas['3'], lineas: [linea('l3', 'Cheesecake')] },
];

// Pedido CP-301 de dos áreas: Barra (Americano) y Cocina (Waffle), ninguna despejada
const pedidoDosAreas = () => [
  { areaId: '1', areaNombre: 'Barra', despejada: false, lineas: [linea('l1', 'Americano')] },
  { areaId: '2', areaNombre: 'Cocina', despejada: false, lineas: [linea('l2', 'Waffle')] },
];

const comandaBase = (over: Partial<Comanda> = {}): Comanda => ({
  id: '301-1',
  pedidoId: '301',
  areaId: '1',
  areaNombre: 'Barra',
  ticket: 'CP-301',
  codigo: 'CP-301',
  canal: 'WEB',
  modalidad: 'DELIVERY',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  llego_en: new Date().toISOString(),
  lineas: [linea('l1', 'Americano')],
  areas: pedidoAreas({}),
  despejada: false,
  ...over,
});

describe('Cocina: seguimiento de áreas por pedido', () => {
  describe('ComandaTarjeta', () => {
    it('muestra las líneas agrupadas por área, con check listo solo en las áreas ya despejadas', () => {
      render(<ComandaTarjeta comanda={comandaBase({ areas: pedidoAreas({ '2': true }) })} onDespejar={() => {}} />);

      expect(screen.getByTestId('area-pedido-1')).toHaveTextContent('Barra');
      expect(screen.getByTestId('area-pedido-2')).toHaveTextContent('Cocina');
      expect(screen.getByTestId('area-pedido-3')).toHaveTextContent('Postres');

      const cocina = screen.getByTestId('area-pedido-2');
      expect(within(cocina).getByRole('img', { name: 'listo' })).toBeInTheDocument();
      expect(within(cocina).queryByRole('img', { name: 'pendiente' })).toBeNull();

      const barra = screen.getByTestId('area-pedido-1');
      expect(within(barra).getByRole('img', { name: 'pendiente' })).toBeInTheDocument();
      expect(screen.getAllByRole('img', { name: 'listo' })).toHaveLength(1);
    });

    it('con la propia área pendiente conserva el botón Despejar', () => {
      const onDespejar = vi.fn();
      render(<ComandaTarjeta comanda={comandaBase({ areas: pedidoAreas({ '2': true }) })} onDespejar={onDespejar} />);

      fireEvent.click(screen.getByRole('button', { name: /^Despejar$/i }));
      expect(onDespejar).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('aviso-area-lista')).toBeNull();
    });

    it('con la propia área ya despejada no muestra Despejar y avisa qué áreas faltan', () => {
      render(
        <ComandaTarjeta
          comanda={comandaBase({ despejada: true, areas: pedidoAreas({ '1': true, '3': true }) })}
          onDespejar={() => {}}
        />,
      );

      expect(screen.queryByRole('button', { name: /^Despejar$/i })).toBeNull();
      expect(screen.getByTestId('aviso-area-lista')).toHaveTextContent(
        'Tu área ya está lista, falta: Cocina',
      );
    });

    it('sin áreas (respuesta anterior) muestra la lista plana y sin checks', () => {
      render(
        <ComandaTarjeta
          comanda={comandaBase({
            areas: undefined,
            lineas: [linea('l1', 'Americano'), linea('l9', 'Espresso')],
          })}
          onDespejar={() => {}}
        />,
      );

      expect(screen.getByText('Americano')).toBeInTheDocument();
      expect(screen.getByText('Espresso')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'listo' })).toBeNull();
      expect(screen.queryByRole('img', { name: 'pendiente' })).toBeNull();
    });

    it('en la vista de un área muestra solo sus líneas, sin productos de otras áreas', () => {
      render(<ComandaTarjeta comanda={comandaBase()} onDespejar={() => {}} soloArea mostrarArea={false} />);

      expect(screen.getByText('Americano')).toBeInTheDocument();
      expect(screen.queryByText('Waffle')).toBeNull();
      expect(screen.queryByText('Cheesecake')).toBeNull();
      expect(screen.queryByTestId('area-pedido-2')).toBeNull();
    });

    it('la franja de áreas marca las despejadas y resalta el área de la pantalla', () => {
      render(
        <ComandaTarjeta
          comanda={comandaBase({ areas: pedidoAreas({ '1': true }) })}
          onDespejar={() => {}}
          soloArea
        />,
      );

      expect(screen.getByTestId('estado-area-1')).toHaveAttribute('data-despejada', 'true');
      expect(screen.getByTestId('estado-area-1')).toHaveAttribute('data-actual', 'true');
      expect(screen.getByTestId('estado-area-2')).toHaveAttribute('data-despejada', 'false');
      expect(screen.getByTestId('estado-area-2')).toHaveAttribute('data-actual', 'false');
      expect(screen.getByRole('img', { name: 'Cocina: falta' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Barra: lista' })).toBeInTheDocument();
    });
  });

  describe('una boleta por pedido', () => {
    it('agruparPorPedido deja una fila por pedido, prefiriendo la pendiente', () => {
      const filas = agruparPorPedido([
        comandaBase({ id: '301-1', areaId: '1', despejada: true }),
        comandaBase({ id: '301-2', areaId: '2', despejada: false }),
        comandaBase({ id: '302-1', pedidoId: '302', ticket: 'CP-302', codigo: 'CP-302' }),
      ]);

      expect(filas.map((f) => f.id)).toEqual(['301-2', '302-1']);
    });
  });

  describe('orden de la lista', () => {
    it('las pendientes de mi área van antes que las de solo seguimiento', () => {
      const seguimiento = comandaBase({ id: 'a', ticket: 'CP-A', despejada: true, llego_en: '2026-01-01T10:00:00Z' });
      const pendiente = comandaBase({ id: 'b', ticket: 'CP-B', despejada: false, llego_en: '2026-01-01T10:30:00Z' });

      const orden = ordenarComandasPorHoraLlegada([seguimiento, pendiente]).map((c) => c.ticket);
      expect(orden).toEqual(['CP-B', 'CP-A']);
    });
  });

  describe('CocinaAdminView', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
      vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
        usuario: { partyId: '1', nombres: 'Cocinero Test', rol: 'COCINERO' },
        permisos: ['cocina/ver', 'cocina/despejar', 'cocina/devolver'],
        debeCambiar: false,
        cargando: false,
        autenticado: true,
        ingresar: vi.fn(),
        salir: vi.fn(),
        renovar: vi.fn(),
        refrescarYo: vi.fn(),
        marcarClaveCambiada: vi.fn(),
        tiene: vi.fn().mockReturnValue(true),
      });
      vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
        { id: '1', nombre: 'Barra', comandasPendientes: 1 },
      ]);
      vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
    });

    it('en la pantalla del área el pedido sigue visible tras despejar la propia área, y el contador no lo cuenta', async () => {
      const despejada = comandaBase({
        id: '301-1',
        ticket: 'CP-301',
        codigo: 'CP-301',
        despejada: true,
        areas: pedidoAreas({ '1': true }),
      });
      const pendiente = comandaBase({
        id: '302-1',
        pedidoId: '302',
        ticket: 'CP-302',
        codigo: 'CP-302',
        despejada: false,
        areas: [
          { areaId: '1', areaNombre: 'Barra', despejada: false, lineas: [linea('l5', 'Latte')] },
        ],
        lineas: [linea('l5', 'Latte')],
      });
      vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([pendiente, despejada]);

      render(<CocinaAdminView />);

      await waitFor(() => {
        expect(screen.getByTestId('comanda-CP-301')).toBeInTheDocument();
      });
      expect(screen.getByText('EN COCINA · 1')).toBeInTheDocument();
      expect(screen.getByTestId('aviso-area-lista')).toBeInTheDocument();
      // Solo la pendiente tiene Despejar
      expect(screen.getAllByRole('button', { name: /^Despejar$/i })).toHaveLength(1);
    });

    it('en la vista Todas el pedido es una sola boleta con sus áreas, sin Despejar', async () => {
      const filaBarra = comandaBase({ id: '301-1', areaId: '1', areaNombre: 'Barra', lineas: [linea('l1', 'Americano')] });
      const filaCocina = comandaBase({ id: '301-2', areaId: '2', areaNombre: 'Cocina', lineas: [linea('l2', 'Waffle')] });
      vi.spyOn(cocinaApi, 'listarComandasArea').mockImplementation(async (area) =>
        area === '' ? [filaBarra, filaCocina] : [filaBarra],
      );

      render(<CocinaAdminView />);
      await waitFor(() => {
        expect(screen.getByTestId('comanda-CP-301')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Todas' }));

      await waitFor(() => {
        expect(screen.getAllByTestId('comanda-CP-301')).toHaveLength(1);
      });
      expect(screen.getByText('EN COCINA · 1')).toBeInTheDocument();
      expect(screen.getByText('Americano')).toBeInTheDocument();
      expect(screen.getByText('Waffle')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Despejar$/i })).toBeNull();
    });

    it('Despejar sigue pidiendo Confirmar Sí/No antes de llamar a la API', async () => {
      vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([comandaBase()]);
      const spyDespejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });

      render(<CocinaAdminView />);

      await waitFor(() => {
        expect(screen.getByTestId('comanda-CP-301')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^Despejar$/i }));
      expect(screen.getByText(/¿Despejar comanda CP-301\?/i)).toBeInTheDocument();
      expect(spyDespejar).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Sí, despejar/i }));
      await waitFor(() => {
        expect(spyDespejar).toHaveBeenCalledWith('301', '1');
      });
    });

    it('pantalla completa en Todas: una boleta por pedido con sus áreas, sin Despejar', async () => {
      const filaBarra = comandaBase({ id: '301-1', areaId: '1', areaNombre: 'Barra', lineas: [linea('l1', 'Americano')], areas: pedidoDosAreas() });
      const filaCocina = comandaBase({ id: '301-2', areaId: '2', areaNombre: 'Cocina', lineas: [linea('l2', 'Waffle')], areas: pedidoDosAreas() });
      vi.spyOn(cocinaApi, 'listarComandasArea').mockImplementation(async (area) =>
        area === '' ? [filaBarra, filaCocina] : [filaBarra],
      );

      render(<CocinaAdminView />);
      await waitFor(() => {
        expect(screen.getByTestId('comanda-CP-301')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
      fireEvent.click(screen.getByRole('button', { name: /Pantalla completa/i }));

      const fs = await screen.findByTestId('pantalla-completa-cocina');
      expect(within(fs).getAllByTestId('comanda-CP-301')).toHaveLength(1);
      expect(within(fs).getByText('EN COCINA · 1')).toBeInTheDocument();
      expect(within(fs).getByTestId('estado-area-1')).toBeInTheDocument();
      expect(within(fs).getByTestId('estado-area-2')).toBeInTheDocument();
      expect(within(fs).queryByRole('button', { name: /^Despejar$/i })).toBeNull();
    });

    it('pantalla completa en Barra y Salados: cada área ve solo sus líneas y su Despejar', async () => {
      vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
        { id: '1', nombre: 'Barra', comandasPendientes: 1 },
        { id: '2', nombre: 'Cocina', comandasPendientes: 1 },
      ]);
      const filaBarra = comandaBase({ id: '301-1', areaId: '1', areaNombre: 'Barra', lineas: [linea('l1', 'Americano')], areas: pedidoDosAreas() });
      const filaCocina = comandaBase({ id: '301-2', areaId: '2', areaNombre: 'Cocina', lineas: [linea('l2', 'Waffle')], areas: pedidoDosAreas() });
      vi.spyOn(cocinaApi, 'listarComandasArea').mockImplementation(async (area) => {
        if (area === '2') return [filaCocina];
        if (area === '') return [filaBarra, filaCocina];
        return [filaBarra];
      });

      render(<CocinaAdminView />);
      await waitFor(() => {
        expect(screen.getByTestId('comanda-CP-301')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Pantalla completa/i }));

      const fs = await screen.findByTestId('pantalla-completa-cocina');
      // Barra (area inicial): solo su línea y su Despejar
      expect(within(fs).getByText('Americano')).toBeInTheDocument();
      expect(within(fs).queryByText('Waffle')).toBeNull();
      expect(within(fs).getAllByRole('button', { name: /^Despejar$/i })).toHaveLength(1);

      // Salados (Cocina): solo el waffle, con su propio Despejar
      fireEvent.click(within(fs).getByRole('button', { name: 'Salados' }));
      await waitFor(() => {
        expect(within(fs).getByText('Waffle')).toBeInTheDocument();
      });
      expect(within(fs).queryByText('Americano')).toBeNull();
      expect(within(fs).getAllByRole('button', { name: /^Despejar$/i })).toHaveLength(1);
    });
  });
});
