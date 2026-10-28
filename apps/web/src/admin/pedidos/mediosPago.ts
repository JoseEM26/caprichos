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
