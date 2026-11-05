/**
 * Códigos de error de plantilla de la Cloud API de Meta (132000-132016): causa y mensaje en español con la
 * acción a seguir. Lo usan el adaptador (clasificación), la pantalla de mensajes y la pestaña Salientes.
 */
export interface CausaMeta {
  codigo: string;
  mensaje: string;
}

const NO_APROBADA: CausaMeta = {
  codigo: 'PLANTILLA_NO_APROBADA',
  mensaje: 'La plantilla no existe en Meta con ese nombre o no está aprobada. Revisa en Meta que esté aprobada y que el nombre coincida.',
};
const NO_EXISTE_IDIOMA: CausaMeta = {
  codigo: 'PLANTILLA_NO_EXISTE_IDIOMA',
  mensaje: 'Meta no tiene esa plantilla en ese idioma. Revisa el nombre y el idioma de la plantilla.',
};
const RECHAZADA_GENERICA: CausaMeta = {
  codigo: 'PLANTILLA_RECHAZADA_META',
  mensaje: 'Meta rechazó la plantilla. Revisa su estado en Meta y el detalle técnico.',
};

const CAUSAS_POR_CODIGO: Record<number, CausaMeta> = {
  132000: {
    codigo: 'PLANTILLA_VARIABLES_NO_COINCIDEN',
    mensaje: 'El número de variables enviadas no coincide con la plantilla de Meta. Revisa cuántas variables pide la plantilla.',
  },
  132005: {
    codigo: 'PLANTILLA_TEXTO_LARGO',
    mensaje: 'El texto de la plantilla en ese idioma es demasiado largo para Meta. Acórtalo en Meta.',
  },
  132007: {
    codigo: 'PLANTILLA_RECHAZADA_POLITICA',
    mensaje: 'Meta rechazó el contenido por su política de WhatsApp. Revisa el texto de la plantilla y sus variables.',
  },
  132012: {
    codigo: 'PLANTILLA_FORMATO_VARIABLE',
    mensaje: 'Una variable tiene un formato que Meta no admite: saltos de línea, tabulaciones o espacios repetidos.',
  },
  132015: {
    codigo: 'PLANTILLA_PAUSADA',
    mensaje: 'Meta pausó la plantilla por baja calidad. Hay que revisarla en Meta antes de volver a usarla.',
  },
  132016: {
    codigo: 'PLANTILLA_DESACTIVADA',
    mensaje: 'La plantilla está desactivada en Meta. Actívala en Meta o usa otra.',
  },
};

const TODAS_LAS_CAUSAS: CausaMeta[] = [
  ...Object.values(CAUSAS_POR_CODIGO),
  NO_APROBADA,
  NO_EXISTE_IDIOMA,
  RECHAZADA_GENERICA,
];

/** Códigos de plantilla que no mejoran reintentando (lo usa el outbox como permanentes). */
export const CODIGOS_PLANTILLA_PERMANENTES: string[] = TODAS_LAS_CAUSAS.map((c) => c.codigo);

export const esCodigoPlantillaMeta = (metaCodigo: number): boolean => metaCodigo >= 132000 && metaCodigo <= 132016;

/**
 * Causa de un código 132xxx de Meta. 132001 es «no existe»: si Meta dice que no existe o no está aprobada es
 * PLANTILLA_NO_APROBADA; si no, el nombre existe pero no en ese idioma. Null si el código no es de plantilla.
 */
export function causaPlantillaMeta(metaCodigo: number, texto = ''): CausaMeta | null {
  if (!esCodigoPlantillaMeta(metaCodigo)) return null;
  if (metaCodigo === 132001) {
    const t = texto.toLowerCase();
    return t.includes('does not exist') || t.includes('not approved') ? NO_APROBADA : NO_EXISTE_IDIOMA;
  }
  return CAUSAS_POR_CODIGO[metaCodigo] ?? RECHAZADA_GENERICA;
}

/** Causa a partir del código de clasificación interno (PLANTILLA_*), o null si no es de plantilla. */
export function causaPorCodigoPlantilla(codigo: string): CausaMeta | null {
  return TODAS_LAS_CAUSAS.find((c) => c.codigo === codigo) ?? null;
}

/**
 * Variable de plantilla válida para Meta: sin saltos de línea, tabulaciones ni espacios repetidos, sin recortes
 * de sobra. Meta no admite parámetros vacíos, así que si queda vacía va «-».
 */
export function sanearVariablePlantilla(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim() || '-';
}

const TOKEN = /(EAA[A-Za-z0-9]{10,}|Bearer\s+\S+|access_token=[^&\s]+)/gi;
const TELEFONO = /\+?\d{8,}/g;
const BSUID = /\b[A-Za-z]{2}\.\d{6,}\b/g;
const LONGITUD_MAX_DETALLE = 500;

/** Texto original de Meta sin tokens, teléfonos ni BSUID, máximo 500 caracteres. */
export function sanearDetalleMeta(texto: unknown): string {
  return String(texto ?? '').replace(TOKEN, '[oculto]').replace(BSUID, '[identificador]').replace(TELEFONO, '[numero]').trim().slice(0, LONGITUD_MAX_DETALLE);
}

/** Texto que se guarda en error_detalle: «[132012] mensaje original de Meta» (sin código si no hubo). */
export function detalleTecnicoMeta(metaCodigo: number | string | null | undefined, original: unknown): string {
  const cuerpo = sanearDetalleMeta(original);
  const texto = metaCodigo ? `[${metaCodigo}] ${cuerpo}` : cuerpo;
  return texto.slice(0, LONGITUD_MAX_DETALLE);
}

/**
 * Inverso de detalleTecnicoMeta para la pantalla: código de Meta (del código guardado o del prefijo) y
 * texto original. Null si no hay nada que mostrar.
 */
export function separarDetalleTecnico(
  errorCodigo?: string | null,
  errorDetalle?: string | null,
): { codigoMeta: string | null; original: string | null } | null {
  const detalle = String(errorDetalle ?? '');
  const prefijo = detalle.match(/^\[(\d{4,6})\]\s*/);
  const original = prefijo ? detalle.slice(prefijo[0].length) : detalle;
  const codigoMeta = /^\d{4,6}$/.test(String(errorCodigo ?? '')) ? String(errorCodigo) : prefijo ? prefijo[1] : null;
  if (!codigoMeta && !original) return null;
  return { codigoMeta, original: original || null };
}

/** Detalle técnico de un error del adaptador: el original de Meta si lo hubo, si no el mensaje propio. */
export function detalleDeErrorMeta(
  error?: { mensaje: string; metaCodigo?: number; detalleOriginal?: string } | null,
): string | undefined {
  if (!error) return undefined;
  return error.detalleOriginal ? detalleTecnicoMeta(error.metaCodigo, error.detalleOriginal) : error.mensaje;
}
