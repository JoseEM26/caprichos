import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, RespuestaListarPedidos } from '../pedidosApi';
import { errorRangoPersonalizado, sumarDias, textoRango, hoyLima } from '../filtroDias';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));

// 03:00 UTC del 29 = 22:00 del 28 en Lima: el «hoy» de Lima es 28 aunque en UTC sea 29
const AHORA = new Date('2026-10-29T03:00:00Z');
const HOY = '2026-10-28';

const respuesta = (items: any[] = [], total?: number): RespuestaListarPedidos => ({
  total: total ?? items.length,
  pagina: 1,
  limite: 100,
  items,
});

describe('Filtro de días en Pedidos y caja', () => {
  let listar: MockInstance<typeof pedidosApi.listar>;

  beforeEach(() => {
    // Solo se fabrica Date: waitFor y los timers de React siguen reales
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['caja/ver', 'pedidos/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({
      reprogramar: [],
      cancelados: [],
      total: 0,
    } as any);
    // Hay 3 pendientes de días anteriores; la lista del día llega vacía salvo cuando se pide por rango
    listar = vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) =>
      f?.pendientes ? respuesta([], 3) : respuesta([]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** El día vive dentro del panel de Filtros: se abre si está cerrado */
  const abrirFiltros = async () => {
    const boton = await screen.findByRole('button', { name: /^Filtros/ });
    if (boton.getAttribute('aria-expanded') !== 'true') fireEvent.click(boton);
  };

  /** Abre el combo «Mostrar» y elige una opción */
  const elegirPeriodo = (opcion: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name: /^Mostrar: / }));
    fireEvent.click(screen.getByRole('option', { name: opcion }));
  };

  /** Llamadas a listar que piden la lista (no el conteo ligero de pendientes, limite 1) */
  const llamadasLista = () =>
    listar.mock.calls.map((c) => c[0]).filter((f: any) => !(f?.pendientes && f?.limite === 1));

  it('por defecto muestra hoy en Lima (desde = hasta = hoy de Lima) y el chip Hoy activo', async () => {
    render(<PedidosAdminView />);

    await waitFor(() => expect(llamadasLista()).toHaveLength(1));
    expect(llamadasLista()[0]).toEqual({ desde: HOY, hasta: HOY, limite: 100 });
    await abrirFiltros();
    expect(screen.getByRole('button', { name: 'Mostrar: Hoy' })).toBeInTheDocument();
    expect(screen.getByText(/Mostrando:/)).toHaveTextContent('hoy, 28 oct');
    expect(screen.queryByRole('button', { name: 'Volver a hoy' })).not.toBeInTheDocument();
  });

  it('el estado vacío de hoy dice «No hay pedidos hoy»', async () => {
    render(<PedidosAdminView />);
    expect(await screen.findByText('No hay pedidos hoy.')).toBeInTheDocument();
  });

  it('Ayer envía el día anterior y ofrece volver a hoy', async () => {
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));

    await abrirFiltros();
    elegirPeriodo(/Ayer/);

    await waitFor(() => expect(llamadasLista()).toHaveLength(2));
    expect(llamadasLista()[1]).toEqual({ desde: '2026-10-27', hasta: '2026-10-27', limite: 100 });
    expect(screen.getByText(/Mostrando:/)).toHaveTextContent('ayer, 27 oct');
    expect(await screen.findByText('No hay pedidos en ese rango.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a hoy' }));
    await waitFor(() => expect(llamadasLista()).toHaveLength(3));
    expect(llamadasLista()[2]).toEqual({ desde: HOY, hasta: HOY, limite: 100 });
  });

  it('Ayer muestra también los pedidos ya entregados (no solo los activos)', async () => {
    const entregadoAyer = {
      id: '900', codigo: 'CP-W900', estado: 'ENTREGADO', modalidad: 'LLEVAR', canal: 'CARTA',
      cliente_nombre: 'Rosa de Ayer', cliente_telefono: '987654321', total: 25, pago_estado: 'PAGADO',
      creado_en: '2026-10-27T18:00:00Z', lineas: [{ id: '1', nombre: 'Brownie', cantidad: 1 }],
    };
    listar.mockImplementation(async (f: any) =>
      f?.pendientes ? respuesta([], 0) : f?.desde === '2026-10-27' ? respuesta([entregadoAyer]) : respuesta([]),
    );
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));

    await abrirFiltros();
    elegirPeriodo(/Ayer/);

    expect(await screen.findByText('Rosa de Ayer')).toBeInTheDocument();
    expect(screen.queryByText('No hay pedidos con estos filtros.')).not.toBeInTheDocument();

    // Al volver a hoy se retoma el comportamiento de siempre (solo activos)
    fireEvent.click(screen.getByRole('button', { name: 'Volver a hoy' }));
    await waitFor(() => expect(screen.queryByText('Rosa de Ayer')).not.toBeInTheDocument());
  });

  it('Últimos 7 días envía de hace 6 días a hoy', async () => {
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));

    await abrirFiltros();
    elegirPeriodo(/Últimos 7 días/);

    await waitFor(() => expect(llamadasLista()).toHaveLength(2));
    expect(llamadasLista()[1]).toEqual({ desde: '2026-10-22', hasta: HOY, limite: 100 });
  });

  it('un rango válido elegido en las fechas se envía al servidor', async () => {
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));

    await abrirFiltros();
    elegirPeriodo(/Elegir día \/ rango/);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver estos días' }));

    await waitFor(() => expect(llamadasLista()).toHaveLength(2));
    expect(llamadasLista()[1]).toEqual({ desde: '2026-10-20', hasta: '2026-10-25', limite: 100 });
    expect(screen.getByText(/Mostrando:/)).toHaveTextContent('20 oct – 25 oct');
  });

  it('un rango inválido bloquea el botón y no pide nada nuevo', async () => {
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));

    await abrirFiltros();
    elegirPeriodo(/Elegir día \/ rango/);

    // Desde posterior a hasta
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-26' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior a la de fin');
    expect(screen.getByRole('button', { name: 'Ver estos días' })).toBeDisabled();

    // Hasta en el futuro
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-27' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-30' } });
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior a hoy');
    expect(screen.getByRole('button', { name: 'Ver estos días' })).toBeDisabled();

    expect(llamadasLista()).toHaveLength(1);
  });

  it('pendientes de días anteriores: el aviso cuenta y al tocarlo lista solo esos', async () => {
    render(<PedidosAdminView />);

    await abrirFiltros();
    expect(listar).toHaveBeenCalledWith({ pendientes: true, limite: 1 });

    fireEvent.click(screen.getByRole('button', { name: /^Mostrar: / }));
    const opcion = screen.getByRole('option', { name: /Pendientes de días anteriores/ });
    expect(opcion).toHaveTextContent('3');
    fireEvent.click(opcion);

    await waitFor(() => expect(llamadasLista()).toHaveLength(2));
    expect(llamadasLista()[1]).toEqual({ pendientes: true, limite: 100 });
    expect(screen.getByRole('button', { name: 'Mostrar: Pendientes de días anteriores' })).toBeInTheDocument();
    expect(screen.getByText(/Mostrando:/)).toHaveTextContent('pendientes de días anteriores');
  });

  it('sin pendientes no aparece el aviso', async () => {
    listar.mockImplementation(async () => respuesta([]));
    render(<PedidosAdminView />);
    await waitFor(() => expect(llamadasLista()).toHaveLength(1));
    expect(screen.queryByText(/pendientes de días anteriores/)).not.toBeInTheDocument();
  });
});

