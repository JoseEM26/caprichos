/** Promoción de envío gratis que devuelve la consulta de envío (GET /carta/envio). */
export interface PromoEnvioGratisCarta {
  nombre: string;
  /** Hora de fin «HH:mm» (exclusiva) o null si la promo no tiene horario de fin. */
  hasta: string | null;
  /** Compra mínima para que aplique; null = sin mínimo. */
  compraMinima: number | null;
}

/** «18:00» -> «6:00 pm»; «09:30» -> «9:30 am». Null si no hay hora. */
export function horaAmPm(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return null;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return mStr === '00' ? `${h12}:00 ${ampm}` : `${h12}:${mStr} ${ampm}`;
}

/** Texto de la línea de envío: «Envío gratis hasta las 6:00 pm» o solo «Envío gratis». */
export function textoEnvioGratisHasta(hasta: string | null | undefined): string {
  const fin = horaAmPm(hasta);
  return fin ? `Envío gratis hasta las ${fin}` : 'Envío gratis';
}

/** Igual que el servidor: la promo rige si no hay compra mínima o el subtotal la alcanza. */
export function envioGratisPromoAplica(promo: PromoEnvioGratisCarta | null | undefined, subtotal: number): boolean {
  if (!promo) return false;
  return promo.compraMinima === null || promo.compraMinima === undefined || subtotal >= promo.compraMinima;
}
