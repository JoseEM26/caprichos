/** Códigos de error de Culqi -> texto simple para el cliente. Nunca se habla de fraude ni de sospecha. */
export const MENSAJE_GENERICO = 'No pudimos procesar tu pago. Revisa los datos o prueba con otro medio.';
const MSG_BANCO = 'Tu banco no autorizó el pago, prueba con otra tarjeta.';
const MSG_REINTENTO = 'Hubo un problema al procesar el pago. Intenta de nuevo en unos minutos.';

const MENSAJES: Record<string, string> = {
  insufficient_funds: 'Fondos insuficientes. Prueba con otra tarjeta o con Yape.',
  incorrect_cvv: 'Revisa el código de seguridad (CVV) de tu tarjeta.',
  invalid_cvv: 'Revisa el código de seguridad (CVV) de tu tarjeta.',
  incorrect_number: 'Revisa el número de tu tarjeta.',
  invalid_number: 'Revisa el número de tu tarjeta.',
  invalid_card: 'Revisa los datos de tu tarjeta o prueba con otra.',
  expired_card: 'Tu tarjeta está vencida. Prueba con otra tarjeta.',
  card_declined: MSG_BANCO,
  stolen_card: MSG_BANCO,
  lost_card: MSG_BANCO,
  fraudulent: MSG_BANCO,
  issuer_decline_operation: MSG_BANCO,
  contact_issuer: 'Tu banco no autorizó el pago. Comunícate con tu banco o prueba con otra tarjeta.',
  issuer_not_available: 'No pudimos comunicarnos con tu banco. Intenta de nuevo en unos minutos o prueba con otra tarjeta.',
  processing_error: MSG_REINTENTO,
};

/** Primer código reconocible entre los campos de un error de Culqi (decline_code, code, y CULQ/PREV/DNG dentro de los textos). */
export function codigoDeError(json: any): string {
  const campos = [json?.decline_code, json?.code, json?.merchant_message, json?.user_message].map((x) => String(x ?? ''));
  for (const c of campos.slice(0, 2)) if (MENSAJES[c]) return c;
  for (const c of campos) {
    const m = c.match(/\b(CULQ|PREV|DNG[A-Z])\d{3,4}\b/i);
    if (m) return m[0].toUpperCase();
  }
  return campos[0] || campos[1];
}

export function mensajeDeError(json: any): string {
  const c = codigoDeError(json);
  if (MENSAJES[c]) return MENSAJES[c];
  if (/^(PREV|DNG[A-Z])/.test(c)) return MSG_BANCO; // prevención / denegada: el cliente no necesita saber más
  if (/^CULQ/.test(c)) return MSG_REINTENTO;
  return MENSAJE_GENERICO;
}
