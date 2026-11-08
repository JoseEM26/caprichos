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

/** Delivery que se cobra en presencial al entregar (efectivo o tarjeta, o sin medio): confirmarlo no pide pago ni voucher. */
export function esDeliveryContraEntrega(p: {
  modalidad?: string | null;
  pago_metodo?: string | null;
  pago_preferido?: string | null;
  planPago?: ReadonlyArray<{ medio: string }> | null;
}): boolean {
  if ((p.modalidad || '').toUpperCase() !== 'DELIVERY') return false;
  return !medioDigitalVoucher(p.pago_metodo || p.pago_preferido) && digitalesDelPlan(p.planPago).length === 0;
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
export const MEDIOS_CON_CODIGO_OPERACION: readonly string[] = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

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

/** Pedido del local (mozo o caja, no delivery): puede pasar sin captura con la casilla «ya hablé con el cliente y pagó». */
export function esPedidoLocal(p: { canal?: string | null; modalidad?: string | null }): boolean {
  return ['MOZO', 'CAJA'].includes(String(p.canal ?? '').toUpperCase()) && String(p.modalidad ?? '').toUpperCase() !== 'DELIVERY';
}

/** Texto de la casilla única de consentimiento (igual que el servidor). */
export function textoConfirmaSinCaptura(medio: string | null | undefined): string {
  const nombres: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' };
  const texto = (medio ?? '')
    .split('+')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => nombres[x.toUpperCase()] ?? x)
    .join(' + ');
  return `Confirmo que ya hablé con el cliente y pagó con ${texto || 'el medio digital'} (sin captura)`;
}
