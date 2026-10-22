import { useEffect, useRef } from 'react';
import { L, ATRIBUCION, CENTRO_DEFECTO, URL_TESELAS, iconoPin } from './leaflet';

export interface PuntoPedido {
  id: string;
  lat: number;
  lng: number;
  etiqueta: string;
  detalle?: string;
  color?: 'verde' | 'naranja' | 'rojo';
  orden?: number;
}

export interface MapaPedidosProps {
  puntos: PuntoPedido[];
  seleccionado?: string | null;
  onSeleccionar?: (id: string) => void;
  altura?: number | string;
}

/** Mapa de pedidos por entregar: el zoom abarca todos los puntos (FT-DEL-02, DT-59). */
export function MapaPedidos({ puntos, seleccionado, onSeleccionar, altura = 360 }: MapaPedidosProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current).setView(CENTRO_DEFECTO, 14);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      capa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    const coords: L.LatLngTuple[] = [];
    for (const p of puntos) {
      const pos: L.LatLngTuple = [p.lat, p.lng];
      coords.push(pos);
      const marcador = L.marker(pos, {
        icon: iconoPin(`${p.color ?? ''} ${p.id === seleccionado ? 'elegido' : ''}`),
        title: `${p.etiqueta}${p.detalle ? ` · ${p.detalle}` : ''}`,
      });
      const numero = p.orden ? `${p.orden}. ` : '';
      const etiqueta = document.createElement('div');
      etiqueta.textContent = `${numero}${p.etiqueta}`;
      if (p.detalle) {
        const chico = document.createElement('small');
        chico.textContent = p.detalle;
        etiqueta.appendChild(chico);
      }
      marcador.bindTooltip(etiqueta, { permanent: true, direction: 'right', offset: [10, -14], className: 'cp-etiqueta' });
      marcador.on('click', () => alSeleccionar.current?.(p.id));
      marcador.addTo(g);
    }
    if (coords.length === 1) m.setView(coords[0], 16);
    else if (coords.length > 1) m.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 17 });
  }, [puntos, seleccionado]);

  return <div ref={contenedor} className="cp-mapa" role="application" aria-label="Mapa de pedidos por entregar" style={{ height: altura }} />;
}
