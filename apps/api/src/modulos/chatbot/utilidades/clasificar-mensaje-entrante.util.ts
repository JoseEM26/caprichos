/**
 * Clasificación pura de un mensaje entrante de WhatsApp Cloud API.
 * - TEXTO, BOTON, UBICACION, IMAGEN y REACCION son los tipos que el bot ya entiende.
 * - NO_COMPATIBLE: audio/nota de voz, video, sticker, documento, contactos, pedido de catálogo,
 *   ubicación en vivo, mensajes de sistema y cualquier tipo desconocido. El bot no los lee: no avanzan el flujo.
 */
export type ClaseMensajeEntrante =
  | 'TEXTO'
  | 'BOTON'
  | 'UBICACION'
  | 'IMAGEN'
  | 'REACCION'
  | 'NO_COMPATIBLE';

export interface ClasificacionMensajeEntrante {
  clase: ClaseMensajeEntrante;
  /** Tipo original de WhatsApp (o el subtipo interactivo): sirve para elegir el aviso y el tipo en mensaje_chat. */
  subtipo: string;
  /** Nombre legible para el equipo en el chat. */
  etiqueta: string;
}

const ETIQUETAS_NO_COMPATIBLE: Record<string, string> = {
  audio: 'Audio',
  video: 'Video',
  sticker: 'Sticker',
  document: 'Documento',
  contacts: 'Contacto',
  order: 'Pedido de catálogo',
  live_location: 'Ubicación en vivo',
  system: 'Mensaje del sistema',
};

export function clasificarMensajeEntrante(msg: any): ClasificacionMensajeEntrante {
  const tipo = String(msg?.type ?? '');

  switch (tipo) {
    case 'text':
      return { clase: 'TEXTO', subtipo: 'text', etiqueta: 'Texto' };
    case 'button':
      return { clase: 'BOTON', subtipo: 'button', etiqueta: 'Botón' };
    case 'interactive':
      return { clase: 'BOTON', subtipo: String(msg.interactive?.type ?? 'interactive'), etiqueta: 'Botón' };
    case 'location':
      // Ubicación en vivo: Meta la envía como location con marca de tiempo real (verificar el campo exacto con un payload real)
      if (msg.location?.is_live === true) {
        return { clase: 'NO_COMPATIBLE', subtipo: 'live_location', etiqueta: ETIQUETAS_NO_COMPATIBLE.live_location };
      }
      return { clase: 'UBICACION', subtipo: 'location', etiqueta: 'Ubicación' };
    case 'image':
      return { clase: 'IMAGEN', subtipo: 'image', etiqueta: 'Imagen' };
    case 'reaction':
      return { clase: 'REACCION', subtipo: 'reaction', etiqueta: 'Reacción' };
    case 'audio': {
      const voz = msg.audio?.voice === true;
      return { clase: 'NO_COMPATIBLE', subtipo: voz ? 'voice' : 'audio', etiqueta: voz ? 'Nota de voz' : 'Audio' };
    }
    case 'live_location':
      return { clase: 'NO_COMPATIBLE', subtipo: 'live_location', etiqueta: ETIQUETAS_NO_COMPATIBLE.live_location };
    default:
      if (ETIQUETAS_NO_COMPATIBLE[tipo]) {
        return { clase: 'NO_COMPATIBLE', subtipo: tipo, etiqueta: ETIQUETAS_NO_COMPATIBLE[tipo] };
      }
      return { clase: 'NO_COMPATIBLE', subtipo: tipo || 'desconocido', etiqueta: 'Mensaje no compatible' };
  }
}
