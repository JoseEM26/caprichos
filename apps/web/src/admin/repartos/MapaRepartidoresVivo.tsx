import { useEffect, useRef } from 'react';
import { L, ATRIBUCION, URL_TESELAS, CENTRO_DEFECTO } from '../../comun/mapa/leaflet';
import { frescuraDe, iniciales, textoHace, UbicacionVivo } from './frescuraUbicacion';

interface Props {
  repartidores: UbicacionVivo[];
  ahora: number;
  seleccionadoId: string | null;
  seguirId: string | null;
  /** Cambia (número) cada vez que se pulsa «Centrar en todos». */
  centrarClave: number;
  onSeleccionar: (id: string) => void;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function icono(r: UbicacionVivo, ahora: number, elegido: boolean) {
  const f = frescuraDe(r.en, ahora);
  return L.divIcon({
    className: 'cp-repartidor-vivo',
    html:
      `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">` +
      `<span style="width:${elegido ? 40 : 34}px;height:${elegido ? 40 : 34}px;border-radius:50%;background:${f.color};color:#fff;border:3px solid #FBF4EC;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font:800 13px sans-serif">🛵</span>` +
      `<span style="background:#0B2C3E;color:#FBF4EC;border-radius:8px;padding:1px 6px;font:700 11px sans-serif;white-space:nowrap">${esc(iniciales(r.nombre))} ${esc(r.nombre.split(' ')[0])} · ${esc(f.clave === 'EN_VIVO' ? textoHace(r.en, ahora) : f.texto)}</span>` +
      `</div>`,
    iconSize: [90, 56],
    iconAnchor: [45, 20],
  });
}

/**
 * Mapa de repartidores en vivo. Los marcadores se mueven con setLatLng: el zoom y el centro del usuario
 * no se tocan salvo en el primer encuadre, con «Centrar en todos» o al seguir a un repartidor.
 */
export function MapaRepartidoresVivo({ repartidores, ahora, seleccionadoId, seguirId, centrarClave, onSeleccionar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const marcas = useRef(new Map<string, { marker: any; halo: any; linea: any }>());
  const encuadrado = useRef(false);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current, { zoomControl: false, attributionControl: false }).setView(CENTRO_DEFECTO, 13);
    L.control.zoom({ position: 'bottomleft' }).addTo(m);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(m);
    mapa.current = m;
    const mapas = marcas.current;
    return () => {
      mapas.clear();
      m.remove();
      mapa.current = null;
      encuadrado.current = false;
    };
  }, []);

  // Altas, movimientos y bajas sin recentrar
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const vistos = new Set<string>();
    for (const r of repartidores) {
      vistos.add(r.repartidorId);
      const pos: [number, number] = [r.lat, r.lng];
      const proximo = r.pedidos.find((p) => p.etapa !== 'LLEGADO' && p.lat != null && p.lng != null);
      const trazo: Array<[number, number]> = proximo ? [pos, [proximo.lat!, proximo.lng!]] : [];
      let e = marcas.current.get(r.repartidorId);
      if (!e) {
        const marker = L.marker(pos, { icon: icono(r, ahora, false), keyboard: true, title: r.nombre }).addTo(m);
        marker.on('click', () => alSeleccionar.current(r.repartidorId));
        const halo = L.circle(pos, { radius: r.precision ?? 30, color: '#2F7A45', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
        const linea = L.polyline(trazo, { color: '#E67929', weight: 3, dashArray: '6 6', interactive: false }).addTo(m);
        e = { marker, halo, linea };
        marcas.current.set(r.repartidorId, e);
      } else {
        e.marker.setLatLng(pos);
        e.halo.setLatLng(pos);
        e.halo.setRadius(r.precision ?? 30);
        e.linea.setLatLngs(trazo);
      }
      e.marker.setIcon(icono(r, ahora, r.repartidorId === seleccionadoId));
      e.halo.setStyle({ color: frescuraDe(r.en, ahora).color });
    }
    for (const [id, e] of [...marcas.current]) {
      if (vistos.has(id)) continue;
      e.marker.remove();
      e.halo.remove();
      e.linea.remove();
      marcas.current.delete(id);
    }
    // Primer encuadre automático, una sola vez
    if (!encuadrado.current && repartidores.length > 0) {
      encuadrado.current = true;
      m.fitBounds(L.latLngBounds(repartidores.map((r) => [r.lat, r.lng] as [number, number])).pad(0.3), { maxZoom: 16 });
    }
    // Seguir a un repartidor: solo mueve el centro, conserva el zoom
    const seguido = repartidores.find((r) => r.repartidorId === seguirId);
    if (seguido) m.panTo([seguido.lat, seguido.lng]);
  }, [repartidores, ahora, seleccionadoId, seguirId]);

  // «Centrar en todos»
  useEffect(() => {
    const m = mapa.current;
    if (!m || centrarClave === 0 || repartidores.length === 0) return;
    m.fitBounds(L.latLngBounds(repartidores.map((r) => [r.lat, r.lng] as [number, number])).pad(0.3), { maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrarClave]);

  return <div ref={contenedor} data-testid="mapa-repartidores-vivo" style={{ position: 'absolute', inset: 0 }} role="application" aria-label="Mapa de repartidores en vivo" />;
}
