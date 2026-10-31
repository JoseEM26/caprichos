export interface UbicacionTexto {
  lat: number;
  lng: number;
}

const NUMERO = '-?\\d{1,3}(?:\\.\\d+)?';
const PAR_SIMPLE = new RegExp(`^\\s*(${NUMERO})\\s*[,\\s]\\s*(${NUMERO})\\s*$`);
const PIN_LUGAR = new RegExp(`!3d(${NUMERO})!4d(${NUMERO})`);
const CENTRO_MAPA = new RegExp(`@(${NUMERO}),(${NUMERO})`);
const PARAM_COORD = new RegExp(`[?&](?:q|ll|query|center)=(${NUMERO}),(${NUMERO})(?=[&#]|$)`);

function valido(lat: number, lng: number): UbicacionTexto | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function desdePar(a: string, b: string): UbicacionTexto | null {
  return valido(Number(a), Number(b));
}

/**
 * Lee un punto de un texto pegado: «-12.0123, -76.9456», «-12.0123 -76.9456» o un enlace largo de Google Maps
 * (…/@lat,lng…, ?q=lat,lng, ?ll=lat,lng, …!3d lat!4d lng…). Los enlaces cortos (maps.app.goo.gl) no se
 * pueden resolver aquí y devuelven null, igual que cualquier texto que no traiga coordenadas válidas.
 */
export function parsearUbicacion(texto: string): UbicacionTexto | null {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return null;

  const par = PAR_SIMPLE.exec(limpio);
  if (par) return desdePar(par[1], par[2]);

  if (!/^https?:\/\//i.test(limpio) && !/google\.|maps\./i.test(limpio)) return null;

  let decodificado = limpio;
  try {
    decodificado = decodeURIComponent(limpio);
  } catch {
    // Enlace con codificación rota: se usa tal cual
  }

  // El pin del lugar (!3d/!4d) es más exacto que el centro del mapa (@), y ?q= / ?ll= vienen después
  for (const patron of [PIN_LUGAR, CENTRO_MAPA, PARAM_COORD]) {
    const m = patron.exec(decodificado);
    if (m) {
      const r = desdePar(m[1], m[2]);
      if (r) return r;
    }
  }
  return null;
}
