import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { normalizarTelefono, telefonoEnviable } from '../utilidades/enmascarar.util';
import { generarTokenSeguimiento } from '../../pedidos/seguimiento.tokens';
import { MEDIOS_DIGITALES_VOUCHER, ultimos9 } from './pedido-esperando-voucher.util';
import type { OutboxWhatsappService, CargaSaliente } from './outbox-whatsapp.service';

type ChatLlaves = { telefono?: string | null; celular_vinculado?: string | null; party_id?: bigint | null };

/** Código de pedido dentro de un texto («Hola, mi pedido CP-0123»). */
export const extraerCodigoPedido = (texto: string | null | undefined): string | null =>
  (String(texto ?? '').match(/\bCP-W?\d{3,4}\b/i)?.[0] ?? '').toUpperCase() || null;

const ALFABETO_CLAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
/**
 * Clave corta del wa.me de la carta: derivada (HMAC) del token de seguimiento del pedido, así el servidor la verifica sin guardarla.
 * Los códigos son secuenciales; la clave prueba que el mensaje sale del botón de quien hizo el pedido.
 */
export function claveCortaPedido(pedidoId: bigint | string | number): string {
  const hex = generarTokenSeguimiento(pedidoId);
  let c = '';
  for (let i = 0; i < 5; i++) c += ALFABETO_CLAVE[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % ALFABETO_CLAVE.length];
  return c;
}

/** Clave que el cliente deja en el texto («… (clave 7K4Q2)»); null si no hay. */
/** Celular peruano (9 dígitos) escrito en el texto, sin confundirlo con el código del pedido. */
export const extraerCelularTexto = (texto: string | null | undefined): string | null =>
  String(texto ?? '').replace(/CP-W?\d+/gi, ' ').match(/(?<!\d)(?:\+?51[\s-]?)?(9\d{2}[\s-]?\d{3}[\s-]?\d{3})(?!\d)/)?.[1]?.replace(/\D/g, '') ?? null;

export const extraerClavePedido = (texto: string | null | undefined): string | null =>
  (String(texto ?? '').match(/\bclave\s+([A-Za-z2-9]{5})\b/i)?.[1] ?? '').toUpperCase() || null;

/**
 * Celular (9 dígitos) de un chat: el de su propio número, o, si entró como LID/usuario de WhatsApp (sin número), el que quedó vinculado.
 * Es la llave común de «pedidos de este chat»: el pedido de la carta guarda 9 dígitos y el chat 51XXXXXXXXX.
 */
export function celular9DelChat(chat: ChatLlaves): string {
  const tel = String(chat.telefono ?? '');
  if (tel && !tel.startsWith('wa-user:')) return ultimos9(tel);
  return /^\d{9}$/.test(String(chat.celular_vinculado ?? '')) ? String(chat.celular_vinculado) : '';
}

/** Teléfono 51XXXXXXXXX con el que el bot busca los pedidos del chat ('' si el chat no tiene número ni vínculo). */
export function telefonoDelChat(chat: ChatLlaves): string {
  const c9 = celular9DelChat(chat);
  return c9 ? normalizarTelefono(c9) : '';
}

/** Filtro de pedidos de un chat por todas sus llaves: celular (a 9 dígitos, también el vinculado) y party. null = sin llaves. */
export function condicionPedidosDelChat(chat: ChatLlaves): Prisma.PedidoWhereInput | null {
  const o: Prisma.PedidoWhereInput[] = [];
  const c9 = celular9DelChat(chat);
  if (c9) o.push({ cliente_telefono: { endsWith: c9 } });
  if (chat.party_id) o.push({ cliente_party_id: chat.party_id });
  return o.length ? { OR: o } : null;
}

/** ¿El pedido es de este chat? Por celular (últimos 9) o por party. */
export function pedidoEsDelChat(chat: ChatLlaves, pedido: { cliente_telefono?: string | null; cliente_party_id?: bigint | null }): boolean {
  const c9 = celular9DelChat(chat);
  if (c9 && ultimos9(pedido.cliente_telefono) === c9) return true;
  return !!chat.party_id && !!pedido.cliente_party_id && chat.party_id === pedido.cliente_party_id;
}

/**
 * Pedido por su código para un chat. El celular del chat coincide con el del pedido: basta el código. Si no coincide, solo con la
 * clave correcta (botón de la carta): un chat LID sin vincular queda vinculado al celular del pedido; un chat con otro número lo ve
 * sin vincular. Sin clave o con clave errada devuelve null y no se filtra nada.
 */
