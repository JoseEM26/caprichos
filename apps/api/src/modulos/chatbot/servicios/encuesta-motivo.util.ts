/** Motivos que se ofrecen cuando el cliente calificó 1, 2 o 3 en la encuesta posventa. */
export const MOTIVOS_ENCUESTA = [
  { codigo: 'DEMORA', titulo: 'Demora' },
  { codigo: 'MAL_ESTADO', titulo: 'Producto en mal estado o frío', corto: 'Mal estado o frío' },
  { codigo: 'INCOMPLETO', titulo: 'Pedido incompleto o equivocado', corto: 'Incompleto o equivocado' },
  { codigo: 'ATENCION', titulo: 'Mala atención' },
  { codigo: 'PRECIO', titulo: 'Precio' },
  { codigo: 'OTRO', titulo: 'Otro (escríbelo)' },
] as const;

export const MOTIVO_TEXTO_MAX = 300;
/** La pregunta del motivo vence a las 24 h (ventana de WhatsApp). */
export const MOTIVO_VENCE_MS = 24 * 60 * 60 * 1000;

/** Código del motivo elegido en la lista (id «motivo:DEMORA»), o null. */
export function interpretarMotivoEncuesta(payload: string | null | undefined): string | null {
  const m = /^motivo:([A-Z_]+)$/.exec((payload ?? '').trim());
  return m && MOTIVOS_ENCUESTA.some((x) => x.codigo === m[1]) ? m[1] : null;
}

/** Texto para mostrar: el escrito por el cliente si fue «Otro», si no la etiqueta del catálogo. */
export function etiquetaMotivo(codigo: string | null | undefined, texto?: string | null): string | null {
  if (!codigo) return null;
  if (codigo === 'OTRO') return texto?.trim() || 'Otro';
  return MOTIVOS_ENCUESTA.find((x) => x.codigo === codigo)?.titulo ?? null;
}
