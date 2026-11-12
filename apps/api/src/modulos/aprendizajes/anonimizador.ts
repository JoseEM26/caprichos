/**
 * Anonimizador determinista (sin IA) de los chats que se leen para aprender. Corre en el servidor ANTES de
 * mandar nada a OpenAI: celulares, documentos, correos, direcciones aproximadas y nombres conocidos de la
 * conversación se reemplazan por <CEL>, <DOC>, <MAIL>, <DIR> y <NOMBRE>.
 */
const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ENLACE = /\bhttps?:\/\/\S+/gi;
const CEL = /(?<!\d)(?:\+?51[\s-]?)?9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)/g;
const RUC = /(?<!\d)(?:10|15|17|20)\d{9}(?!\d)/g;
const DNI = /(?<!\d)\d{8}(?!\d)/g;
const NUMERO_LARGO = /(?<!\d)\d[\d\s-]{8,}\d(?!\d)/g; // cuentas, tarjetas, CCI, otros celulares
const DIRECCION =
  /(?<![\p{L}])(?:av(?:enida)?|jr|jir[oó]n|calle|pasaje|pje|psje|mz(?:a)?|manzana|lote|lt|urb(?:anizaci[oó]n)?|asentamiento|a\.?h\.?|cdra|cuadra)\.?\s+[\p{L}\d#°.-]+(?:\s+[\p{L}\d#°.-]+){0,5}/giu;

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Palabras sueltas del nombre (≥ 3 letras) para quitarlas del texto. */
export const palabrasDeNombre = (...nombres: Array<string | null | undefined>): string[] => {
  const set = new Set<string>();
  for (const n of nombres) {
    for (const p of String(n ?? '').split(/\s+/)) {
      const limpio = p.replace(/[^\p{L}]/gu, '');
      if (limpio.length >= 3) set.add(limpio.toLowerCase());
    }
  }
  return [...set];
};

export function anonimizar(texto: string | null | undefined, nombres: string[] = []): string {
  let t = String(texto ?? '');
  t = t.replace(MAIL, '<MAIL>').replace(ENLACE, '<DIR>');
  t = t.replace(CEL, '<CEL>').replace(RUC, '<DOC>').replace(DNI, '<DOC>').replace(NUMERO_LARGO, '<DOC>');
  t = t.replace(DIRECCION, '<DIR>');
  if (nombres.length) {
    const re = new RegExp(`(?<![\\p{L}])(?:${nombres.map(escapar).join('|')})(?![\\p{L}])`, 'giu');
    t = t.replace(re, '<NOMBRE>');
  }
  return t.replace(/\s+/g, ' ').trim();
}
