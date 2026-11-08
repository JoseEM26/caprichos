import { EntradaNormalizada, TipoEntrada, UbicacionEntrada } from './tipos-conversacion';

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

/** Saludo puro (hola, ola, buenas tardes, hi, hello, menu...), con o sin tildes y signos; no cuenta si trae más pedido. */
const RE_SALUDO =
  /^(?:(?:h?ola+|holi+|hi|hello|hey|buenas tardes|buenas noches|buenas|buen dia|buenos dias|menu|inicio)(?: |$))+$/;
export function esSaludo(texto?: string | null): boolean {
  return RE_SALUDO.test(normalizarTexto(texto));
}

export interface EntradaRawInput {
  texto?: string | null;
  buttonPayload?: string | null;
  listReplyId?: string | null;
  listRowId?: string | null;
  textoOriginal?: string | null;
  tipo?: string | null;
  ubicacion?: UbicacionEntrada;
  /** Marca interna: el texto viene de una nota de voz transcrita (el bot responde como a un texto). */
  desdeAudio?: boolean;
}

/**
 * Normaliza cualquier entrada entrante (texto libre, respuesta de botón o de lista, o ubicación compartida)
 * a una estructura uniforme y determinista.
 */
export function normalizarEntrada(raw: EntradaRawInput): EntradaNormalizada {
  const textoOriginal = String(raw.textoOriginal || raw.texto || '').trim();
  const idBotonOLista = String(raw.buttonPayload || raw.listReplyId || raw.listRowId || '').trim();

  let tipo: TipoEntrada = 'texto';
  if (raw.tipo === 'image' || raw.tipo === 'imagen') {
    tipo = 'image';
  } else if (raw.tipo === 'location' || raw.ubicacion) {
    tipo = 'ubicacion';
  } else if (raw.tipo === 'button' || (raw.buttonPayload && raw.buttonPayload !== raw.texto)) {
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
    ubicacion: raw.ubicacion,
  };
}

