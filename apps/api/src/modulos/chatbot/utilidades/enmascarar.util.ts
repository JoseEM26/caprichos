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
