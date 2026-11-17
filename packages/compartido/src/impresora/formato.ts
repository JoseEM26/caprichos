import { latin1ABytes, concatBytes } from './bytes.js';
import { ANCHO_CABEZAL_MM } from '../constantes/tamanoPc.js';
import { LOGO_BASE64, LOGO_BASE64_90, LOGO_BASE64_270, LOGO_LADO } from '../etiquetas/logoBitmap.js';

/**
 * Formato fisico del sticker. Todo se ajusta en la configuracion del agente sin recompilar
 * (ETIQUETA_ORIENTACION, ETIQUETA_ANCHO_MM, ETIQUETA_ALTO_MM, ETIQUETA_DIRECCION, ETIQUETA_GAP_MM
 * o la clave "etiqueta" de config.json).
 *
 * Medidas siempre como las ve el rollo en la 4B-2054TH (cabezal de 4"): el ANCHO va a lo ancho del
 * cabezal y el ALTO es el sentido de avance. El rollo de 2.5" x 4" se carga apaisado (101.6 ancho x 63.5 alto).
 * Orientaciones: 'vertical-girado' (defecto: rollo apaisado, contenido en retrato girado 90 grados para que
 * el sticker se pegue "parado"), 'horizontal' (contenido apaisado) y 'vertical' (rollo cargado de canto).
 * ETIQUETA_GIRO=90|270 elige el sentido del giro; si la cabecera sale abajo al pegarlo, probar el otro.
 */
export interface FormatoEtiqueta {
  orientacion: 'horizontal' | 'vertical' | 'vertical-girado';
  /** Solo 'vertical-girado': 90 = cabecera hacia el borde derecho del rollo, 270 = hacia el izquierdo. */
  giro: 90 | 270;
  anchoMm: number;
  altoMm: number;
  /** DIRECTION de TSPL: 1 = normal (sale derecho), 0 = girado 180 grados. */
  direccion: 0 | 1;
  gapMm: number;
}

const LARGO = 101.6;
const CORTO = 63.5;

export function resolverFormato(p: Partial<FormatoEtiqueta> = {}): FormatoEtiqueta {
  const orientacion = p.orientacion === 'vertical' || p.orientacion === 'horizontal' ? p.orientacion : 'vertical-girado';
  const [aw, al] = orientacion === 'vertical' ? [CORTO, LARGO] : [LARGO, CORTO];
  const pos = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 10 ? v : d);
  return {
    orientacion,
    giro: p.giro === 270 ? 270 : 90,
    anchoMm: pos(p.anchoMm, aw),
    altoMm: pos(p.altoMm, al),
    direccion: p.direccion === 0 ? 0 : 1,
    gapMm: typeof p.gapMm === 'number' && p.gapMm >= 0 ? p.gapMm : 3,
  };
}

/** Lee ETIQUETA_* del entorno (o del archivo) y devuelve el formato resuelto. */
export function formatoDesdeConfig(
  env: Record<string, string | undefined>,
  archivo: Partial<FormatoEtiqueta> = {}
): FormatoEtiqueta {
  const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v));
  const o = (env.ETIQUETA_ORIENTACION || archivo.orientacion || '').toString().toLowerCase();
  return resolverFormato({
    orientacion: o === 'vertical' || o === 'horizontal' ? o : 'vertical-girado',
    giro: (num(env.ETIQUETA_GIRO) ?? archivo.giro) === 270 ? 270 : 90,
    anchoMm: num(env.ETIQUETA_ANCHO_MM) ?? archivo.anchoMm,
    altoMm: num(env.ETIQUETA_ALTO_MM) ?? archivo.altoMm,
    direccion: (num(env.ETIQUETA_DIRECCION) ?? archivo.direccion) === 0 ? 0 : 1,
    gapMm: num(env.ETIQUETA_GAP_MM) ?? archivo.gapMm,
  });
}

export const MM_A_DOTS = 8; // 203 dpi

export function comandosInicio(f: FormatoEtiqueta): string {
  // Un solo punto de control para todo lo que imprime la etiquetera (stickers, prueba de tamaño, hoja de prueba).
  // Lo que pase del cabezal sale cortado: mejor rechazarlo con un mensaje claro que mandar el comando.
  if (f.anchoMm > ANCHO_CABEZAL_MM + 1e-9) {
    throw new Error(
      `El sticker mide ${f.anchoMm} mm de ancho y la etiquetera imprime como máximo ${ANCHO_CABEZAL_MM} mm (cabezal de 4"). ` +
        'Usa un ancho menor o carga un rollo más angosto; el alto sí puede ser mayor.',
    );
  }
  return (
    `SIZE ${f.anchoMm} mm,${f.altoMm} mm\r\n` +
    `GAP ${f.gapMm} mm,0 mm\r\n` +
    `DIRECTION ${f.direccion}\r\n` +
    'CLS\r\n' +
    'CODEPAGE 1252\r\n'
  );
}

/**
 * Logo de Caprichos como BITMAP TSPL en modo OVERWRITE (0). Los datos binarios viajan como
 * caracteres latin1 dentro del texto; `aBytesTspl` los vuelve a bytes sin pasar por Windows-1252.
 */
export function comandoLogo(x: number, y: number, giro: 0 | 90 | 270 = 0): string {
  const b64 = giro === 90 ? LOGO_BASE64_90 : giro === 270 ? LOGO_BASE64_270 : LOGO_BASE64;
  const datos = atob(b64); // un carácter por byte (latin1)
  return `BITMAP ${x},${y},${LOGO_LADO / 8},${LOGO_LADO},0,${datos}\r\n`;
}

const RE_BITMAP = /BITMAP (\d+),(\d+),(\d+),(\d+),0,/g;

/** Texto TSPL -> bytes: Windows-1252 para el texto y bytes crudos para los BITMAP. */
export function aBytesTspl(script: string, aTexto: (s: string) => Uint8Array): Uint8Array {
  const partes: Uint8Array[] = [];
  let desde = 0;
  let m: RegExpExecArray | null;
  RE_BITMAP.lastIndex = 0;
  while ((m = RE_BITMAP.exec(script))) {
    const finCabecera = m.index + m[0].length;
    const largo = Number(m[3]) * Number(m[4]);
    partes.push(aTexto(script.slice(desde, finCabecera)));
    partes.push(latin1ABytes(script.slice(finCabecera, finCabecera + largo)));
    desde = finCabecera + largo;
    RE_BITMAP.lastIndex = desde;
  }
  partes.push(aTexto(script.slice(desde)));
  return concatBytes(partes);
}
