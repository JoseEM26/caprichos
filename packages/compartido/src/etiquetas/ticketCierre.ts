import type { LineaTicket } from './ticketPago.js';

/** Denominaciones del conteo de efectivo del cierre (billetes y monedas), de mayor a menor. */
export const DENOMINACIONES_CIERRE = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

export interface RenglonDesglose {
  valor: number;
  cantidad: number;
  subtotal: number;
}

const clavesDe = (v: number) => (v < 1 ? [String(v), v.toFixed(2)] : [String(v)]);

/**
 * Efectivo contado por denominación. Devuelve null si el cierre no guardó ese desglose (conteo vacío o
 * solo un total directo): nunca se inventan billetes.
 */
export function desglosarConteo(conteo: Record<string, unknown> | null | undefined): RenglonDesglose[] | null {
  if (!conteo || typeof conteo !== 'object') return null;
  const filas = DENOMINACIONES_CIERRE.map((valor) => {
    const k = clavesDe(valor).find((c) => (conteo as any)[c] !== undefined);
    const cantidad = k ? Number((conteo as any)[k]) : 0;
    return { valor, cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0, hay: k !== undefined };
  });
  if (!filas.some((f) => f.hay)) return null;
  return filas
    .filter((f) => f.cantidad > 0)
    .map((f) => ({ valor: f.valor, cantidad: f.cantidad, subtotal: Math.round(f.cantidad * f.valor * 100) / 100 }));
}

export interface TicketCierreDatos {
  tipo?: 'TICKET_CIERRE';
  local: { nombre: string };
  codigo: string;
  fecha: string;
  cerradoEn: string | null;
  abiertoPor: string | null;
  cerradoPor: string | null;
  apertura: number;
  resultado: 'CUADRA' | 'NO_CUADRA';
  /** Suma de las diferencias de todos los medios (visto − sistema). */
  diferencia: number;
  aprobadoPor: string | null;
  nota: string | null;
  efectivo: { desglose: RenglonDesglose[] | null; contado: number; esperado: number; diferencia: number };
  /** Intentos de conteo guardados (arqueos): cada uno con su total de efectivo y, si lo hay, su desglose. */
  intentos: { n: number; hora: string; por: string | null; resultado: string; total: number; desglose: RenglonDesglose[] | null }[];
  medios: { medio: string; sistema: number; visto: number; diferencia: number }[];
  movimientos: { tipo: string; monto: number; motivo: string; anulado: boolean }[];
  correcciones: { medio: string; anterior: number; nuevo: number; motivo: string; por: string | null; hora: string }[];
  liquidaciones: { repartidor: string; esperado: number; entregado: number; hora: string }[];
  anulaciones: { pedido: string; total: number; hora: string; por: string | null }[];
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const conSigno = (n: number) => `${n > 0.004 ? '+' : n < -0.004 ? '-' : ''}S/ ${Math.abs(n).toFixed(2)}`;

function fila(izq: string, der: string, cols: number): string {
  const max = Math.max(1, cols - der.length - 1);
  return `${izq.length > max ? izq.slice(0, max) : izq.padEnd(max)} ${der}`;
}

function envolver(texto: string, cols: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    for (let trozo = palabra; trozo.length > 0; ) {
      if (actual ? actual.length + 1 + trozo.length <= cols : trozo.length <= cols) {
        actual = actual ? `${actual} ${trozo}` : trozo;
        break;
      }
      if (actual) {
        out.push(actual);
        actual = '';
      } else {
        out.push(trozo.slice(0, cols));
        trozo = trozo.slice(cols);
      }
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Renglones del ticket de cierre de caja (80 mm = 48 columnas, 58 mm = 32). Los usan el agente (ESC/POS) y la vista previa del panel. */
export function lineasTicketCierre(t: TicketCierreDatos, columnas: number = 48): LineaTicket[] {
  const c = columnas;
  const raya = '-'.repeat(c);
  const o: LineaTicket[] = [];
  const p = (texto: string, extra: Partial<LineaTicket> = {}) => o.push({ texto, ...extra });
  const bloque = (texto: string) => envolver(texto, c).forEach((r) => p(r));

  p(t.local.nombre, { centrado: true, negrita: true });
  p(`CIERRE DE CAJA ${t.codigo}`, { centrado: true, negrita: true });
  p(raya);
  p(`Fecha: ${t.fecha}`);
  if (t.abiertoPor) p(`Abrio: ${t.abiertoPor}`);
  p(`Cerro: ${t.cerradoPor ?? 'sin dato'}${t.cerradoEn ? ` ${t.cerradoEn}` : ''}`);
  p(fila('Apertura', soles(t.apertura), c));
  p(raya);
  p(`RESULTADO: ${t.resultado === 'CUADRA' ? 'CUADRA' : 'NO CUADRA'}`, { negrita: true });
  if (t.resultado === 'NO_CUADRA' || Math.abs(t.diferencia) >= 0.005) p(fila('Diferencia total', conSigno(t.diferencia), c), { negrita: true });
  if (t.aprobadoPor) p(`Aprobado por: ${t.aprobadoPor}`);
  if (t.nota) bloque(`Nota: ${t.nota}`);
  p(raya);
  p('EFECTIVO CONTADO', { negrita: true });
  if (t.efectivo.desglose) {
    for (const d of t.efectivo.desglose) p(fila(`${d.cantidad} x ${soles(d.valor)}`, soles(d.subtotal), c));
  } else {
    p('Sin detalle por billetes');
  }
  p(fila('Contado', soles(t.efectivo.contado), c));
  p(fila('Esperado', soles(t.efectivo.esperado), c));
  p(fila('Diferencia', conSigno(t.efectivo.diferencia), c), { negrita: true });
  if (t.intentos.length > 1) {
    p(raya);
    p('INTENTOS DE CONTEO', { negrita: true });
    for (const i of t.intentos) p(fila(`#${i.n} ${i.hora}${i.por ? ` ${i.por}` : ''}`, soles(i.total), c));
  }
  p(raya);
  p('MEDIOS DE PAGO (sistema/visto/dif)', { negrita: true });
  for (const m of t.medios) {
    p(m.medio);
    p(fila(`  ${soles(m.sistema)} / ${soles(m.visto)}`, conSigno(m.diferencia), c));
  }
  if (t.movimientos.length) {
    p(raya);
    p('MOVIMIENTOS DE CAJA', { negrita: true });
    for (const m of t.movimientos) {
      p(fila(`${m.tipo}${m.anulado ? ' (ANULADO)' : ''}`, soles(m.monto), c));
      bloque(`  ${m.motivo}`);
    }
  }
  if (t.correcciones.length) {
    p(raya);
    p('CORRECCIONES DE MEDIOS', { negrita: true });
    for (const k of t.correcciones) {
      p(fila(`${k.medio} ${k.hora}`, `${soles(k.anterior)}>${soles(k.nuevo)}`, c));
      bloque(`  ${k.motivo}${k.por ? ` (${k.por})` : ''}`);
    }
  }
  if (t.liquidaciones.length) {
    p(raya);
    p('LIQUIDACIONES DE REPARTIDORES', { negrita: true });
    for (const l of t.liquidaciones) {
      p(fila(`${l.repartidor} ${l.hora}`, soles(l.entregado), c));
      p(`  Esperado ${soles(l.esperado)}`);
    }
  }
  if (t.anulaciones.length) {
    p(raya);
    p('COBROS ANULADOS', { negrita: true });
    for (const a of t.anulaciones) p(fila(`${a.pedido} ${a.hora}${a.por ? ` ${a.por}` : ''}`, soles(a.total), c));
  }
  p(raya);
  return o;
}
