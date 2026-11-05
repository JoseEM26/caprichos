import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { impresionApi } from '../../impresion/impresionApi';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';
import { CATALOGO, idsInvalidos } from '../catalogo';
import { buscar } from '../catalogo/buscar';

vi.mock('../../../comun/socket', () => ({ useEventos: () => undefined }));
vi.mock('../../impresion/impresionApi', () => ({
  impresionApi: {
    obtenerMapa: vi.fn(),
    obtenerEstado: vi.fn(),
    listarTrabajos: vi.fn(),
    listarLlaves: vi.fn(),
    reintentarTrabajo: vi.fn(),
    crearLlave: vi.fn(),
    desactivarLlave: vi.fn(),
    guardarReglasImpresion: vi.fn(),
    asignarAreaEquipo: vi.fn(),
  },
}));

const estadoConectado = {
  agente: 'conectado',
  ultimoLatido: '2026-10-27T12:00:00.000Z',
  impresora: 'lista',
  pendientes: 2,
  fallidos: 1,
  impresoras: {
    ETIQUETERA: { conectada: true, estado: 'lista', motivo: null },
    TICKETERA: { conectada: true, estado: 'lista', motivo: null },
  },
};

const mapaMock = {
  duplicados: [],
  areas: [{ id: '1', nombre: 'Bebidas', equiposPorRol: { ETIQUETERA: null, TICKETERA: null } }],
  equipos: [{ deviceKeyId: '10', nombre: 'PC Caja', areaId: null, maquinas: ['ETIQUETERA'], roles: [{ rol: 'ETIQUETERA', estado: 'lista' }], ultimoLatido: null, conectado: true }],
  reglas: { generalModalidades: ['LLEVAR'], bebidaActivo: true, areaActivo: false, comandaSalonActivo: true, comandaAreaActivo: false },
  ruteo: [],
  colaPendientePorEquipo: [{ deviceKeyId: '10', pendientes: 0 }],
};

/** Muestra la URL actual para comprobar la sección en ?seccion=. */
function Ubicacion() {
  const l = useLocation();
  return <output data-testid="ubicacion">{l.search}</output>;
}

function usarSesion(permisos: string[] = ['configuracion/ver', 'configuracion/editar'], rol = 'ADMIN') {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol },
    permisos,
    debeCambiar: false, cargando: false, autenticado: true,
    ingresar: vi.fn(), salir: vi.fn(), renovar: vi.fn(), refrescarYo: vi.fn(), marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p) || (rol === 'ADMIN' && p === 'ADMIN'),
  } as any);
}

const montar = (url = '/admin/configuracion') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ConfiguracionLocalView />
      <Ubicacion />
    </MemoryRouter>,
  );

const ubicacion = () => screen.getByTestId('ubicacion').textContent ?? '';
const navegacion = () => screen.getByRole('tablist', { name: 'Categorías de configuración' });
const seccion = (nombre: RegExp) => screen.getByRole('tab', { name: nombre });
const ancho = (n: number) => {
  (window as any).innerWidth = n;
  window.dispatchEvent(new Event('resize'));
};

