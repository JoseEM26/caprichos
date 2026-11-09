import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompartirUbicacion } from '../CompartirUbicacion';
import { RepartidoresEnVivo } from '../RepartidoresEnVivo';
import { RepartosView } from '../RepartosView';
import { repartosApi } from '../repartosApi';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

const leaf = vi.hoisted(() => {
  const mapa: any = {};
  for (const k of ['setView', 'fitBounds', 'panTo', 'remove', 'on']) mapa[k] = vi.fn(() => mapa);
  const marcador = () => {
    const m: any = {};
    for (const k of ['setLatLng', 'setIcon', 'remove', 'on', 'setRadius', 'setStyle', 'setLatLngs']) m[k] = vi.fn(() => m);
    m.addTo = vi.fn(() => m);
    return m;
  };
  return { mapa, marcador, marcadores: [] as any[] };
});
vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = (): any => ({ addTo() { return this; } });
  return {
    ATRIBUCION: '',
    URL_TESELAS: '',
    CENTRO_DEFECTO: [-12, -77],
    L: {
      map: () => leaf.mapa,
      control: { zoom: capa, attribution: capa },
      tileLayer: capa,
      divIcon: (o: any) => o,
      marker: () => { const m = leaf.marcador(); leaf.marcadores.push(m); return m; },
      circle: () => leaf.marcador(),
      polyline: () => leaf.marcador(),
      latLngBounds: (c: unknown) => ({ pad: () => c }),
    },
  };
});

vi.mock('../MapaRepartos', () => ({ MapaRepartos: () => null }));

// ---------- Captura en la app del repartidor ----------
describe('Repartidor: compartir ubicación con el local', () => {
  let cb: (p: any) => void;
  let err: (e: any) => void;
  const watchPosition = vi.fn();
  const clearWatch = vi.fn();
  const pos = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng, accuracy: 12, heading: null, speed: null } });

  beforeEach(() => {
    vi.useFakeTimers();
    watchPosition.mockImplementation((ok, ko) => { cb = ok; err = ko; return 5; });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition, clearWatch } });
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); watchPosition.mockReset(); clearWatch.mockReset(); });

  it('con pedidos en camino envía la posición; sin moverse no repite antes de 60 s; moviéndose >15 m sí', () => {
    render(<CompartirUbicacion hayEnCamino />);
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Compartiendo tu ubicación con el local')).toBeTruthy();
    expect(screen.getByText(/Solo el local la ve, solo mientras tienes pedidos en camino/)).toBeTruthy();
    act(() => cb(pos(-12.05, -77.04)));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect((api.post as any).mock.calls[0][0]).toBe('/admin/repartos/ubicacion');
    expect((api.post as any).mock.calls[0][1]).toMatchObject({ lat: -12.05, lng: -77.04, precision: 12 });
    act(() => { vi.advanceTimersByTime(12_000); cb(pos(-12.05, -77.04)); });
    expect(api.post).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1_000); cb(pos(-12.0502, -77.04)); }); // ~22 m
    expect(api.post).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(65_000); });
    expect(api.post).toHaveBeenCalledTimes(3); // latido de 60 s
  });

  it('se detiene al no haber pedidos en camino y no muestra nada', () => {
    const { rerender, container } = render(<CompartirUbicacion hayEnCamino />);
    rerender(<CompartirUbicacion hayEnCamino={false} />);
    expect(clearWatch).toHaveBeenCalledWith(5);
    expect(container.textContent).toBe('');
  });

  it('el botón apaga y vuelve a encender el envío', () => {
    render(<CompartirUbicacion hayEnCamino />);
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de compartir' }));
    expect(clearWatch).toHaveBeenCalled();
    expect(screen.getByText('Ubicación apagada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Compartir mi ubicación con el local/ }));
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it('permiso denegado: no rompe, dice «Ubicación apagada» y no envía', () => {
    render(<CompartirUbicacion hayEnCamino />);
    act(() => err({ code: 1 }));
    expect(screen.getByText(/Ubicación apagada/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sin GPS en el equipo: avisa sin romper', () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    render(<CompartirUbicacion hayEnCamino />);
    expect(screen.getByText(/Ubicación apagada/)).toBeTruthy();
  });
});

// ---------- Vista del personal ----------
describe('Repartidores en vivo (personal)', () => {
  let alLlegar: (e: any) => void;
  const fila = (o: any = {}) => ({
    repartidorId: '7', nombre: 'Rosa Gil', telefono: '987654321', lat: -12.05, lng: -77.04, precision: 15,
    en: new Date().toISOString(), pedidos: [{ codigo: 'CP-1', etapa: 'EN_CAMINO', direccion: 'Av. Sol 1', lat: -12.06, lng: -77.05 }], ...o,
  });

  beforeEach(() => {
    leaf.marcadores.length = 0;
    Object.values(leaf.mapa).forEach((f: any) => f.mockClear?.());
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: any) => { if (ev === 'reparto:ubicacion') alLlegar = fn; }) as any);
    vi.spyOn(socketModulo, 'useSocketConectado').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lista el repartidor con frescura, y al llegar una posición por socket mueve el marcador sin recentrar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([fila()] as any);
    render(<RepartidoresEnVivo esperados={[{ id: '7', nombre: 'Rosa Gil' }, { id: '8', nombre: 'Beto Paz' }]} />);
    await screen.findByText(/Rosa Gil · 1 pedido/);
    expect(screen.getByText(/En vivo · actualizado \d\d:\d\d:\d\d/)).toBeTruthy();
    expect(screen.getByText('Beto Paz')).toBeTruthy();
    expect(screen.getByText('Sin ubicación')).toBeTruthy();
    await waitFor(() => expect(leaf.marcadores.length).toBeGreaterThan(0));
    const fits = leaf.mapa.fitBounds.mock.calls.length;
    expect(fits).toBe(1); // solo el primer encuadre
    act(() => alLlegar({ repartidorId: '7', nombre: 'Rosa Gil', lat: -12.051, lng: -77.041, precision: 10, en: new Date().toISOString(), pedidos: ['CP-1'] }));
    expect(leaf.marcadores[0].setLatLng).toHaveBeenLastCalledWith([-12.051, -77.041]);
    expect(leaf.mapa.fitBounds.mock.calls.length).toBe(fits);
    expect(leaf.mapa.setView).toHaveBeenCalledTimes(1); // la vista inicial del mapa, nunca por posición nueva
    fireEvent.click(screen.getByRole('button', { name: 'Centrar en todos' }));
    expect(leaf.mapa.fitBounds.mock.calls.length).toBe(fits + 1);
  });

  it('la tarjeta muestra teléfono para llamar, pedidos y «Seguir a»', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([fila()] as any);
    render(<RepartidoresEnVivo />);
    fireEvent.click(await screen.findByRole('button', { name: /Rosa Gil · 1 pedido/ }));
    const t = screen.getByTestId('tarjeta-repartidor-vivo');
    expect(t.textContent).toContain('CP-1 · en camino · Av. Sol 1');
    expect(screen.getByRole('link', { name: /Llamar/ }).getAttribute('href')).toBe('tel:987654321');
    fireEvent.click(screen.getByRole('button', { name: 'Seguir a Rosa' }));
    await waitFor(() => expect(leaf.mapa.panTo).toHaveBeenCalledWith([-12.05, -77.04]));
  });

  it('una posición de 8 min sale en ámbar con «hace 8 min»', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([fila({ en: new Date(Date.now() - 8 * 60_000).toISOString() })] as any);
    render(<RepartidoresEnVivo />);
    expect(await screen.findByText('hace 8 min')).toBeTruthy();
  });
});

