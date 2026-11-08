/**
 * Plus Code (Open Location Code, OLC) sin dependencias: algoritmo estándar con el alfabeto
 * 23456789CFGHJMPQRVWX. 10 dígitos ≈ 14×14 m; 11 dígitos ≈ 3×3.5 m. Funciones puras.
 */
const ALFABETO = '23456789CFGHJMPQRVWX';
const SEPARADOR = '+';
const POS_SEPARADOR = 8;
const GRID_FILAS = 5;
const GRID_COLS = 4;
const LAT_FINAL = 25_000_000; // celdas por grado de latitud con 15 dígitos
const LNG_FINAL = 8_192_000;

export interface AreaPlusCode {
  latCentro: number;
  lngCentro: number;
  latMin: number;
  lngMin: number;
  latMax: number;
  lngMax: number;
  longitud: number;
}

/** Caja holgada de Perú: solo ahí se acepta un Plus Code escrito por el cliente. */
const PERU = { latMin: -18.5, latMax: 0.2, lngMin: -81.5, lngMax: -68.5 };
/** Referencia para completar códigos cortos con localidad (Lima y distritos). */
const LIMA = { lat: -12.0464, lng: -77.0428 };
const LOCALIDADES_LIMA = new Set([
  'lima', 'callao', 'miraflores', 'surco', 'santiago de surco', 'san isidro', 'barranco', 'la molina', 'san borja',
  'jesus maria', 'jesús maría', 'magdalena', 'san miguel', 'lince', 'surquillo', 'chorrillos', 'ate', 'los olivos',
]);

/** Codifica lat/lng. `longitud` de 10 (por defecto, «XXXXXXXX+XX») a 15 dígitos. */
export function codificarPlusCode(lat: number, lng: number, longitud = 10): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas inválidas');
  const n = Math.min(15, Math.max(10, Math.floor(longitud)));
  const la = Math.min(90, Math.max(-90, lat));
  const lo = ((((lng + 180) % 360) + 360) % 360) - 180;
  let latVal = Math.floor(Math.round((la + 90) * LAT_FINAL * 1e6) / 1e6);
  let lngVal = Math.floor(Math.round((lo + 180) * LNG_FINAL * 1e6) / 1e6);
  latVal = Math.min(latVal, 180 * LAT_FINAL - 1); // lat 90 cae en la última celda
  lngVal = Math.min(lngVal, 360 * LNG_FINAL - 1);
  const grid = n - 10;
  latVal = Math.floor(latVal / GRID_FILAS ** (5 - grid));
  lngVal = Math.floor(lngVal / GRID_COLS ** (5 - grid));
  let codigo = '';
  for (let i = 0; i < grid; i++) {
    codigo = ALFABETO[(latVal % GRID_FILAS) * GRID_COLS + (lngVal % GRID_COLS)] + codigo;
    latVal = Math.floor(latVal / GRID_FILAS);
    lngVal = Math.floor(lngVal / GRID_COLS);
  }
  for (let i = 0; i < 5; i++) {
    codigo = ALFABETO[lngVal % 20] + codigo;
    codigo = ALFABETO[latVal % 20] + codigo;
    latVal = Math.floor(latVal / 20);
    lngVal = Math.floor(lngVal / 20);
  }
  return codigo.slice(0, POS_SEPARADOR) + SEPARADOR + codigo.slice(POS_SEPARADOR);
}

/** Forma corta de 10 dígitos: los últimos 7 caracteres («7P7J+2X»). Sola es ambigua; con localidad se ubica. */
export function plusCodeCorto(lat: number, lng: number): string {
  return codificarPlusCode(lat, lng, 10).slice(4);
}

/** Texto para mostrar: «7P7J+2X Lima» cerca de Lima (≈ 55 km, la referencia lo desambigua); fuera, el código completo. */
export function plusCodeParaMostrar(lat: number, lng: number): string {
  const cerca = Math.abs(lat - LIMA.lat) < 0.5 && Math.abs(lng - LIMA.lng) < 0.5;
  return cerca ? `${plusCodeCorto(lat, lng)} Lima` : codificarPlusCode(lat, lng, 10);
}

function normalizar(codigo: string): string {
  return String(codigo ?? '').trim().toUpperCase();
}

/** Código válido (completo o corto); sin relleno con ceros. */
export function esPlusCodeValido(codigo: string): boolean {
  const c = normalizar(codigo);
  const sep = c.indexOf(SEPARADOR);
  if (sep < 2 || sep !== c.lastIndexOf(SEPARADOR) || sep > POS_SEPARADOR || sep % 2 === 1) return false;
  const despues = c.length - sep - 1;
  if (despues < 2 || despues > 7) return false;
  for (const ch of c.replace(SEPARADOR, '')) if (!ALFABETO.includes(ch)) return false;
  if (sep === POS_SEPARADOR) {
    if (ALFABETO.indexOf(c[0]) > 8) return false;
    if (ALFABETO.indexOf(c[1]) > 17) return false;
  }
  return true;
}

