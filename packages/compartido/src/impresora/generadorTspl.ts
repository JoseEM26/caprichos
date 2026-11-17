import { maquetarEtiqueta } from '../etiquetas/maquetaStickers.js';
import { tamanoPcValido } from '../constantes/tamanoPc.js';
import { TAMANO_BEBIDA_DEFECTO, TAMANO_GENERAL_DEFECTO } from '../constantes/tamanosEtiqueta.js';
import type {
  TipoEtiqueta,
  PayloadEtiqueta,
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from '../tipos/etiquetas.js';
import { aWindows1252 } from './codepage1252.js';
import { resolverFormato, comandosInicio, aBytesTspl } from './formato.js';
import type { FormatoEtiqueta } from './formato.js';
import { generarAreaH } from './horizontal.js';
import { generarAreaG, generarAreaV, primitivasATspl } from './girado.js';

export interface OpcionesGeneradorTspl {
  copias?: number;
  /** Tamaño del rollo y orientación. Sin él: apaisado 101.6 x 63.5 mm. */
  formato?: Partial<FormatoEtiqueta>;
}

/**
 * Stickers de BEBIDA y GENERAL: tamano propio en mm (el que manda la API en `tamanoMm`, o el de fabrica),
 * sin girar y sin depender de la orientacion del rollo del agente; la maqueta sale de @caprichos/compartido.
 */
function generarSticker(
  tipo: 'ETIQUETA_GENERAL' | 'ETIQUETA_BEBIDA',
  datos: EtiquetaGeneralDatos | EtiquetaBebidaDatos,
  opciones?: OpcionesGeneradorTspl,
): string {
  const defecto = tipo === 'ETIQUETA_GENERAL' ? TAMANO_GENERAL_DEFECTO : TAMANO_BEBIDA_DEFECTO;
  // El tamaño llega por PC (con décimas, como 101,6 x 63,5, y margen); si no es válido, el de fábrica
  const propio = tamanoPcValido(datos.tamanoMm);
  const tam = propio ?? defecto;
  // Si el servidor ya mando la maqueta (vaso), solo se dibuja: un diseno nuevo no exige otro .exe. Sin ella, se maqueta aqui.
  const enviada = tipo === 'ETIQUETA_BEBIDA' ? (datos as EtiquetaBebidaDatos).maqueta : undefined;
  const valida = !!enviada && enviada.W > 0 && enviada.H > 0 && Array.isArray(enviada.primitivas);
  const m = valida ? enviada! : maquetarEtiqueta(tipo, datos, { anchoMm: tam.anchoMm, altoMm: tam.altoMm, margenMm: propio?.margenMm });
  const f = resolverFormato({ ...opciones?.formato, orientacion: 'horizontal', ...(Math.round(tam.anchoMm * 8) === m.W && Math.round(tam.altoMm * 8) === m.H ? { anchoMm: tam.anchoMm, altoMm: tam.altoMm } : { anchoMm: m.W / 8, altoMm: m.H / 8 }) });
  return comandosInicio(f) + primitivasATspl(m.primitivas, m.W, m.H, 0) + `PRINT 1,${opciones?.copias ?? 1}\r\n`;
}

export function generarEtiquetaGeneral(datos: EtiquetaGeneralDatos, opciones?: OpcionesGeneradorTspl): string {
  return generarSticker('ETIQUETA_GENERAL', datos, opciones);
}

/**
 * 2. Generador de Etiqueta por Área (Cocina, Barra, etc.)
 */
export function generarEtiquetaArea(
  datos: EtiquetaAreaDatos,
  opciones?: OpcionesGeneradorTspl
): string {
  const copias = opciones?.copias ?? 1;
  const f = resolverFormato(opciones?.formato);
  if (f.orientacion === 'horizontal') return generarAreaH(datos, copias, f);
  if (f.orientacion === 'vertical-girado') return generarAreaG(datos, copias, f);
  return generarAreaV(datos, copias, f);
}

export function generarEtiquetaBebida(datos: EtiquetaBebidaDatos, opciones?: OpcionesGeneradorTspl): string {
  return generarSticker('ETIQUETA_BEBIDA', datos, opciones);
}

/**
 * Despachador unificado según el tipo de trabajo de impresión.
 */
export function generarTsplTrabajo(
  tipo: TipoEtiqueta,
  payload: PayloadEtiqueta,
  copia: boolean = false,
  formato?: Partial<FormatoEtiqueta>
): string {
  // Una reimpresión es UN papel nuevo: antes `copia` mandaba `PRINT 1,2` y la etiquetera sacaba dos stickers por reimpresión
  // (los vasos salían dobles). `copia` solo marca el trabajo como reimpresión en el servidor.
  void copia;
  const opciones: OpcionesGeneradorTspl = { copias: 1, formato };

  switch (tipo) {
    case 'ETIQUETA_GENERAL':
      return generarEtiquetaGeneral(payload as EtiquetaGeneralDatos, opciones);
    case 'ETIQUETA_AREA':
      return generarEtiquetaArea(payload as EtiquetaAreaDatos, opciones);
    case 'ETIQUETA_BEBIDA':
      return generarEtiquetaBebida(payload as EtiquetaBebidaDatos, opciones);
    default:
      throw new Error(`Tipo de etiqueta no soportado: ${tipo}`);
  }
}

/**
 * Genera el flujo completo de bytes binarios en Windows-1252 listos para escribir a /dev/usb/lp0.
 */
export function generarBytesTrabajo(
  tipo: TipoEtiqueta,
  payload: PayloadEtiqueta,
  copia: boolean = false,
  formato?: Partial<FormatoEtiqueta>
): Uint8Array {
  return generarBytesDeScript(generarTsplTrabajo(tipo, payload, copia, formato));
}

/** Texto TSPL (con el BITMAP del logo en latin1) a los bytes que recibe la impresora. */
export function generarBytesDeScript(script: string): Uint8Array {
  return aBytesTspl(script, aWindows1252);
}
