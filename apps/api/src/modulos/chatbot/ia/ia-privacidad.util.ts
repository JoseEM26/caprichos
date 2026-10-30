/**
 * Utilidades de privacidad y protección de datos personales (Ley 29733 / aybar-datos-que-no-salen).
 * Garantiza que datos identificables (teléfonos, DNI, BSUID, correos, cuentas, direcciones exactas)
 * sean enmascarados de forma irreversible antes de ser enviados a proveedores externos como OpenAI.
 */

/**
 * Expresiones regulares para detección y enmascaramiento de datos personales en el texto.
 */
const REGEX_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const REGEX_BSUID = /\b(?:PE|WA)\.\d{6,}\b/gi;
const REGEX_DNI = /\b\d{8}\b/g;
const REGEX_TELEFONO_PERU = /(?:\+?51[\s-]?)?\b9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g;
const REGEX_NUMEROS_LARGOS = /\b\d{10,}\b/g; // Cuentas bancarias, tarjetas, CCI
const REGEX_DIRECCION = /\b(?:av(?:enida)?|jr|jir[oó]n|calle|pasaje|pje|mz(?:a)?|manzana|lote|lt|urb(?:anizaci[oó]n)?)\.?\s+[A-Za-z0-9\s#°.-]+?(?=(?:\s+(?:y\s+mi|y|mi)\b|[,;.\n]|$))/gi;

/**
 * Enmascara información sensible en cualquier cadena de texto destinada a proveedores externos.
 */
export function enmascararDatosSensibles(texto: string | null | undefined): string {
  if (!texto) return '';

  let resultado = String(texto);

  // 1. Enmascarar correos electrónicos
  resultado = resultado.replace(REGEX_EMAIL, '[CORREO]');

  // 2. Enmascarar identificadores de Meta BSUID
  resultado = resultado.replace(REGEX_BSUID, '[ID_USUARIO]');

  // 3. Enmascarar teléfonos celulares peruanos
  resultado = resultado.replace(REGEX_TELEFONO_PERU, '[TELÉFONO]');

  // 4. Enmascarar números largos (cuentas, tarjetas, CCI)
  resultado = resultado.replace(REGEX_NUMEROS_LARGOS, '[NÚMERO]');

  // 5. Enmascarar DNI (8 dígitos aislados)
  resultado = resultado.replace(REGEX_DNI, '[DNI]');

  // 6. Enmascarar direcciones de entrega detectables
  resultado = resultado.replace(REGEX_DIRECCION, '[DIRECCIÓN]');

  return resultado;
}

/**
 * Extrae de forma segura únicamente el primer nombre del cliente, protegiendo apellidos.
 * Ej: "Ana María Quispe" -> "Ana"
 */
export function extraerPrimerNombre(nombreCompleto?: string | null): string {
  if (!nombreCompleto) return 'Cliente';
  const limpio = nombreCompleto.trim();
  if (!limpio) return 'Cliente';

  // Si el nombre parece un teléfono o BSUID, no usarlo
  if (/^(\+?51)?9\d{8}$/.test(limpio) || /^(PE|WA)\./i.test(limpio)) {
    return 'Cliente';
  }

  const partes = limpio.split(/\s+/);
  const primerNombre = partes[0] || 'Cliente';

  // Solo permitir caracteres alfabéticos seguros
  const filtrado = primerNombre.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, '');
  return filtrado.length >= 2 ? filtrado : 'Cliente';
}

/**
 * Prepara el historial de conversación enmascarado, recortado a un máximo estricto de 6 mensajes.
 */
export function prepararHistorialPrivado(
  mensajes: Array<{ autor: string; texto: string }>,
  maxMensajes = 6,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return [];
  }

  const recorte = mensajes.slice(-maxMensajes);

  return recorte.map((m) => {
    const role: 'user' | 'assistant' =
      m.autor === 'CLIENTE' || m.autor === 'user' ? 'user' : 'assistant';
    return {
      role,
      content: enmascararDatosSensibles(m.texto),
    };
  });
}
