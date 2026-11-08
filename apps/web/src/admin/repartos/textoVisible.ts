/**
 * Texto que sí puede verse en la pantalla de reparto. Un nombre de cliente que trae un
 * teléfono o un número largo (p. ej. «792627476-1») se limpia para no mostrarlo.
 */
const PATRON_NUMERO_LARGO = /\+?\d[\d\s().-]{5,}\d/g;

export function nombreClienteVisible(nombre: string | null | undefined): string {
  const limpio = String(nombre ?? '')
    .replace(PATRON_NUMERO_LARGO, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio || 'Cliente sin nombre';
}

/**
 * Enlace directo de llamada: `tel:+51…` con el número normalizado, sin intent:// ni wa.me.
 * Perú: 9 dígitos (con o sin 51 / +51). Otro formato se deja con sus dígitos.
 */
export function enlaceLlamar(telefono: string | null | undefined): string | null {
  const d = String(telefono ?? '').replace(/\D/g, '');
  if (!d) return null;
  const nacional = d.length === 11 && d.startsWith('51') ? d.slice(2) : d.length === 9 ? d : null;
  return `tel:+${nacional ? `51${nacional}` : d}`;
}
