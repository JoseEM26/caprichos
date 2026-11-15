import { esSaludo, normalizarTexto } from './normalizador-entrada.util';

export { esSaludo };

/** Reacciones que se dejan en el mensaje del cliente en vez de contestarle con texto. */
export const EMOJI_VOUCHER_RECIBIDO = '✅';
export const EMOJI_AGRADECIMIENTO = '❤️';

const EMOJIS_AGRADECIMIENTO = ['👍', '👌', '🙏', '❤️', '❤', '😊', '🥰', '💛'];
const RE_AGRADECIMIENTO =
  /^(?:(?:muchas |mil |un millon de )?gracias(?: totales| por todo| por avisar| por la atencion| ok| listo)?|ok(?: gracias)?|oki|okey|okay|listo(?: gracias)?|vale(?: gracias)?|dale(?: gracias)?|perfecto(?: gracias)?|genial|entendido|de acuerdo|gracias por todo)$/;

/** «Gracias», «ok», «listo», 👍…: el mensaje es solo eso (si trae más, es una pregunta y no se reacciona). */
export function esAgradecimiento(texto?: string | null): boolean {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return false;
  if (EMOJIS_AGRADECIMIENTO.includes(crudo)) return true;
  return RE_AGRADECIMIENTO.test(normalizarTexto(crudo));
}
