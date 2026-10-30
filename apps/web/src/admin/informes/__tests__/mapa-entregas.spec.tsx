import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';

// Leaflet falso: registra qué capas se dibujan
const reg = vi.hoisted(() => ({ polis: [] as any[], tooltips: [] as string[], circulos: 0, marcadores: 0, zoomIn: vi.fn(), setView: vi.fn() }));
vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = () => {
    const o: any = {};
    o.addTo = () => o;
    o.bindTooltip = (t: string) => { reg.tooltips.push(t); return o; };
    o.bindPopup = () => o;
    o.getBounds = () => ({});
    o.openPopup = () => o;
    return o;
  };
  const L = {
    map: () => {
      const m: any = { setView: (...a: any[]) => { reg.setView(...a); return m; }, invalidateSize: () => {}, remove: () => {}, zoomIn: reg.zoomIn, zoomOut: () => {}, fitBounds: () => {} };
      return m;
    },
    tileLayer: capa,
    layerGroup: () => { const g: any = capa(); g.clearLayers = () => { reg.polis = []; reg.tooltips = []; reg.circulos = 0; reg.marcadores = 0; }; return g; },
    polygon: (pts: any) => { reg.polis.push(pts); return capa(); },
    circle: () => { reg.circulos++; return capa(); },
    circleMarker: () => capa(),
    marker: () => { reg.marcadores++; return capa(); },
    divIcon: () => ({}),
  };
  return { L, URL_TESELAS: '', ATRIBUCION: '' };
});
import { MapaEntregasView } from '../MapaEntregasView';

const datos = (puntos: any[] = [{ lat: -12.0, lng: -76.9, enZona: true }]) => ({
  sede: { lat: -12.02, lng: -76.96, nombre: 'Caprichos' },
  puntos,
  kpis: [{ n: 'Pedidos con entrega', v: '3' }],
  zonas: [{ zona: 'Z9', nombre: 'Zona Z9', poligono: [[-12, -76.9], [-12, -76.8], [-12.1, -76.8]], pedidos: 3, ventas: 's/ 30.00', porcentaje: '100 %', barraAncho: '100%' }],
  radios: [
    { rango: '0 a 500 m', etiqueta: '500 m', metros: 500, pedidos: 1 },
    { rango: '500 m a 1 km', etiqueta: '1 km', metros: 1000, pedidos: 2 },
  ],
  fueraCoberturaTexto: 'Sin intentos fuera.',
  fueraCoberturaConteo: 0,
});

describe('MapaEntregasView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    reg.polis = []; reg.tooltips = []; reg.circulos = 0; reg.marcadores = 0;
  });

  it('dibuja las zonas que llegan del API, con etiquetas de distancia', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos() as any);
    render(<MapaEntregasView />);
    expect(await screen.findByText('Pedidos con entrega')).toBeInTheDocument();
    await waitFor(() => expect(reg.polis).toHaveLength(1));
    expect(reg.polis[0][0]).toEqual([-12, -76.9]);
    expect(reg.tooltips).toEqual(expect.arrayContaining(['Zona Z9', '500 m', '1 km']));
    expect(reg.circulos).toBe(2);
    expect(screen.getByText('Zona Z9 · 3 pedidos')).toBeInTheDocument();
  });

  it('las capas se apagan y encienden con sus casillas', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos() as any);
    render(<MapaEntregasView />);
    await waitFor(() => expect(reg.polis).toHaveLength(1));
    fireEvent.click(screen.getByRole('checkbox', { name: /Zonas de reparto/ }));
    await waitFor(() => expect(reg.polis).toHaveLength(0));
    fireEvent.click(screen.getByRole('checkbox', { name: /Distancias desde la tienda/ }));
    await waitFor(() => expect(reg.circulos).toBe(0));
    fireEvent.click(screen.getByRole('checkbox', { name: /Zonas de reparto/ }));
    await waitFor(() => expect(reg.polis).toHaveLength(1));
  });

  it('sin pedidos avisa y mantiene las zonas', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(datos([]) as any);
    render(<MapaEntregasView />);
    expect(await screen.findByText(/No hay pedidos con ubicación/)).toBeInTheDocument();
    expect(reg.polis).toHaveLength(1);
  });

  it('con error ofrece Reintentar', async () => {
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('x')).mockResolvedValue(datos() as any);
    render(<MapaEntregasView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Pedidos con entrega')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('cambiar período vuelve a pedir los datos', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(datos() as any);
    render(<MapaEntregasView />);
    await screen.findByText('Pedidos con entrega');
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.stringContaining('periodo=7')));
  });
});
