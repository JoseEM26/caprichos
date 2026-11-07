import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  CocinaAdminView,
  ordenarComandasPorHoraLlegada,
} from '../CocinaAdminView';
import type {
  Comanda,
  HistorialComanda,
} from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

// Mock de audio para jsdom
vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

describe('coc-pantalla: Nuevos requerimientos de pantalla de cocina', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Cocinero Test', rol: 'COCINERO' },
      permisos: [
        'cocina/ver',
        'cocina/despejar',
        'cocina/devolver',
        'cocina/agotar',
        'cocina/demanda',
        'almacen/ver',
        'almacen/movimientos',
        'almacen/pedidos_internos',
      ],
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
  });

  const baseComanda: Comanda = {
    id: '1-1',
    pedidoId: '1',
    areaId: '1',
    areaNombre: 'Bebidas',
    ticket: 'CP-0101',
    codigo: 'CP-0101',
    canal: 'WEB',
    modalidad: 'DELIVERY',
    mesa: null,
    minutos: 10,
    color: 'VERDE',
    creado_en: '2026-10-24T10:00:00.000Z',
    lineas: [{ id: '1', nombre: 'Capuchino', cantidad: 1 }],
  };

  // 1. Orden estricto por hora de llegada ascendente (FIFO)
  it('a) ordenarComandasPorHoraLlegada ordena estrictamente por hora de llegada ascendente', () => {
    const c1: Comanda = {
      ...baseComanda,
      id: '1',
      pedidoId: '1',
      codigo: 'CP-001',
      creado_en: '2026-10-24T10:30:00.000Z',
      minutos: 10,
    };
    const c2: Comanda = {
      ...baseComanda,
      id: '2',
      pedidoId: '2',
      codigo: 'CP-002',
      creado_en: '2026-10-24T10:00:00.000Z', // Llegó primero
      minutos: 40,
    };
    const c3: Comanda = {
      ...baseComanda,
      id: '3',
      pedidoId: '3',
      codigo: 'CP-003',
      creado_en: '2026-10-24T10:15:00.000Z',
      minutos: 25,
    };

    const ordenadas = ordenarComandasPorHoraLlegada([c1, c2, c3]);
    expect(ordenadas.map((c) => c.codigo)).toEqual(['CP-002', 'CP-003', 'CP-001']);
  });

  // 2. Desempate por minutos si no hay fecha ISO válida
  it('b) ordenarComandasPorHoraLlegada desempata por minutos transcurridos si no hay fecha', () => {
    const cA: Comanda = {
      ...baseComanda,
      codigo: 'CP-A',
      creado_en: '',
      minutos: 15,
    };
    const cB: Comanda = {
      ...baseComanda,
      codigo: 'CP-B',
      creado_en: '',
      minutos: 45, // Más minutos = llegó antes
    };

    const ordenadas = ordenarComandasPorHoraLlegada([cA, cB]);
    expect(ordenadas[0].codigo).toBe('CP-B');
    expect(ordenadas[1].codigo).toBe('CP-A');
  });

  // 3. Indicador de Alta Demanda solo lectura y enlace a /admin/configuracion
  it('c) Indicador de solo lectura de Alta Demanda enlaza a /admin/configuracion cuando está activa', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Bebidas', comandasPendientes: 1 },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([baseComanda]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: true,
      minutos: 45,
      pausa: false,
    });

    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const link = screen.getByTestId('indicador-alta-demanda');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/admin/configuracion');
      expect(screen.getByText(/Alta demanda \+45 min/i)).toBeInTheDocument();
    });
  });

  it('d) Indicador de Alta Demanda no se muestra cuando está apagada', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Bebidas', comandasPendientes: 1 },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([baseComanda]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('CP-0101')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('indicador-alta-demanda')).not.toBeInTheDocument();
  });

  // 4. Barra de acciones de cocina con iconos SVG y '?' accesible
  it('e) Barra de acciones contiene botones con iconos y tooltip ? accesible', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Cargando pantalla/i)).not.toBeInTheDocument();
    });

    // Botones presentes
    expect(screen.getByRole('button', { name: /^Marcar agotado$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pedir al almacén$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Registrar mermas$/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Sonido/i })).toBeInTheDocument();

    // Botón de ayuda ? para Marcar agotado
    const btnAyudaAgotado = screen.getByRole('button', {
      name: /¿Para qué sirve Marcar agotado\?/i,
    });
    expect(btnAyudaAgotado).toBeInTheDocument();

    // Click muestra tooltip
    fireEvent.click(btnAyudaAgotado);
    expect(
      screen.getByText(/Marca un producto, sabor u opción que se acabó hoy/i),
    ).toBeInTheDocument();
  });

  // Sin pestaña Despacho: cocina solo muestra lo suyo (Pantalla del área y Despejadas hoy)
  it('g) La vista de cocina tiene las pestañas Pantalla del área y Despejadas hoy; Despacho solo con el permiso cocina/despacho', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Bebidas', comandasPendientes: 0 },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    // Sin el permiso cocina/despacho no hay pestaña Despacho; con él aparece
    const sesion = vi.mocked(sesionModulo.useSesion);
    const completa = sesion();
    sesion.mockReturnValue({ ...completa, tiene: vi.fn((p: string) => p !== 'cocina/despacho') });

    const { unmount } = render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Cargando pantalla/i)).not.toBeInTheDocument();
    });

    const pestanas = within(screen.getByRole('tablist', { name: 'Vista de cocina' })).getAllByRole('tab');
    expect(pestanas.map((t) => t.textContent)).toEqual(['Pantalla del área', 'Despejadas hoy']);
    unmount();
    sesion.mockReturnValue({ ...completa, tiene: vi.fn().mockReturnValue(true) });
    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );
    expect(await screen.findByRole('tab', { name: 'Despacho' })).toBeInTheDocument();
  });

  // 5. Pestaña «Despejadas hoy» y reordenamiento al devolver
  it('f) Pestaña «Despejadas hoy» permite devolver comanda y refresca la lista', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([
      { id: '1', nombre: 'Bebidas', comandasPendientes: 0 },
    ]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({
      activa: false,
      minutos: 0,
      pausa: false,
    });

    const historialPrueba: HistorialComanda[] = [
      {
        id: '1-1',
        pedidoId: '1',
        areaId: '1',
        areaNombre: 'Bebidas',
        ticket: 'CP-0101',
        codigo: 'CP-0101',
        canal: 'WEB',
        modalidad: 'DELIVERY',
        llego_en: '2026-10-24T10:00:00.000Z',
        despejada_en: '2026-10-24T10:18:00.000Z',
        tiempoPreparacionMin: 18,
        lineas: [{ id: '1', nombre: 'Capuchino', cantidad: 1 }],
      },
    ];

    const spyHistorial = vi
      .spyOn(cocinaApi, 'listarHistorialCocina')
      .mockResolvedValue(historialPrueba);
    const spyDevolver = vi
      .spyOn(cocinaApi, 'devolverComanda')
      .mockResolvedValue({ ok: true });

    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/Cargando pantalla/i)).not.toBeInTheDocument();
    });

    // Cambiar a la pestaña «Despejadas hoy»
    const tabDespejadas = screen.getByRole('tab', { name: /Despejadas hoy/i });
    fireEvent.click(tabDespejadas);

    await waitFor(() => {
      expect(spyHistorial).toHaveBeenCalled();
      expect(screen.getByText('CP-0101')).toBeInTheDocument();
      expect(screen.getByText(/18 min de preparación/i)).toBeInTheDocument();
    });

    // Clic en Devolver a la pantalla
    const btnDevolver = screen.getByRole('button', {
      name: /Devolver a la pantalla/i,
    });
    fireEvent.click(btnDevolver);

    // Diálogo de confirmación Sí/No
    expect(
      screen.getByText(/¿Devolver comanda CP-0101 a la pantalla\?/i),
    ).toBeInTheDocument();
    const btnConfirmar = screen.getByRole('button', { name: /Sí, devolver/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(spyDevolver).toHaveBeenCalledWith('1', '1');
    });
  });
});
