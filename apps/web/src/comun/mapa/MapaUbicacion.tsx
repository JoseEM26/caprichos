import { useEffect, useRef } from 'react';
import { L, ATRIBUCION, CENTRO_DEFECTO, URL_TESELAS, iconoPin } from './leaflet';

export interface Punto {
  lat: number;
  lng: number;
}

export interface MapaUbicacionProps {
  punto: Punto | null;
  /** Se llama al tocar el mapa o al arrastrar el pin */
  onCambiar: (punto: Punto) => void;
  altura?: number;
  etiqueta?: string;
}

/** Mapa con un pin movible: el cliente o caja lo dejan donde se recibe el pedido (ADR-010). */
export function MapaUbicacion({ punto, onCambiar, altura = 240, etiqueta = 'Mapa para marcar la entrega' }: MapaUbicacionProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const alCambiar = useRef(onCambiar);
  alCambiar.current = onCambiar;

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current, { zoomControl: true }).setView(
      punto ? [punto.lat, punto.lng] : CENTRO_DEFECTO,
      punto ? 17 : 14,
    );
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => alCambiar.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      pin.current = null;
    };
    // El mapa se crea una sola vez; el punto se sincroniza en el efecto siguiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const pos: [number, number] = [punto.lat, punto.lng];
    if (!pin.current) {
      pin.current = L.marker(pos, { draggable: true, icon: iconoPin() }).addTo(m);
      pin.current.on('dragend', () => {
        const p = pin.current!.getLatLng();
        alCambiar.current({ lat: p.lat, lng: p.lng });
      });
    } else {
      pin.current.setLatLng(pos);
    }
    if (!m.getBounds().contains(pos)) m.setView(pos, Math.max(m.getZoom(), 16));
  }, [punto]);

  return <div ref={contenedor} className="cp-mapa" role="application" aria-label={etiqueta} style={{ height: altura }} />;
}
