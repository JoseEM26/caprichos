import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './mapa.css';

export { L };

/** Caprichos Campoy: el mapa abre aquí mientras el cliente no marque otro punto */
export const CENTRO_DEFECTO: [number, number] = [-12.0196436, -76.963255];

export const URL_TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Pin dibujado con CSS: evita los iconos por defecto de Leaflet, que fallan con el empaquetador */
export const iconoPin = (clase = '', texto = ''): L.DivIcon =>
  L.divIcon({
    className: `cp-pin ${clase}`.trim(),
    html: `<span></span>${texto ? `<strong class="cp-pin-num">${texto}</strong>` : ''}`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });

export const enlaceGoogleMaps = (lat: number, lng: number): string =>
  `https://www.google.com/maps?q=${lat},${lng}`;
