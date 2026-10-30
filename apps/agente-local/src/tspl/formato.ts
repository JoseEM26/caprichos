import { LOGO_BASE64, LOGO_LADO } from './logoBitmap';

/**
 * Formato fisico del sticker. Todo se ajusta en la configuracion del agente sin recompilar
 * (ETIQUETA_ORIENTACION, ETIQUETA_ANCHO_MM, ETIQUETA_ALTO_MM, ETIQUETA_DIRECCION, ETIQUETA_GAP_MM
 * o la clave "etiqueta" de config.json).
 *
 * Medidas siempre como las ve el rollo en la 4B-2054TH (cabezal de 4"): el ANCHO va a lo ancho del
 * cabezal y el ALTO es el sentido de avance. El rollo de 2.5" x 4" se carga apaisado (101.6 ancho x 63.5 alto),
 * por eso el defecto es horizontal: el contenido se lee de lado a lado sin girar el sticker.
 */
export interface FormatoEtiqueta {
  orientacion: 'horizontal' | 'vertical';
  anchoMm: number;
  altoMm: number;
  /** DIRECTION de TSPL: 1 = normal (sale derecho), 0 = girado 180 grados. */
  direccion: 0 | 1;
  gapMm: number;
}

const LARGO = 101.6;
const CORTO = 63.5;

export function resolverFormato(p: Partial<FormatoEtiqueta> = {}): FormatoEtiqueta {
  const orientacion = p.orientacion === 'vertical' ? 'vertical' : 'horizontal';
  const [aw, al] = orientacion === 'horizontal' ? [LARGO, CORTO] : [CORTO, LARGO];
  const pos = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 10 ? v : d);
  return {
    orientacion,
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
    orientacion: o === 'vertical' ? 'vertical' : 'horizontal',
    anchoMm: num(env.ETIQUETA_ANCHO_MM) ?? archivo.anchoMm,
    altoMm: num(env.ETIQUETA_ALTO_MM) ?? archivo.altoMm,
    direccion: (num(env.ETIQUETA_DIRECCION) ?? archivo.direccion) === 0 ? 0 : 1,
    gapMm: num(env.ETIQUETA_GAP_MM) ?? archivo.gapMm,
  });
}

export const MM_A_DOTS = 8; // 203 dpi

export function comandosInicio(f: FormatoEtiqueta): string {
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
export function comandoLogo(x: number, y: number): string {
  const datos = Buffer.from(LOGO_BASE64, 'base64').toString('latin1');
  return `BITMAP ${x},${y},${LOGO_LADO / 8},${LOGO_LADO},0,${datos}\r\n`;
}

const RE_BITMAP = /BITMAP (\d+),(\d+),(\d+),(\d+),0,/g;

/** Texto TSPL -> bytes: Windows-1252 para el texto y bytes crudos para los BITMAP. */
export function aBytesTspl(script: string, aTexto: (s: string) => Buffer): Buffer {
  const partes: Buffer[] = [];
  let desde = 0;
  let m: RegExpExecArray | null;
  RE_BITMAP.lastIndex = 0;
  while ((m = RE_BITMAP.exec(script))) {
    const finCabecera = m.index + m[0].length;
    const largo = Number(m[3]) * Number(m[4]);
    partes.push(aTexto(script.slice(desde, finCabecera)));
    partes.push(Buffer.from(script.slice(finCabecera, finCabecera + largo), 'latin1'));
    desde = finCabecera + largo;
    RE_BITMAP.lastIndex = desde;
  }
  partes.push(aTexto(script.slice(desde)));
  return Buffer.concat(partes);
}