// ---------- La pestaña solo aparece con permiso ----------
describe('RepartosView: pestaña «En vivo»', () => {
  const sesion = (permisos: string[]) =>
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'X', rol: 'MOZO' }, permisos, debeCambiar: false, cargando: false, autenticado: true,
      tiene: (p: string) => permisos.includes(p),
    } as any);
  beforeEach(() => {
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation(() => {});
    vi.spyOn(socketModulo, 'useSocketConectado').mockReturnValue(true);
    vi.spyOn(repartosApi, 'obtenerPanel').mockResolvedValue({ generado_en: '', max_pedidos: 3, resumen: {}, repartidores: [], sin_tomar: [] } as any);
    vi.spyOn(repartosApi, 'obtenerSeguimiento').mockResolvedValue({ generado_en: '', pedidos: [] } as any);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue(null as any);
    vi.spyOn(repartosApi, 'obtenerZonasPoligonos').mockResolvedValue(null as any);
    vi.spyOn(api, 'get').mockResolvedValue([] as any);
  });
  afterEach(() => vi.restoreAllMocks());
  const montar = (v = '') => render(<MemoryRouter initialEntries={[`/admin/repartos${v}`]}><RepartosView /></MemoryRouter>);

  it('sin repartos/ver_ubicacion no hay pestaña ni capa (ni entrando por la URL)', async () => {
    sesion(['repartos/seguir']);
    montar('?vista=envivo');
    await screen.findByRole('button', { name: 'Despacho' });
    expect(screen.queryByRole('button', { name: /En vivo/ })).toBeNull();
    expect(screen.queryByTestId('repartidores-en-vivo')).toBeNull();
  });

  it('con repartos/ver_ubicacion aparece y abre la capa', async () => {
    sesion(['repartos/seguir', 'repartos/ver_ubicacion']);
    montar('?vista=envivo');
    expect(await screen.findByTestId('repartidores-en-vivo')).toBeTruthy();
    expect(screen.getByRole('button', { name: /En vivo/ })).toBeTruthy();
  });
});
