import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapaRepartos, PuntoRepartoMapa } from '../MapaRepartos';
import { claveConjuntoMapa } from '../ajusteVistaMapa';

// Leaflet simulado: el mapa y sus métodos de encuadre quedan espiados
const mapa = vi.hoisted(() => {
  const m: any = {};
  for (const k of ['setView', 'fitBounds', 'on', 'remove', 'invalidateSize']) m[k] = vi.fn(() => m);
  m.getZoom = vi.fn(() => 16);
  m.latLngToContainerPoint = vi.fn(() => ({ x: 0, y: 0 }));
  return m;
});

vi.mock('../../../comun/mapa/leaflet', () => {
  const capa = (): any => {
    const o: any = {};
    for (const k of ['addTo', 'clearLayers', 'bindPopup', 'bindTooltip', 'unbindTooltip', 'openTooltip', 'on']) o[k] = () => o;
    o.getElement = () => null;
    return o;
  };
  return {
    ATRIBUCION: '',
    URL_TESELAS: '',
    L: {
      map: () => mapa,
      control: { zoom: capa, attribution: capa },
      tileLayer: capa,
      layerGroup: capa,
      marker: capa,
      polyline: capa,
      divIcon: () => ({}),
      latLngBounds: (coords: unknown) => coords,
      DomEvent: { stopPropagation: () => {} },
    },
  };
});

const punto = (id: string, lat = -12.02, lng = -76.96): PuntoRepartoMapa => ({
  id,
  lat,
  lng,
  etiqueta: `Cliente ${id}`,
  codigo: `CP-${id}`,
  color: 'verde' as any,
});

describe('MapaRepartos: zoom automático de pedidos activos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('al cargar encuadra todos los pedidos activos y la sede con margen', () => {
    render(<MapaRepartos puntos={[punto('1'), punto('2', -12.05, -76.99)]} />);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(1);
    const [coords, opciones] = mapa.fitBounds.mock.calls[0] as any[];
    expect(coords[0]).toEqual([-12.0196436, -76.963255]); // la sede va incluida
    expect(coords).toHaveLength(3); // sede + 2 pedidos
    expect(opciones).toEqual({ padding: [45, 45], maxZoom: 17 });
  });

  it('un nuevo array con los mismos pedidos (otro orden, sondeo) no vuelve a encuadrar', () => {
    const { rerender } = render(<MapaRepartos puntos={[punto('1'), punto('2')]} />);
    rerender(<MapaRepartos puntos={[punto('2'), punto('1')]} />);
    rerender(<MapaRepartos puntos={[punto('2', -12.03, -76.97), punto('1')]} />);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('cuando cambia el conjunto de pedidos activos vuelve a encuadrar', () => {
    const { rerender } = render(<MapaRepartos puntos={[punto('1')]} />);
    rerender(<MapaRepartos puntos={[punto('1'), punto('3')]} />);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(2);
  });

  it('cuando cambia el filtro de zona vuelve a encuadrar', () => {
    const { rerender } = render(<MapaRepartos puntos={[punto('1')]} />);
    rerender(<MapaRepartos puntos={[punto('1')]} zonaFiltroActiva="norte" />);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(2);
  });

  it('no reajusta al seleccionar o resaltar un pedido', () => {
    const { rerender } = render(<MapaRepartos puntos={[punto('1'), punto('2')]} />);
    rerender(<MapaRepartos puntos={[punto('1'), punto('2')]} seleccionadoId="2" resaltadosIds={['1']} />);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('«Ver todos los pedidos» vuelve a encuadrar, con botón de 44 px mínimo', () => {
    render(<MapaRepartos puntos={[punto('1'), punto('2')]} />);
    const boton = screen.getByRole('button', { name: 'Ver todos los pedidos' });
    expect(boton.style.minHeight).toBe('44px');

    fireEvent.click(boton);

    expect(mapa.fitBounds).toHaveBeenCalledTimes(2);
  });

  it('sin pedidos activos centra en la sede con el zoom actual, sin encuadrar', () => {
    render(<MapaRepartos puntos={[]} />);

    expect(mapa.fitBounds).not.toHaveBeenCalled();
    expect(mapa.setView).toHaveBeenCalledWith([-12.0196436, -76.963255], 16);
  });
});

describe('claveConjuntoMapa', () => {
  it('no depende del orden y cambia con el conjunto o el filtro', () => {
    expect(claveConjuntoMapa(['2', '1'])).toBe(claveConjuntoMapa(['1', '2']));
    expect(claveConjuntoMapa(['1'])).not.toBe(claveConjuntoMapa(['1', '2']));
    expect(claveConjuntoMapa(['1'], 'norte')).not.toBe(claveConjuntoMapa(['1']));
    expect(claveConjuntoMapa([])).toBe('|');
  });
});
