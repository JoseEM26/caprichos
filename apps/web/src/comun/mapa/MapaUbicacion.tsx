import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { L, ATRIBUCION, CENTRO_DEFECTO, URL_TESELAS, iconoPin, iconoTienda } from './leaflet';

export interface Punto {
  lat: number;
  lng: number;
}

export interface PuntoLocal extends Punto {
  nombre?: string;
  direccion?: string;
}

export interface MapaUbicacionProps {
  punto: Punto | null;
  /** Se llama al tocar el mapa o al arrastrar el pin */
  onCambiar?: (punto: Punto) => void;
  altura?: number | string;
  etiqueta?: string;
  local?: PuntoLocal | null;
  ajustarA?: 'ambos' | 'punto' | 'local' | 'auto';
  soloLectura?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Mapa con un pin movible: el cliente o caja lo dejan donde se recibe el pedido (ADR-010). */
export function MapaUbicacion({
  punto,
  onCambiar,
  altura = 240,
  etiqueta = 'Mapa para marcar la entrega',
  local,
  ajustarA = 'auto',
  soloLectura = false,
  className,
  style,
}: MapaUbicacionProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const localPin = useRef<L.Marker | null>(null);
  const alCambiar = useRef(onCambiar);
  alCambiar.current = onCambiar;

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current, { zoomControl: true });

    // Determinar encuadre inicial
    if (local && punto && (ajustarA === 'ambos' || ajustarA === 'auto')) {
      const bounds = L.latLngBounds([
        [local.lat, local.lng],
        [punto.lat, punto.lng],
      ]);
      m.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (punto && (ajustarA === 'punto' || (!local && ajustarA === 'auto'))) {
      m.setView([punto.lat, punto.lng], 16);
    } else if (local && (ajustarA === 'local' || (!punto && ajustarA === 'auto'))) {
      m.setView([local.lat, local.lng], 15);
    } else {
      m.setView(CENTRO_DEFECTO, 14);
    }

    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);

    if (!soloLectura) {
      m.on('click', (e: L.LeafletMouseEvent) => {
        alCambiar.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      pin.current = null;
      localPin.current = null;
    };
    // El mapa se crea una sola vez; el punto y el local se sincronizan en los efectos siguientes
  }, []);

  // Observador de cambio de tamaño e invalidación de tamaño de Leaflet
  useEffect(() => {
    const timer = setTimeout(() => {
      mapa.current?.invalidateSize();
    }, 80);

    if (!contenedor.current || typeof ResizeObserver === 'undefined') {
      return () => clearTimeout(timer);
    }
    const ro = new ResizeObserver(() => {
      mapa.current?.invalidateSize();
    });
    ro.observe(contenedor.current);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  // Tienda física (marcador permanente no movible)
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!local) {
      localPin.current?.remove();
      localPin.current = null;
      return;
    }
    const pos: [number, number] = [local.lat, local.lng];
    const icon = iconoTienda(local.nombre || 'Caprichos', local.direccion || '');
    if (!localPin.current) {
      localPin.current = L.marker(pos, {
        interactive: false,
        keyboard: false,
        icon,
      }).addTo(m);
    } else {
      localPin.current.setLatLng(pos);
      localPin.current.setIcon(icon);
    }
  }, [local?.lat, local?.lng, local?.nombre, local?.direccion]);

  // Marcador del cliente (punto rojo)
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const pos: [number, number] = [punto.lat, punto.lng];
    const draggable = !soloLectura && Boolean(alCambiar.current);

    if (!pin.current) {
      pin.current = L.marker(pos, { draggable, icon: iconoPin() }).addTo(m);
      if (draggable) {
        pin.current.on('dragend', () => {
          const p = pin.current!.getLatLng();
          alCambiar.current?.({ lat: p.lat, lng: p.lng });
        });
      }
    } else {
      pin.current.setLatLng(pos);
    }
    if (!m.getBounds().contains(pos)) {
      m.setView(pos, Math.max(m.getZoom(), 16));
    }
  }, [punto, soloLectura]);

  return (
    <div
      ref={contenedor}
      className={`cp-mapa ${className || ''}`.trim()}
      role="application"
      aria-label={etiqueta}
      style={{
        height: typeof altura === 'number' ? `${altura}px` : altura,
        ...style,
      }}
    />
  );
}
