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

/** Marcador para la tienda física de Caprichos (círculo azul marino con la letra C y etiqueta) */
export const iconoTienda = (nombre = 'Caprichos', direccion = ''): L.DivIcon =>
  L.divIcon({
    className: 'cp-local-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:none;">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--cp-navy, #0B2C3E);border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(11,44,62,0.45);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:16px;font-family:var(--fuente-titulos, sans-serif);">C</div>
      <div class="cp-etiqueta" style="margin-top:4px;text-align:center;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <strong>${nombre}</strong>
        ${direccion ? `<small style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${direccion}</small>` : ''}
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
