/** Origen en la cola saliente y en mensaje_chat de los avisos por tipos que el bot no puede leer. */
export const ORIGEN_NO_COMPATIBLE = 'NO_COMPATIBLE';

/** Motivo de derivación a una persona por tres mensajes no compatibles seguidos. */
export const MOTIVO_DERIVACION_NO_COMPATIBLES = 'MEDIOS_NO_COMPATIBLES';

/** Como mucho un aviso cada 2 minutos por conversación. */
export const VENTANA_AVISO_NO_COMPATIBLE_MS = 2 * 60 * 1000;

/** Tres mensajes no compatibles seguidos (sin texto ni botón válido entre medias) derivan a una persona. */
export const LIMITE_NO_COMPATIBLES_SEGUIDOS = 3;

/** Tipo en mensaje_chat para cada subtipo no compatible (metadata del tipo original). */
export function tipoChatNoCompatible(subtipo: string): string {
  switch (subtipo) {
    case 'audio':
    case 'voice':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    case 'sticker':
      return 'STICKER';
    case 'document':
      return 'DOCUMENTO';
    case 'contacts':
      return 'CONTACTO';
    default:
      return 'NO_COMPATIBLE';
  }
}

/**
 * Aviso amable para el cliente. El PDF solo se pide como foto cuando el bot espera un voucher.
 * Emojis solo porque es WhatsApp, uno por mensaje.
 */
export function textoAvisoNoCompatible(subtipo: string, esperaVoucher = false): string {
  const cierre = 'Escríbeme tu mensaje o elige una de las opciones';
  switch (subtipo) {
    case 'audio':
    case 'voice':
      return `Por ahora no puedo escuchar audios 🎧 ${cierre}`;
    case 'video':
      return `No puedo ver videos 🎬 ${cierre}`;
    case 'sticker':
      return `No puedo usar stickers 🙂 ${cierre}`;
    case 'contacts':
      return `No puedo usar contactos 📇 ${cierre}`;
    case 'live_location':
      return 'No puedo seguir una ubicación en vivo 📍 Envíame tu ubicación fija o escribe tu dirección';
    case 'order':
      return `No puedo leer pedidos del catálogo de WhatsApp. ${cierre}`;
    case 'document':
      if (esperaVoucher) return 'Envíame una foto o captura de pantalla del pago 📸 (por ahora no puedo leer PDF)';
      return `No puedo abrir documentos 📄 ${cierre}`;
    default:
      return `No puedo revisar este tipo de mensaje 🤔 ${cierre}`;
  }
}

/**
 * Texto para repetir el paso: el último mensaje que el bot envió a la conversación
 * (su texto más las opciones que tenía, en líneas, porque la cola solo envía texto libre).
 * Devuelve null si no hay nada que repetir. Recorta al límite de WhatsApp (4096).
 */
export function armarTextoRepeticion(contenido: any): string | null {
  const texto = typeof contenido?.texto === 'string' ? contenido.texto.trim() : '';
  if (!texto) return null;

  const opciones = [
    ...(Array.isArray(contenido?.botones) ? contenido.botones : []),
    ...(Array.isArray(contenido?.filas) ? contenido.filas : []),
  ]
    .map((o: any) => String(o?.titulo ?? o?.title ?? '').trim())
    .filter(Boolean);

  const completo = opciones.length ? `${texto}\n\n${opciones.map((o) => `• ${o}`).join('\n')}` : texto;
  return completo.slice(0, 3500);
}
