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

    const timer = setTimeout(() => {
      m.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
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
        icon: iconoPin(
          `${p.color ?? ''} ${p.id === seleccionado ? 'elegido' : ''}`,
          p.orden ? String(p.orden) : '',
        ),
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
    // Marcador del local «Caprichos» (acta 03, DT-59)
    const marcadorTienda = L.marker(CENTRO_DEFECTO, {
      icon: L.divIcon({
        className: 'cp-local-marker',
        html: '<div style="display:inline-flex;align-items:center;gap:6px;pointer-events:none;"><div style="width:16px;height:16px;background:#0B2C3E;border-radius:4px;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(11,44,62,0.4)"></div><span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:12px;color:#0B2C3E;background:rgba(255,255,255,0.92);padding:2px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.2);white-space:nowrap;">Caprichos</span></div>',
        iconSize: [110, 24],
        iconAnchor: [8, 12],
      }),
      title: 'Caprichos',
      zIndexOffset: 1000,
    });
    marcadorTienda.addTo(g);

    const todosCoords = [CENTRO_DEFECTO, ...coords];
    if (coords.length === 0) {
      m.setView(CENTRO_DEFECTO, 14);
    } else {
      m.fitBounds(L.latLngBounds(todosCoords), { padding: [50, 50], maxZoom: 17 });
    }
  }, [puntos, seleccionado]);

  return <div ref={contenedor} className="cp-mapa" role="application" aria-label="Mapa de pedidos por entregar" style={{ height: altura }} />;
}
