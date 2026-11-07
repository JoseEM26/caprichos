import type { RolImpresora } from '@caprichos/compartido';
import { aWindows1252, limpiarParaTspl } from './tspl/codepage1252';
import { resolverFormato, comandosInicio, MM_A_DOTS } from './tspl/formato';
import type { FormatoEtiqueta } from './tspl/formato';

const ESC = '\x1b';
const GS = '\x1d';

function fechaHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const NOMBRE_ROL: Record<RolImpresora, string> = { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' };

/**
 * Hoja de prueba para saber CUÁL impresora es: nombre, rol, fecha, una línea de caracteres
 * y una raya de borde a borde para ver los márgenes. Ticket ESC/POS (58 mm = 32 columnas, 80 mm = 48).
 */
export function generarPruebaTicket(nombre: string, rol: RolImpresora, columnas = 48, ahora = new Date(), marca?: string): Buffer {
  const raya = '-'.repeat(columnas);
  const texto = [
    `${ESC}@${ESC}t\x10${ESC}a\x01${ESC}E\x01`,
    // «Impresora 3 de 15: nombre»: letra doble alto y ancho para leerla de lejos
    ...(marca ? [`${GS}!\x11${marca.slice(0, Math.floor(columnas / 2))}\n${GS}!\x00`] : []),
    'PRUEBA - no es un pedido\nCAPRICHOS - PRUEBA DE IMPRESION\n',
    `${ESC}E\x00${raya}\n`,
    `${ESC}a\x00`,
    `Impresora: ${nombre}\n`,
    `Rol: ${NOMBRE_ROL[rol]}\n`,
    `Fecha: ${fechaHora(ahora)}\n`,
    `${raya}\n`,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ\n',
    'abcdefghijklmnopqrstuvwxyz\n',
    '0123456789 S/ ,.:;-_()#%\n',
    `${'='.repeat(columnas)}\n`,
    `${ESC}a\x01Si lees esto, esta es la impresora.\n`,
    `\n\n\n${GS}V\x42\x00`,
  ].join('');
  return aWindows1252(texto);
}

/**
 * Etiqueta de prueba (TSPL): mismo contenido, con marco al borde para ver los márgenes. Usa el tamaño
 * del rollo configurado en el programa y el sistema de coordenadas nativo del cabezal (sin giros).
 */
export function generarPruebaEtiqueta(
  nombre: string,
  rol: RolImpresora,
  formato: Partial<FormatoEtiqueta> = {},
  ahora = new Date(),
  marca?: string,
): Buffer {
  const f = resolverFormato(formato);
  const w = Math.round(f.anchoMm * MM_A_DOTS);
  const h = Math.round(f.altoMm * MM_A_DOTS);
  const t = (x: number, y: number, s: string, mult = 1) =>
    `TEXT ${x},${y},"3",0,${mult},${mult},"${limpiarParaTspl(s).replace(/"/g, "'")}"\r\n`;
  const script =
    comandosInicio(f) +
    `BOX 8,8,${w - 8},${h - 8},3\r\n` +
    t(24, 24, marca ? `N° ${marca.replace(/^Impresora\s*/i, '').split(':')[0]}`.slice(0, 13) : 'CAPRICHOS - PRUEBA', marca ? 3 : 2) +
    t(24, 84, `Impresora: ${nombre}`.slice(0, 40)) +
    t(24, 120, `Rol: ${NOMBRE_ROL[rol]}`) +
    t(24, 156, `Fecha: ${fechaHora(ahora)}`) +
    t(24, 200, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') +
    t(24, 236, '0123456789 S/ ,.:;-_()#%') +
    `BAR 16,${Math.min(h - 40, 290)},${w - 32},4\r\n` +
    `PRINT 1,1\r\n`;
  return aWindows1252(script);
}
