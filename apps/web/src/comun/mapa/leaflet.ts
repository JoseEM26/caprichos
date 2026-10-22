import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapa.css';

export { L };

/** Zona de reparto (Campoy, Mangomarca, Huachipa) */
export const CENTRO_DEFECTO: [number, number] = [-12.0165, -76.975];

export const URL_TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Pin dibujado con CSS: evita los iconos por defecto de Leaflet, que fallan con el empaquetador */
export const iconoPin = (clase = ''): L.DivIcon =>
  L.divIcon({ className: `cp-pin ${clase}`, html: '<span></span>', iconSize: [26, 26], iconAnchor: [13, 26] });

export const enlaceGoogleMaps = (lat: number, lng: number): string =>
  `https://www.google.com/maps?q=${lat},${lng}`;
