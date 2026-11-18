import type { MedioPagoOnline } from './pasarela.puerto';

/** Medio según el prefijo del token de Culqi Checkout: `ype_` = Yape, `tkn_` = tarjeta. Otro prefijo: null. */
export function medioDelToken(token: string): MedioPagoOnline | null {
  if (token.startsWith('ype_')) return 'YAPE';
  if (token.startsWith('tkn_')) return 'TARJETA';
  return null;
}

/**
 * Medio según el `source` del cargo que devuelve Culqi: con datos de tarjeta (marca o últimos 4) es TARJETA;
 * sin ellos, un source de tipo yape es YAPE; si el cargo no dice nada, null (manda el prefijo del token).
 */
export function medioDeFuenteCulqi(source: unknown): MedioPagoOnline | null {
  if (!source || typeof source !== 'object') return null;
  const s = source as Record<string, any>;
  const tieneTarjeta = !!s.iin?.card_brand || /^\d{4}$/.test(String(s.card_number ?? '').slice(-4)) || /^\d{4}$/.test(String(s.last_four ?? ''));
  if (tieneTarjeta) return 'TARJETA';
  if (/yape/i.test(`${s.type ?? ''} ${s.object ?? ''}`)) return 'YAPE';
  return null;
}

/** Marca y últimos 4 de la tarjeta del `source` del cargo de Culqi (null si no hay). */
export function tarjetaDeFuenteCulqi(source: unknown): { marca: string | null; ultimos4: string | null } {
  const s = (source && typeof source === 'object' ? source : {}) as Record<string, any>;
  const num = String(s.card_number ?? '');
  return {
    marca: s.iin?.card_brand ?? null,
    ultimos4: /^\d{4}$/.test(num.slice(-4)) ? num.slice(-4) : (s.last_four ?? null),
  };
}
