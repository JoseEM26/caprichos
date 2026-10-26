import { EntradaNormalizada, TipoEntrada } from './tipos-conversacion';

/**
 * Normaliza una cadena de texto para comparaciones seguras e insensibles a diacríticos:
 * - Convierte a minúsculas.
 * - Elimina acentos y tildes (NFD).
 * - Elimina caracteres no alfanuméricos preservando espacios simples.
 * - Colapsa espacios redundantes.
 */
export function normalizarTexto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^\w\s]/g, ' ') // Quitar signos de puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

export interface EntradaRawInput {
  texto?: string | null;
  buttonPayload?: string | null;
  listReplyId?: string | null;
  listRowId?: string | null;
  textoOriginal?: string | null;
  tipo?: string | null;
}

/**
 * Normaliza cualquier entrada entrante (texto libre, respuesta de botón o de lista)
 * a una estructura uniforme y determinista.
 */
export function normalizarEntrada(raw: EntradaRawInput): EntradaNormalizada {
  const textoOriginal = String(raw.textoOriginal || raw.texto || '').trim();
  const idBotonOLista = String(raw.buttonPayload || raw.listReplyId || raw.listRowId || '').trim();

  let tipo: TipoEntrada = 'texto';
  if (raw.tipo === 'button' || (raw.buttonPayload && raw.buttonPayload !== raw.texto)) {
    tipo = 'boton';
  } else if (raw.tipo === 'interactive' || raw.listReplyId) {
    tipo = raw.listReplyId ? 'lista' : 'boton';
  }

  // Si vino un ID de botón o de lista, evaluamos tanto el ID como el texto descriptivo
  const textoCandidato = idBotonOLista || textoOriginal;
  const textoNormalizado = normalizarTexto(textoCandidato);

  return {
    tipo,
    texto: textoNormalizado,
    textoOriginal,
    id: idBotonOLista || undefined,
  };
}
