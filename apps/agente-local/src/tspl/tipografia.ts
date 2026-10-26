import { limpiarParaTspl } from './codepage1252';

export const FUENTES_TSPL: Record<string, { ancho: number; alto: number }> = {
  '1': { ancho: 8, alto: 12 },
  '2': { ancho: 12, alto: 20 },
  '3': { ancho: 16, alto: 24 },
  '4': { ancho: 24, alto: 32 },
  '5': { ancho: 32, alto: 48 },
};

/**
 * Mide el ancho estimado en dots de una cadena según la fuente y multiplicador X.
 */
export function medirAnchoTexto(texto: string, font: string = '2', xm: number = 1): number {
  const metricas = FUENTES_TSPL[font] || FUENTES_TSPL['2'];
  return texto.length * metricas.ancho * xm;
}

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
 * Trunca un texto a un máximo de caracteres añadiendo '...' al final si excede.
 */
export function truncar(texto: string, maxCaracteres: number): string {
  if (!texto) return '';
  if (texto.length <= maxCaracteres) return texto;
  if (maxCaracteres <= 3) return texto.slice(0, maxCaracteres);
  return texto.slice(0, maxCaracteres - 3) + '...';
}

/**
 * Divide un texto en líneas respetando palabras, con corte de desborde y máximo de líneas opcional.
 */
export function ajustarLineas(
  texto: string,
  maxCharsPorLinea: number,
  maxLineas?: number
): string[] {
  if (!texto) return [];
  const palabras = texto.trim().split(/\s+/);
  const lineas: string[] = [];
  let lineaActual = '';

  for (const palabra of palabras) {
    if (!lineaActual) {
      if (palabra.length > maxCharsPorLinea) {
        // La palabra sola excede la línea
        lineas.push(palabra.slice(0, maxCharsPorLinea));
        lineaActual = palabra.slice(maxCharsPorLinea);
      } else {
        lineaActual = palabra;
      }
    } else if (lineaActual.length + 1 + palabra.length <= maxCharsPorLinea) {
      lineaActual += ' ' + palabra;
    } else {
      lineas.push(lineaActual);
      if (palabra.length > maxCharsPorLinea) {
        lineas.push(palabra.slice(0, maxCharsPorLinea));
        lineaActual = palabra.slice(maxCharsPorLinea);
      } else {
        lineaActual = palabra;
      }
    }
  }

  if (lineaActual) {
    lineas.push(lineaActual);
  }

  if (maxLineas !== undefined && lineas.length > maxLineas) {
    const recortadas = lineas.slice(0, maxLineas);
    const ultima = recortadas[maxLineas - 1];
    // Al descartar líneas posteriores, aseguramos que la última línea termine con '...'
    if (ultima.length + 3 <= maxCharsPorLinea) {
      recortadas[maxLineas - 1] = ultima + '...';
    } else {
      const espacioDisponible = Math.max(3, maxCharsPorLinea - 3);
      recortadas[maxLineas - 1] = ultima.slice(0, espacioDisponible) + '...';
    }
    return recortadas;
  }

  return lineas;
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