describe('Configuración: módulo único de Impresión', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    ancho(1024);
    vi.spyOn(api, 'get').mockResolvedValue({} as any);
    usarSesion();
    (impresionApi.obtenerMapa as any).mockResolvedValue(mapaMock);
    (impresionApi.obtenerEstado as any).mockResolvedValue(estadoConectado);
    (impresionApi.listarTrabajos as any).mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 });
    (impresionApi.listarLlaves as any).mockResolvedValue([]);
  });
  // Sin restaurar mocks aquí: RTL desmonta después y un render tardío necesita la sesión simulada.
  afterEach(() => ancho(1024));

  it('el menú tiene una sola entrada de impresión, dentro de Equipos y dispositivos', () => {
    montar();
    const nav = navegacion();
    expect(within(nav).getAllByRole('tab', { name: /^Impresión/ })).toHaveLength(1);
    expect(within(nav).queryByRole('tab', { name: /Mapa de impresión|Impresión de etiquetas/ })).not.toBeInTheDocument();
    expect(within(nav).getByRole('tab', { name: /^Impresión/ })).toHaveTextContent('Qué se imprime, en qué equipo y el estado de las impresoras');
    expect(screen.getByRole('button', { name: /Equipos y dispositivos/ })).toBeInTheDocument();
  });

  it('muestra las tres secciones y abre la que indica la URL', async () => {
    montar('/admin/configuracion?tab=impresion&seccion=mapa');
    const tabs = screen.getByRole('tablist', { name: 'Secciones de Impresión' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
    expect(seccion(/^Mapa/)).toHaveAttribute('aria-selected', 'true');
    expect(seccion(/^Equipos y estado/)).toHaveAttribute('aria-selected', 'false');
    expect(seccion(/^Cola y pruebas/)).toHaveAttribute('aria-selected', 'false');
    expect((await screen.findAllByText('Sticker de bebida')).length).toBeGreaterThan(0);
  });

  it('cada sección muestra lo suyo y no lo de las otras', async () => {
    montar('/admin/configuracion?tab=impresion&seccion=equipos');
    expect(await screen.findByText('Llaves de autenticación del agente')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.queryByText('Pruebas de impresión')).not.toBeInTheDocument();
    expect(screen.queryByText('Sticker de bebida')).not.toBeInTheDocument();

    fireEvent.click(seccion(/^Cola y pruebas/));
    expect(await screen.findByText('Ver y reintentar fallidos')).toBeInTheDocument();
    expect(screen.getByText('Pruebas de impresión')).toBeInTheDocument();
    expect(screen.queryByText('Llaves de autenticación del agente')).not.toBeInTheDocument();

    fireEvent.click(seccion(/^Mapa/));
    expect((await screen.findAllByText('Sticker de bebida')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Pruebas de impresión')).not.toBeInTheDocument();
  });

  it('la pestaña vieja ?tab=mapa-impresion redirige a la sección Mapa', async () => {
    montar('/admin/configuracion?tab=mapa-impresion');
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=mapa'));
    expect(seccion(/^Mapa/)).toHaveAttribute('aria-selected', 'true');
  });

  it('la pestaña vieja ?tab=impresion (era Impresión de etiquetas) redirige a Equipos y estado', async () => {
    montar('/admin/configuracion?tab=impresion');
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=equipos'));
    expect(seccion(/^Equipos y estado/)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Llaves de autenticación del agente')).toBeInTheDocument();
  });

  it('recuerda la última sección al volver a Impresión desde otra pestaña', async () => {
    montar('/admin/configuracion?tab=impresion&seccion=mapa');
    fireEvent.click(seccion(/^Cola y pruebas/));
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=cola'));

    fireEvent.click(within(navegacion()).getByRole('tab', { name: /^Datos del local/ }));
    await waitFor(() => expect(ubicacion()).toContain('tab=local'));

    fireEvent.click(within(navegacion()).getByRole('tab', { name: /^Impresión/ }));
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=cola'));
    expect(seccion(/^Cola y pruebas/)).toHaveAttribute('aria-selected', 'true');
    expect(localStorage.getItem('cfg_impresion_seccion')).toBe('cola');
  });

  it('las flechas, Inicio y Fin mueven la selección entre secciones', async () => {
    montar('/admin/configuracion?tab=impresion&seccion=mapa');
    fireEvent.keyDown(seccion(/^Mapa/), { key: 'ArrowRight' });
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=equipos'));
    expect(seccion(/^Equipos y estado/)).toHaveFocus();

    fireEvent.keyDown(seccion(/^Equipos y estado/), { key: 'End' });
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=cola'));

    fireEvent.keyDown(seccion(/^Cola y pruebas/), { key: 'ArrowRight' });
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=mapa'));

    fireEvent.keyDown(seccion(/^Mapa/), { key: 'ArrowLeft' });
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=cola'));

    fireEvent.keyDown(seccion(/^Cola y pruebas/), { key: 'Home' });
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=mapa'));
  });

  it('el buscador lleva a la sección del ajuste: pruebas en Cola y pruebas', async () => {
    montar();
    fireEvent.change(screen.getByRole('combobox', { name: /Buscar un ajuste/i }), { target: { value: 'pruebas' } });
    const primera = screen.getAllByRole('option')[0];
    expect(primera).toHaveTextContent(/Pruebas de impresión/);
    fireEvent.click(primera);
    await waitFor(() => expect(ubicacion()).toBe('?tab=impresion&seccion=cola&campo=impresion-pruebas'));
    await waitFor(() => expect(document.querySelector('[data-cfg-id="impresion-pruebas"]')).toBeInTheDocument());
  });

  it('el buscador lleva a Equipos y estado para una llave y a Mapa para el sticker', async () => {
    montar();
    fireEvent.change(screen.getByRole('combobox', { name: /Buscar un ajuste/i }), { target: { value: 'llave' } });
    fireEvent.click(screen.getAllByRole('option')[0]);
    await waitFor(() => expect(ubicacion()).toMatch(/^\?tab=impresion&seccion=equipos/));

    fireEvent.change(screen.getByRole('combobox', { name: /Buscar un ajuste/i }), { target: { value: 'sticker de bebida' } });
    fireEvent.click(screen.getAllByRole('option')[0]);
    await waitFor(() => expect(ubicacion()).toMatch(/^\?tab=impresion&seccion=mapa/));
  });

  it('la luz del título refleja el estado de los equipos', async () => {
    montar('/admin/configuracion?tab=impresion&seccion=equipos');
    await waitFor(() => expect(screen.getByTestId('imp-salud')).toHaveAttribute('data-nivel', 'ok'));
    expect(screen.getByTestId('imp-salud')).toHaveTextContent('Equipos conectados');
  });

  it('con una impresora desconectada la luz queda en ámbar', async () => {
    (impresionApi.obtenerEstado as any).mockResolvedValue({
      ...estadoConectado,
      impresoras: { ...estadoConectado.impresoras, TICKETERA: { conectada: false, estado: 'desconectada', motivo: 'USB' } },
    });
    montar('/admin/configuracion?tab=impresion&seccion=equipos');
    await waitFor(() => expect(screen.getByTestId('imp-salud')).toHaveAttribute('data-nivel', 'aviso'));
  });

  it('el catálogo de impresión no tiene ids repetidos y cada entrada usa una sección válida', () => {
    expect(idsInvalidos()).toEqual([]);
    const impresion = CATALOGO.filter((e) => e.tab === 'impresion');
    expect(impresion.length).toBeGreaterThan(0);
    for (const e of impresion) expect(['mapa', 'equipos', 'cola']).toContain(e.apartado);
    expect(CATALOGO.some((e) => e.tab === 'mapa-impresion')).toBe(false);
    expect(buscar(CATALOGO, 'impresroa').map((r) => r.entrada.id)).toContain('impresion-agente');
  });
});
