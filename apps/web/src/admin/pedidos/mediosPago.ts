/** Medios que llevan foto de comprobante (igual que el servidor). */
export type MedioDigitalVoucher = 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

const MEDIOS_DIGITALES_VOUCHER: readonly MedioDigitalVoucher[] = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Compara dos medios sin distinguir mayúsculas ni espacios ('YAPE' === 'Yape'). */
export function mismoMedio(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? '').trim().toUpperCase();
  return x !== '' && x === (b ?? '').trim().toUpperCase();
}

/** Devuelve el medio digital con foto (YAPE, PLIN, TRANSFERENCIA) o null si no lo es. */
export function medioDigitalVoucher(medio: string | null | undefined): MedioDigitalVoucher | null {
  const up = (medio ?? '').trim().toUpperCase();
  return MEDIOS_DIGITALES_VOUCHER.find((m) => m === up) ?? null;
}

/** Medios digitales del plan (pago dividido), sin repetir y en su orden. Vacío si el plan no tiene digitales. */
export function digitalesDelPlan(planPago: ReadonlyArray<{ medio: string }> | null | undefined): MedioDigitalVoucher[] {
  const medios: MedioDigitalVoucher[] = [];
  for (const f of planPago ?? []) {
    const m = medioDigitalVoucher(f.medio);
    if (m && !medios.includes(m)) medios.push(m);
  }
  return medios;
}

/** Medios que piden el código de operación al confirmar (igual que el servidor: MEDIOS_CON_CODIGO_OPERACION). */
export const MEDIOS_CON_CODIGO_OPERACION: readonly string[] = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/**
 * Medios que necesitan código de operación: los digitales del plan (pago dividido) y el medio elegido, si aplica.
 * El efectivo nunca pide código.
 */
export function mediosQueExigenCodigo(medio: string | null | undefined, planPago: ReadonlyArray<{ medio: string }> | null | undefined): string[] {
  const medios = [...(planPago ?? []).map((f) => f.medio), medio ?? ''].map((m) => m.trim().toUpperCase());
  return [...new Set(medios.filter((m) => MEDIOS_CON_CODIGO_OPERACION.includes(m)))];
}

/**
 * Medios del plan sin captura vigente y legible. Un voucher sin medio cubre cualquiera (compatibilidad),
 * igual que el servidor (voucherCubreMedio).
 */
export function faltanCapturas(
  medios: readonly string[],
  vouchers: ReadonlyArray<{ medio?: string | null; semaforo: string }>,
): string[] {
  return medios.filter(
    (m) => !vouchers.some((v) => v.semaforo !== 'ILEGIBLE' && (v.medio == null || mismoMedio(v.medio, m))),
  );
}
