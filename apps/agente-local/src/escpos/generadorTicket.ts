import { lineasTicketPago, lineasTicketComandaSalon } from '@caprichos/compartido';
import type { TicketPagoDatos, TicketComandaSalonDatos } from '@caprichos/compartido';
import { aWindows1252 } from '../tspl/codepage1252';

const ESC = '\x1b';
const GS = '\x1d';

/**
 * Módulo del QR en puntos: 58 mm (32 columnas) y 80 mm (48). Valores de partida, a calibrar en la impresora real.
 * ponytail: no hay prueba de impresión física; si sale grande o no escanea, ajustar aquí.
 */
export const MODULO_QR_58MM = 4;
export const MODULO_QR_80MM = 6;

/** Comando GS ( k (Epson/ESC-POS QR): pL pH cn fn parámetros; pL+pH*256 = nº de bytes tras pH. */
function comandoQr(fn: number, parametros: number[]): Buffer {
  const largo = parametros.length + 2; // cn y fn cuentan en pL/pH
  return Buffer.from([0x1d, 0x28, 0x6b, largo & 0xff, largo >> 8, 0x31, fn, ...parametros]);
}

/**
 * Bloque del QR (cadena de SUNAT): modelo 2, módulo, corrección M, guardar datos e imprimir.
 * Fallback: si la impresora no entiende GS ( k, el hash en texto ya sale en el ticket.
 */
export function bloqueQrEscPos(cadena: string, columnas: number): Buffer {
  const modulo = columnas <= 32 ? MODULO_QR_58MM : MODULO_QR_80MM;
  return Buffer.concat([
    comandoQr(0x41, [0x32, 0x00]), // modelo 2
    comandoQr(0x43, [modulo]), // tamaño del módulo
    comandoQr(0x45, [0x31]), // corrección de errores M
    comandoQr(0x50, [0x30, ...Buffer.from(cadena, 'latin1')]), // almacenar datos
    comandoQr(0x51, [0x30]), // imprimir
  ]);
}

/**
 * Ticket/voucher de pago en ESC/POS para papel de 58 mm (32 columnas) u 80 mm (48).
 * Texto en Windows-1252 (ESC t 16) y corte parcial al final. Con cadena QR, el bloque se imprime centrado.
 */
export function generarTicketEscPos(t: TicketPagoDatos, columnas: number = 48): Buffer {
  const partes: Buffer[] = [aWindows1252(`${ESC}@${ESC}t\x10`)]; // iniciar + página de códigos 1252
  let centrado = false;
  let texto: string[] = [];
  if (t.simulacion) texto.push(`${ESC}a\x01${ESC}E\x01*** PRUEBA ***\n${ESC}E\x00${ESC}a\x00`);
  const volcar = () => {
    if (texto.length) partes.push(aWindows1252(texto.join('')));
    texto = [];
  };
  for (const l of lineasTicketPago(t, columnas)) {
    if (!!l.centrado !== centrado) {
      centrado = !!l.centrado;
      texto.push(`${ESC}a${centrado ? '\x01' : '\x00'}`);
    }
    if (l.qr) {
      volcar();
      partes.push(bloqueQrEscPos(l.qr, columnas), aWindows1252('\n'));
      continue;
    }
    texto.push(l.negrita ? `${ESC}E\x01${l.texto}\n${ESC}E\x00` : `${l.texto}\n`);
  }
  texto.push(`\n\n\n${GS}V\x42\x00`);
  volcar();
  return Buffer.concat(partes);
}

/**
 * Comanda de salón en ESC/POS para la ticketera de Caja: texto plano en negrita donde toca, sin QR.
 * Mismo ancho de papel y corte que el ticket de pago.
 */
export function generarComandaSalonEscPos(c: TicketComandaSalonDatos, columnas: number = 48): Buffer {
  const partes: string[] = [`${ESC}@${ESC}t\x10`];
  if (c.simulacion) partes.push(`${ESC}a\x01${ESC}E\x01*** PRUEBA ***\n${ESC}E\x00${ESC}a\x00`);
  for (const l of lineasTicketComandaSalon(c, columnas)) {
    partes.push(l.negrita ? `${ESC}E\x01${l.texto}\n${ESC}E\x00` : `${l.texto}\n`);
  }
  partes.push(`\n\n\n${GS}V\x42\x00`);
  return aWindows1252(partes.join(''));
}
