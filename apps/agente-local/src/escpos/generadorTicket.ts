import { lineasTicketPago } from '@caprichos/compartido';
import type { TicketPagoDatos } from '@caprichos/compartido';
import { aWindows1252 } from '../tspl/codepage1252';

const ESC = '\x1b';
const GS = '\x1d';

/**
 * Ticket/voucher de pago en ESC/POS para papel de 58 mm (32 columnas) u 80 mm (48).
 * Texto en Windows-1252 (ESC t 16) y corte parcial al final.
 */
export function generarTicketEscPos(t: TicketPagoDatos, columnas: number = 48): Buffer {
  const o: string[] = [`${ESC}@${ESC}t\x10`]; // iniciar + página de códigos 1252
  let centrado = false;
  for (const l of lineasTicketPago(t, columnas)) {
    if (!!l.centrado !== centrado) {
      centrado = !!l.centrado;
      o.push(`${ESC}a${centrado ? '\x01' : '\x00'}`);
    }
    o.push(l.negrita ? `${ESC}E\x01${l.texto}\n${ESC}E\x00` : `${l.texto}\n`);
  }
  o.push(`\n\n\n${GS}V\x42\x00`);
  return aWindows1252(o.join(''));
}
