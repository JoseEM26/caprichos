import { limpiarParaTspl } from './codepage1252.js';

export { FUENTES_TSPL, medirAnchoTexto, truncar, ajustarLineas } from '../etiquetas/maquetaEtiquetas.js';
import { medirAnchoTexto } from '../etiquetas/maquetaEtiquetas.js';

/**
 * Calcula la coordenada X para centrar horizontalmente una cadena de texto.
 */
export function calcularCentroX(
  texto: string,
  font: string = '2',
  xm: number = 1,
  anchoTotal: number = 508,
  margenMinimo: number = 26
): number {
  const anchoTexto = medirAnchoTexto(texto, font, xm);
  const centro = Math.floor((anchoTotal - anchoTexto) / 2);
  return Math.max(margenMinimo, centro);
}

/**
 * Emite un comando TEXT formateado para TSPL2.
 */
export function generarComandoTexto(
  x: number,
  y: number,
  font: string,
  xm: number,
  ym: number,
  contenido: string
): string {
  const limpio = limpiarParaTspl(contenido);
  return `TEXT ${Math.round(x)},${Math.round(y)},"${font}",0,${xm},${ym},"${limpio}"\r\n`;
}
