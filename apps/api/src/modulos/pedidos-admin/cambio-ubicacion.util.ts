import type { PrismaClient } from '@prisma/client';
import { aCentimos, enPesos } from '../caja/caja.calculo';

/** Un pedido en estos estados ya no admite cambio de punto. */
export const ESTADOS_CERRADOS_UBICACION = ['ENTREGADO', 'ANULADO'];

/** Ajuste de cobro que deja un cambio de envío cuando el pedido ya estaba pagado. */
export type TipoAjusteCobro = 'SALDO' | 'DEVOLUCION';

/**
 * Compara lo que el cliente ya dejó en caja con el total nuevo. Si el pedido no está pagado no hay ajuste
 * (el total simplemente cambia y se cobra así). Todo en céntimos para no sumar floats.
 */
export function calcularAjusteCobro(
  pagado: boolean,
  pagadoActualC: number,
  totalNuevoC: number,
): { tipo: TipoAjusteCobro; montoC: number } | null {
  if (!pagado) return null;
  const diff = totalNuevoC - pagadoActualC;
  if (diff > 0) return { tipo: 'SALDO', montoC: diff };
  if (diff < 0) return { tipo: 'DEVOLUCION', montoC: -diff };
  return null;
}

/** Suma firmada en soles para mostrar: «+S/ 6.00» o «-S/ 2.50» (0 = sin diferencia). */
export function textoDiferencia(difPesos: number): string {
  const c = aCentimos(difPesos);
  if (c === 0) return 'sin diferencia';
  return c > 0 ? `+S/ ${enPesos(c).toFixed(2)}` : `-S/ ${enPesos(-c).toFixed(2)}`;
}

/** Texto libre del aviso al cliente cuando cambia el costo de envío (sin plantilla). */
export function textoAvisoEnvio(p: { codigo: string; envioAnterior: number; envioNuevo: number; diferencia: number }): string {
  return (
    `Actualizamos la dirección de entrega de tu pedido ${p.codigo}. ` +
    `Envío: S/ ${p.envioAnterior.toFixed(2)} → S/ ${p.envioNuevo.toFixed(2)}. ` +
    `Diferencia: ${textoDiferencia(p.diferencia)}.`
  );
}

/**
 * Efectivo de cierre de los ajustes ya resueltos (COBRADO/DEVUELTO) del día de la caja, por medio digital.
 * Los de efectivo entran como movimiento de caja (ingreso o egreso), así que aquí no se cuentan.
 * `cobrados` suma los saldos cobrados; `devueltos` las devoluciones hechas. Ambos en soles, positivos.
 */
export function sumarAjustesCambioDigitales(
  filas: Array<{ ajuste_tipo: string | null; ajuste_estado: string | null; ajuste_medio: string | null; ajuste_monto: unknown; ajuste_en: Date | null }>,
  inicio: Date,
  fin: Date,
): { cobrados: Record<'yape' | 'plin' | 'transferencia' | 'tarjeta', number>; devueltos: Record<'yape' | 'plin' | 'transferencia' | 'tarjeta', number> } {
  const claves = { YAPE: 'yape', PLIN: 'plin', TRANSFERENCIA: 'transferencia', TARJETA: 'tarjeta' } as const;
  const cobrados = { yape: 0, plin: 0, transferencia: 0, tarjeta: 0 };
  const devueltos = { yape: 0, plin: 0, transferencia: 0, tarjeta: 0 };
  for (const f of filas) {
    const clave = claves[(f.ajuste_medio ?? '').trim().toUpperCase() as keyof typeof claves];
    if (!clave || !f.ajuste_en || f.ajuste_en < inicio || f.ajuste_en >= fin) continue;
    if (f.ajuste_estado === 'COBRADO' && f.ajuste_tipo === 'SALDO') cobrados[clave] += aCentimos(f.ajuste_monto);
    if (f.ajuste_estado === 'DEVUELTO' && f.ajuste_tipo === 'DEVOLUCION') devueltos[clave] += aCentimos(f.ajuste_monto);
  }
  const aPesos = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, enPesos(v)])) as typeof cobrados;
  return { cobrados: aPesos(cobrados), devueltos: aPesos(devueltos) };
}

/** Ajuste de cobro todavía sin resolver de un pedido (saldo por cobrar o devolución pendiente), para mostrar. */
export type AjusteUbicacionPendiente = { tipo: TipoAjusteCobro; monto: number };

/**
 * Ajuste pendiente de cada pedido de la lista (clave: id en texto). Un pedido sin ajuste no aparece en el mapa.
 * Lo usan las listas de cobro, el detalle y el ticket para mostrar la línea solo si aplica.
 */
export async function ajustesPendientesUbicacion(
  db: Pick<PrismaClient, 'pedidoCambioUbicacion'>,
  pedidoIds: bigint[],
): Promise<Map<string, AjusteUbicacionPendiente>> {
  const mapa = new Map<string, AjusteUbicacionPendiente>();
  if (pedidoIds.length === 0) return mapa;
  const filas = await db.pedidoCambioUbicacion.findMany({
    where: { pedido_id: { in: pedidoIds }, ajuste_estado: 'PENDIENTE', ajuste_tipo: { not: null } },
    select: { pedido_id: true, ajuste_tipo: true, ajuste_monto: true },
    orderBy: { id: 'desc' },
  });
  for (const f of filas) {
    const clave = String(f.pedido_id);
    if (mapa.has(clave) || f.ajuste_tipo == null) continue;
    mapa.set(clave, { tipo: f.ajuste_tipo as TipoAjusteCobro, monto: Number(f.ajuste_monto ?? 0) });
  }
  return mapa;
}
