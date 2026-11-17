import { LIMITE_COMANDOS_BYTES, comandosDeTrabajo } from '@caprichos/compartido';
import type { CapacidadesAgente, ComandosTrabajo } from '@caprichos/compartido';

/**
 * «Diseño desde el servidor»: el servidor arma los bytes de la impresora (TSPL / ESC-POS) con el mismo código que usa
 * el programa de impresión como respaldo, y el programa solo los envía. Solo se manda `comandos` si la PC lo tiene
 * encendido (apagado por defecto) Y el programa declaró que sabe usarlos; en cualquier otro caso el trabajo sale como siempre.
 */

/** Fallos seguidos (el programa tuvo que imprimir con su diseño de respaldo) tras los cuales la PC vuelve sola al diseño del programa. */
export const FALLOS_PARA_APAGAR = 2;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Lo que declara el programa, depurado: solo campos conocidos y del tipo esperado (el resto se ignora). */
export function sanearCapacidades(raw: unknown): CapacidadesAgente | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (r.comandosServidor !== true) return null;
  const e = r.etiqueta && typeof r.etiqueta === 'object' ? (r.etiqueta as Record<string, unknown>) : {};
  const etiqueta: Record<string, unknown> = {};
  if (e.orientacion === 'horizontal' || e.orientacion === 'vertical' || e.orientacion === 'vertical-girado') etiqueta.orientacion = e.orientacion;
  if (e.giro === 90 || e.giro === 270) etiqueta.giro = e.giro;
  if (e.direccion === 0 || e.direccion === 1) etiqueta.direccion = e.direccion;
  for (const k of ['anchoMm', 'altoMm', 'gapMm'] as const) {
    const v = num(e[k]);
    if (v !== undefined) etiqueta[k] = v;
  }
  return { comandosServidor: true, ...(num(r.ticketColumnas) !== undefined ? { ticketColumnas: num(r.ticketColumnas) } : {}), etiqueta };
}

/** «16/11/2026 10:30» en hora de Lima (el servidor puede correr en UTC): la fecha de las hojas de prueba. */
export function fechaTextoLima(d: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Los comandos de un trabajo, o undefined si no se pueden armar o pesan demasiado: nunca se frena la entrega por esto. */
export function comandosSeguros(tipo: string, payload: unknown, copia: boolean, cap: CapacidadesAgente): ComandosTrabajo | undefined {
  try {
    const c = comandosDeTrabajo(tipo, payload, copia, cap, { fechaTexto: fechaTextoLima() });
    return c.base64.length <= Math.ceil((LIMITE_COMANDOS_BYTES * 4) / 3) ? c : undefined;
  } catch {
    return undefined;
  }
}
