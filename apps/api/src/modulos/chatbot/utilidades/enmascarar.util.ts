import * as crypto from 'crypto';

/**
 * Normaliza un número de teléfono a formato estándar E.164 (solo dígitos con código de país 51 si es Perú).
 */
export function normalizarTelefono(telefono: string): string {
  if (!telefono) return '';
  const digitos = String(telefono).replace(/\D/g, '');
  if (digitos.length === 9 && digitos.startsWith('9')) {
    return `51${digitos}`;
  }
  return digitos;
}

/**
 * Relleno histórico que el pedido de mesa guardaba cuando no había teléfono. NO es un número real.
 */
export const TELEFONO_PLACEHOLDER = '999999999';

/**
 * ¿Hay un teléfono real? Vacío, nulo y el relleno 999999999 no cuentan. No exige formato: en cliente_telefono
 * también puede venir un BSUID de WhatsApp («wa-user:PE.…»), que sí se contesta.
 */
export function tieneTelefonoReal(telefono: string | null | undefined): boolean {
  const limpio = String(telefono ?? '').trim().replace(/^wa-user:/i, '').trim();
  if (!limpio) return false;
  const digitos = limpio.replace(/\D/g, '');
  const nacional = digitos.length === 11 && digitos.startsWith('51') ? digitos.slice(2) : digitos;
  return nacional !== TELEFONO_PLACEHOLDER;
}

/**
 * Número para mandar WhatsApp, o '' si el pedido no tiene teléfono real (no se envía nada).
 */
export function telefonoEnviable(telefono: string | null | undefined): string {
  return tieneTelefonoReal(telefono) ? normalizarTelefono(String(telefono)) : '';
}

/**
 * Enmascara un teléfono para proteger datos personales (Ley 29733).
 * NUNCA se registra ni expone el número completo.
 * Ejemplo: "51987654321" -> "+51 9*** ***21"
 *          "987654321"   -> "9*** ***21"
 */
export function enmascararTelefono(telefono: string): string {
  if (!telefono) return '***';
  const limpio = String(telefono).trim();
  const sinPrefijo = limpio.replace(/^wa-user:/i, '').trim();

  // BSUID con formato PE.<digitos> o dos letras + punto
  if (sinPrefijo.includes('.') || /^[A-Za-z]{2}\./i.test(sinPrefijo)) {
    const partes = sinPrefijo.split('.');
    const prefijoPais = partes[0].toUpperCase() + '.';
    const resto = partes.slice(1).join('.');
    if (resto.length > 4) {
      return `${prefijoPais}${resto.slice(0, 3)}***${resto.slice(-1)}`;
    }
    return `${prefijoPais}***`;
  }

  const digitos = normalizarTelefono(limpio);

  if (digitos.startsWith('51') && digitos.length === 11) {
    const nacional = digitos.slice(2);
    return `+51 ${nacional[0]}*** ***${nacional.slice(-2)}`;
  }

  if (digitos.length === 9) {
    return `${digitos[0]}*** ***${digitos.slice(-2)}`;
  }

  if (digitos.length > 4) {
    return `${digitos.slice(0, 2)}***${digitos.slice(-2)}`;
  }

  return '***';
}

/**
 * Genera el hash criptográfico SHA-256 del teléfono o BSUID normalizado para búsquedas e indexación seguras.
 */
export function hashTelefono(telefono: string): string {
  if (!telefono) return crypto.createHash('sha256').update('').digest('hex');
  const limpio = String(telefono).trim().replace(/^wa-user:/i, '').trim();
  if (limpio.includes('.') || /^[A-Za-z]{2}\./i.test(limpio)) {
    return crypto.createHash('sha256').update(limpio).digest('hex');
  }
  const norm = normalizarTelefono(telefono);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/** Origen de los códigos de un solo uso (crear cuenta y recuperar contraseña). */
export const ORIGEN_CODIGO_CUENTA = 'CODIGO_CUENTA';

/**
 * Texto que ve el personal (Salientes y chat). En un código de cuenta los 6 dígitos nunca salen:
 * «Tu código es 123456» queda «Tu código es ••••••». Otros textos pasan igual.
 */
export function textoParaPersonal(origen: string, texto: string | null | undefined): string | null {
  if (texto == null) return null;
  return origen === ORIGEN_CODIGO_CUENTA ? texto.replace(/\d{6}/g, '••••••') : texto;
}
