/**
 * Mapa de caracteres unicode comunes a sus bytes correspondientes en Windows-1252.
 */
const MAPA_UNICODE_A_1252: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8A,
  '‹': 0x8B,
  'Œ': 0x8C,
  'Ž': 0x8E,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '●': 0x95, // Viñeta usada en la web de Caprichos convertida a bullet 1252
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9A,
  '›': 0x9B,
  'œ': 0x9C,
  'ž': 0x9E,
  'Ÿ': 0x9F,
};

/**
 * Convierte una cadena de JavaScript (UTF-16) a un Buffer codificado en Windows-1252 (CP1252).
 * Respeta 1 byte por carácter para español (á, é, í, ó, ú, ñ, Á, É, Í, Ó, Ú, Ñ, ü, Ü, ¡, ¿)
 * y sustituye símbolos no representables por su equivalente ASCII o '?'.
 */
export function aWindows1252(cadena: string): Buffer {
  const bytes: number[] = [];

  for (let i = 0; i < cadena.length; i++) {
    const char = cadena[i];
    const code = cadena.charCodeAt(i);

    // ASCII estándar (0x00 - 0x7F)
    if (code <= 0x7F) {
      bytes.push(code);
      continue;
    }

    // Mapa especial (0x80 - 0x9F)
    if (MAPA_UNICODE_A_1252[char] !== undefined) {
      bytes.push(MAPA_UNICODE_A_1252[char]);
      continue;
    }

    // Rango ISO-8859-1 / Windows-1252 directo (0xA0 - 0xFF)
    if (code >= 0xA0 && code <= 0xFF) {
      bytes.push(code);
      continue;
    }

    // Intentar descomponer acentos unicode combinados
    const descompuesto = char.normalize('NFD');
    if (descompuesto.length > 1 && descompuesto.charCodeAt(0) <= 0x7F) {
      bytes.push(descompuesto.charCodeAt(0));
      continue;
    }

    // Carácter no representable en 1252
    bytes.push(0x3F); // '?'
  }

  return Buffer.from(bytes);
}

/**
 * Limpia y normaliza texto para ser incrustado sin peligro dentro de los comandos TEXT "..." de TSPL.
 * Reemplaza comillas dobles por simples y saltos de línea por espacios.
 */
export function limpiarParaTspl(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, ' ')
    .trim();
}