export async function pedidoDelChatPorCodigo(prisma: PrismaService, chat: ChatLlaves & { id: bigint }, codigo: string, clave?: string | null, celular?: string | null) {
  const pedido = await prisma.pedido.findUnique({ where: { codigo } });
  if (!pedido) return null;
  if (pedidoEsDelChat(chat, pedido)) return pedido;
  // Prueba de que es suyo: solo la clave del botón de la carta (también los del equipo). El celular escrito NO prueba nada:
  // se conoce con facilidad y los códigos son correlativos; vincularía el chat de un extraño a los pedidos de otra persona.
  void celular;
  const claveOk = !!clave && clave.toUpperCase() === claveCortaPedido(pedido.id);
  if (!claveOk) return null;
  const esLid = String(chat.telefono ?? '').startsWith('wa-user:');
  const cel = telefonoEnviable(pedido.cliente_telefono).slice(-9);
  if (esLid && !chat.celular_vinculado && /^9\d{8}$/.test(cel)) {
    await prisma.conversacion.update({ where: { id: chat.id }, data: { celular_vinculado: cel } });
    chat.celular_vinculado = cel; // el objeto del turno en curso ya lo ve
  }
  return pedido;
}

/**
 * Primer mensaje de un cliente de la carta con su código: sale AL INSTANTE el resumen del pedido (con cómo subir el voucher)
 * que la regla anti-baneo había descartado por no haber contacto previo. Una sola vez por pedido (clave idempotente).
 * Devuelve true si encoló el resumen (el motor no repite la respuesta); false si no aplica o ya salió.
 */
export async function enviarResumenPendienteDeCarta(
  prisma: PrismaService,
  outbox: Pick<OutboxWhatsappService, 'encolar' | 'despertar'>,
  chat: ChatLlaves & { id: bigint },
  texto: string,
): Promise<boolean> {
  const codigo = extraerCodigoPedido(texto);
  if (!codigo) return false;
  const pedido = await pedidoDelChatPorCodigo(prisma, chat, codigo, extraerClavePedido(texto));
  if (!pedido) {
    // Código ajeno sin clave válida: respuesta corta, sin datos del pedido (solo a chats con número; un LID lo contesta el motor)
    const tel = String(chat.telefono ?? '');
    if (!tel.startsWith('wa-user:') && (await prisma.pedido.count({ where: { codigo } })) > 0) {
      const enc = await outbox.encolar({
        telefono: normalizarTelefono(tel),
        tipo: 'TEXTO',
        origen: 'AUTORESPUESTA',
        clave: `pedido-sin-clave-${chat.id}-${codigo}-${Math.floor(Date.now() / 600_000)}`,
        carga: { textoLibre: 'Para mostrarte ese pedido, envía el mensaje desde el botón de la carta o escríbenos desde el celular con que lo hiciste.', autor: 'BOT' } as CargaSaliente,
      });
      if (enc) outbox.despertar();
      return enc;
    }
    return false;
  }
  if (pedido.canal !== 'CARTA' || pedido.estado === 'ANULADO' || pedido.es_personal) return false;
  const filas = await prisma.salienteWhatsapp.findMany({
    where: { pedido_id: pedido.id, origen: 'AVISO_PEDIDO', clave_idempotencia: { startsWith: `pedido-${pedido.id}-RECIBIDO` } },
    select: { estado: true, carga: true },
    orderBy: { id: 'desc' },
  });
  // Ya salió, o está en cola (con el mensaje del cliente la política lo deja pasar): nada que reenviar
  if (filas.some((f) => f.estado === 'ENVIADO' || f.estado === 'PENDIENTE' || f.estado === 'ENVIANDO')) return false;
  // Al chat que escribió (la política anti-baneo solo deja responder a quien escribió); su celular vinculado si es LID
  const telefono = telefonoDelChat(chat) || telefonoEnviable(pedido.cliente_telefono);
  if (!telefono) return false;
  const previo = filas.find((f) => (f.carga as any)?.textoLibre);
  let carga: CargaSaliente;
  if (previo) {
    carga = { ...(previo.carga as object), autor: 'BOT' } as CargaSaliente;
  } else {
    // Nunca se redactó el aviso: confirmación breve y, si debe voucher, cómo subirlo
    const digital = MEDIOS_DIGITALES_VOUCHER.includes(String(pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase()) && pedido.pago_estado === 'PENDIENTE';
    const nombre = (pedido.cliente_nombre || '').split(/\s+/)[0] || 'Hola';
    carga = {
      textoLibre: `¡Hola, ${nombre}! Recibimos tu pedido ${pedido.codigo} por S/ ${Number(pedido.total).toFixed(2)}.${digital ? ' Para validar tu pago, envíanos aquí la foto de tu voucher (Yape, Plin o transferencia).' : ''} Te avisamos por aquí cuando avance 💛`,
      autor: 'BOT',
      nombre: pedido.cliente_nombre,
      pedidoCodigo: pedido.codigo,
      etapa: 'RECIBIDO',
    } as CargaSaliente;
  }
  const encolado = await outbox.encolar({
    telefono,
    tipo: 'TEXTO',
    // Origen de respuesta: el cliente acaba de escribir, la política anti-baneo lo deja pasar
    origen: 'AUTORESPUESTA',
    clave: `pedido-${pedido.id}-RESUMEN-CHAT`,
    pedidoId: pedido.id,
    carga,
  });
  if (encolado) outbox.despertar();
  return encolado;
}
