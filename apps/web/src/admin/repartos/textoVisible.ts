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