describe('filtroDias (lógica pura)', () => {
  it('hoyLima usa el día calendario de Lima, no UTC', () => {
    expect(hoyLima(new Date('2026-10-29T03:00:00Z'))).toBe('2026-10-28');
    expect(hoyLima(new Date('2026-10-29T14:00:00Z'))).toBe('2026-10-29');
  });

  it('sumarDias cruza meses sin depender de la zona horaria', () => {
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31');
    expect(sumarDias('2026-10-28', -6)).toBe('2026-10-22');
  });

  it('valida orden, futuro y máximo de 31 días', () => {
    expect(errorRangoPersonalizado('', '2026-10-28', '2026-10-28')).not.toBeNull();
    expect(errorRangoPersonalizado('2026-10-28', '2026-10-27', '2026-10-28')).toMatch(/posterior a la de fin/);
    expect(errorRangoPersonalizado('2026-10-27', '2026-10-29', '2026-10-28')).toMatch(/posterior a hoy/);
    // 1 de setiembre a 1 de octubre = 31 días: válido; 30 de agosto a 1 de octubre = 33 días: no
    expect(errorRangoPersonalizado('2026-09-01', '2026-10-01', '2026-10-28')).toBeNull();
    expect(errorRangoPersonalizado('2026-08-30', '2026-10-01', '2026-10-28')).toMatch(/31 días/);
    expect(errorRangoPersonalizado('2026-10-28', '2026-10-28', '2026-10-28')).toBeNull();
  });

  it('textoRango describe el rango activo', () => {
    expect(textoRango({ modo: 'hoy', desde: HOY, hasta: HOY }, HOY)).toBe('hoy, 28 oct');
    expect(textoRango({ modo: 'ayer', desde: '2026-10-27', hasta: '2026-10-27' }, HOY)).toBe('ayer, 27 oct');
    expect(textoRango({ modo: 'pendientes', desde: '', hasta: '' }, HOY)).toBe('pendientes de días anteriores');
  });
});