export function esPlusCodeCompleto(codigo: string): boolean {
  return esPlusCodeValido(codigo) && normalizar(codigo).indexOf(SEPARADOR) === POS_SEPARADOR;
}

export function esPlusCodeCorto(codigo: string): boolean {
  return esPlusCodeValido(codigo) && normalizar(codigo).indexOf(SEPARADOR) < POS_SEPARADOR;
}

/** Decodifica un código COMPLETO al área que cubre; null si no es completo/válido. */
export function decodificarPlusCode(codigo: string): AreaPlusCode | null {
  if (!esPlusCodeCompleto(codigo)) return null;
  const c = normalizar(codigo).replace(SEPARADOR, '');
  const pares = Math.min(c.length, 10);
  let lat = 0;
  let lng = 0;
  let res = 20;
  for (let i = 0; i < pares; i += 2) {
    lat += ALFABETO.indexOf(c[i]) * res;
    lng += ALFABETO.indexOf(c[i + 1]) * res;
    if (i + 2 < pares) res /= 20;
  }
  let alto = res;
  let ancho = res;
  for (let i = 10; i < c.length; i++) {
    alto /= GRID_FILAS;
    ancho /= GRID_COLS;
    const d = ALFABETO.indexOf(c[i]);
    lat += Math.floor(d / GRID_COLS) * alto;
    lng += (d % GRID_COLS) * ancho;
  }
  const r = (x: number) => Math.round(x * 1e10) / 1e10;
  const latMin = lat - 90;
  const lngMin = lng - 180;
  return {
    latMin: r(latMin),
    lngMin: r(lngMin),
    latMax: r(latMin + alto),
    lngMax: r(lngMin + ancho),
    latCentro: r(latMin + alto / 2),
    lngCentro: r(lngMin + ancho / 2),
    longitud: c.length,
  };
}

/** Completa un código corto con el punto de referencia más cercano (estándar OLC «recoverNearest»). */
export function recuperarPlusCode(corto: string, refLat: number, refLng: number): string | null {
  if (!esPlusCodeCorto(corto)) return null;
  const c = normalizar(corto);
  const relleno = POS_SEPARADOR - c.indexOf(SEPARADOR);
  const resolucion = 20 ** (2 - relleno / 2);
  const mitad = resolucion / 2;
  const prefijo = codificarPlusCode(refLat, refLng, 10).slice(0, relleno);
  const area = decodificarPlusCode(prefijo + c);
  if (!area) return null;
  let lat = area.latCentro;
  let lng = area.lngCentro;
  if (refLat + mitad < lat && lat - resolucion >= -90) lat -= resolucion;
  else if (refLat - mitad > lat && lat + resolucion <= 90) lat += resolucion;
  if (refLng + mitad < lng) lng -= resolucion;
  else if (refLng - mitad > lng) lng += resolucion;
  return codificarPlusCode(lat, lng, Math.max(10, c.length - 1 + relleno));
}

/**
 * Busca en un texto libre un Plus Code que ubique algo en Perú: completo («7P7J+2X…») o corto con localidad
 * de Lima («7P7J+2X Lima»). Los cortos sin localidad se ignoran. Devuelve el centro del área o null.
 */
export function plusCodeDesdeTexto(texto: string): { lat: number; lng: number; codigo: string } | null {
  const t = String(texto ?? '');
  const re = /(?<![A-Za-z0-9+])([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,7})(?:[\s,]+([A-Za-zÁÉÍÓÚáéíóúñÑ ]{2,25}))?/gi;
  for (const m of t.matchAll(re)) {
    const codigo = m[1].toUpperCase();
    let completo: string | null = null;
    if (esPlusCodeCompleto(codigo)) completo = codigo;
    else if (esPlusCodeCorto(codigo) && m[2] && LOCALIDADES_LIMA.has(m[2].trim().toLowerCase())) {
      completo = recuperarPlusCode(codigo, LIMA.lat, LIMA.lng);
    }
    const a = completo ? decodificarPlusCode(completo) : null;
    if (a && a.latCentro >= PERU.latMin && a.latCentro <= PERU.latMax && a.lngCentro >= PERU.lngMin && a.lngCentro <= PERU.lngMax) {
      return { lat: a.latCentro, lng: a.lngCentro, codigo: completo! };
    }
  }
  return null;
}
