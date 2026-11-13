import { resolverRespuesta, type MenuNumerado } from './menu-numerado.util';

/** Mensaje entrante de Evolution ya normalizado al formato del webhook de Meta, o la razón por la que se ignora. */
export type ResultadoNormalizado =
  | { ok: true; msg: Record<string, any>; contacto: { wa_id: string; profile: { name?: string } } }
  | { ok: false; razon: 'PROPIO' | 'GRUPO' | 'ESTADO' | 'SIN_NUMERO' | 'SIN_ID' | 'VACIO' };

const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const baseMime = (m: unknown, def: string) => String(m ?? def).split(';')[0].trim().toLowerCase() || def;

/** Quita los envoltorios (mensajes temporales, ver una vez, documento con texto) hasta llegar al contenido. */
function desenvolver(message: any): any {
  let m = message ?? {};
  for (let i = 0; i < 4; i++) {
    const interno = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message ?? m.documentWithCaptionMessage?.message;
    if (!interno) break;
    m = interno;
  }
  return m;
}

/** Número del remitente: el jid normal, o el alterno cuando WhatsApp manda un identificador interno (@lid). */
function numeroDe(key: any, data: any): string {
  const jid = String(key?.remoteJid ?? '');
  if (jid.endsWith('@s.whatsapp.net')) return soloDigitos(jid.split('@')[0]);
  const alterno = [key?.remoteJidAlt, key?.senderPn, data?.senderPn].find((x) => typeof x === 'string' && x.endsWith('@s.whatsapp.net'));
  return alterno ? soloDigitos(String(alterno).split('@')[0]) : '';
}

/**
 * messages.upsert de Evolution → mensaje con la forma que ya procesa el webhook de Meta (type, text.body, image.id, ...).
 * Ignora lo propio (fromMe), los grupos, los estados y a quien no tiene número visible.
 */
export function normalizarMensajeEvolution(data: any): ResultadoNormalizado {
  const key = data?.key ?? {};
  const jid = String(key.remoteJid ?? '');
  if (key.fromMe === true) return { ok: false, razon: 'PROPIO' };
  if (jid.endsWith('@g.us')) return { ok: false, razon: 'GRUPO' };
  if (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return { ok: false, razon: 'ESTADO' };
  const from = numeroDe(key, data);
  if (!from) return { ok: false, razon: 'SIN_NUMERO' };
  const id = String(key.id ?? '').trim();
  if (!id) return { ok: false, razon: 'SIN_ID' };

  const m = desenvolver(data?.message);
  const base = { id, from, timestamp: String(data?.messageTimestamp ?? Math.floor(Date.now() / 1000)) };
  const mediaId = `evo:${id}`;
  let msg: Record<string, any> | null = null;

  const texto = m.conversation ?? m.extendedTextMessage?.text;
  if (typeof texto === 'string') msg = { ...base, type: 'text', text: { body: texto } };
  else if (m.imageMessage) msg = { ...base, type: 'image', image: { id: mediaId, mime_type: baseMime(m.imageMessage.mimetype, 'image/jpeg'), caption: m.imageMessage.caption } };
  else if (m.audioMessage) msg = { ...base, type: 'audio', audio: { id: mediaId, mime_type: baseMime(m.audioMessage.mimetype, 'audio/ogg'), voice: m.audioMessage.ptt === true } };
  else if (m.documentMessage) {
    msg = { ...base, type: 'document', document: { id: mediaId, mime_type: baseMime(m.documentMessage.mimetype, 'application/pdf'), filename: m.documentMessage.fileName, caption: m.documentMessage.caption } };
  } else if (m.locationMessage) {
    const l = m.locationMessage;
    msg = { ...base, type: 'location', location: { latitude: l.degreesLatitude, longitude: l.degreesLongitude, name: l.name, address: l.address } };
  } else if (m.liveLocationMessage) msg = { ...base, type: 'live_location' };
  else if (m.reactionMessage) msg = { ...base, type: 'reaction', reaction: { emoji: m.reactionMessage.text } };
  else if (m.stickerMessage) msg = { ...base, type: 'sticker' };
  else if (m.videoMessage) msg = { ...base, type: 'video' };
  else if (m.contactMessage || m.contactsArrayMessage) msg = { ...base, type: 'contacts' };
  else if (Object.keys(m).filter((k) => k !== 'messageContextInfo').length) msg = { ...base, type: 'unsupported' };
  if (!msg) return { ok: false, razon: 'VACIO' };

  return { ok: true, msg, contacto: { wa_id: from, profile: { name: data?.pushName ? String(data.pushName) : undefined } } };
}

/**
 * Si el cliente respondió con el número de una opción del último menú numerado, el mensaje pasa a ser la
 * respuesta de botón o de fila que habría llegado de Meta (mismo id y título): el flujo del bot no nota la diferencia.
 */
export function aRespuestaDeMenu(msg: Record<string, any>, menu: MenuNumerado | null): Record<string, any> {
  if (msg.type !== 'text') return msg;
  const opcion = resolverRespuesta(String(msg.text?.body ?? ''), menu);
  if (!opcion || !menu) return msg;
  const { text: _t, ...resto } = msg;
  const respuesta = { id: opcion.id, title: opcion.titulo };
  return menu.tipo === 'lista'
    ? { ...resto, type: 'interactive', interactive: { type: 'list_reply', list_reply: respuesta } }
    : { ...resto, type: 'interactive', interactive: { type: 'button_reply', button_reply: respuesta } };
}
