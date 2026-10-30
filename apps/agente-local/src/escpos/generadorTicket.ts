import type { TicketPagoDatos } from '@caprichos/compartido';
import { aWindows1252 } from '../tspl/codepage1252';

const ESC = '\x1b';
const GS = '\x1d';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Texto a la izquierda y monto a la derecha en `cols` columnas. */
function fila(izq: string, der: string, cols: number): string {
  const max = Math.max(1, cols - der.length - 1);
  return `${izq.length > max ? izq.slice(0, max) : izq.padEnd(max)} ${der}`;
}

const centrar = (t: string, cols: number) =>
  t.length >= cols ? t.slice(0, cols) : ' '.repeat(Math.floor((cols - t.length) / 2)) + t;

/**
 * Ticket/voucher de pago en ESC/POS para papel de 58 mm (32 columnas) u 80 mm (48).
 * Texto en Windows-1252 (ESC t 16) y corte parcial al final.
 */
export function generarTicketEscPos(t: TicketPagoDatos, columnas: number = 48): Buffer {
  const c = columnas;
  const linea = '-'.repeat(c);
  const o: string[] = [];
  o.push(`${ESC}@${ESC}t\x10`); // iniciar + página de códigos 1252
  o.push(`${ESC}a\x01${ESC}E\x01${t.local.nombre}\n${ESC}E\x00`);
  if (t.local.razonSocial) o.push(`${t.local.razonSocial}\n`);
  if (t.local.ruc) o.push(`RUC ${t.local.ruc}\n`);
  if (t.local.direccion) o.push(`${t.local.direccion}\n`);
  o.push(`${ESC}a\x00${linea}\n`);
  o.push(`Pedido ${t.codigo}\n${t.fecha} ${t.hora}\n`);
  if (t.who) o.push(`Cliente: ${t.who}\n`);
  if (t.modalidad) o.push(`Modalidad: ${t.modalidad}\n`);
  o.push(`${linea}\n`);
  for (const l of t.lineas) {
    o.push(`${fila(`${l.cantidad} x ${l.nombre}${l.tamano ? ` (${l.tamano})` : ''}`, soles(l.subtotal), c)}\n`);
  }
  o.push(`${linea}\n${ESC}E\x01${fila('TOTAL', soles(t.total), c)}\n${ESC}E\x00`);
  if (t.pagos.length) {
    o.push('Pago:\n');
    for (const p of t.pagos) {
      o.push(`${fila(`  ${p.medio}`, soles(p.monto), c)}\n`);
      if (p.recibido != null) o.push(`${fila('  Recibido', soles(p.recibido), c)}\n`);
      if (p.vuelto != null) o.push(`${fila('  Vuelto', soles(p.vuelto), c)}\n`);
    }
  } else if (t.plan?.length) {
    o.push('Pago dividido:\n');
    for (const p of t.plan) o.push(`${fila(`  ${p.medio}`, soles(p.monto), c)}\n`);
  }
  if (t.comprobante) o.push(`${linea}\n${t.comprobante.tipo.replace('_', ' ')} ${t.comprobante.numero}\n`);
  o.push(`${linea}\n${centrar('Gracias por tu visita', c)}\n\n\n\n${GS}V\x42\x00`);
  return aWindows1252(o.join(''));
}
