import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';

const logger = new Logger('ValidarPagoSalida');

/** Estados de pedido que cierran la espera de un pago: ya no hay nada que revisar. */
const ESTADOS_PEDIDO_CERRADO = ['ANULADO', 'ENTREGADO', 'CANCELADO'];

/** Minutos de espera de un comprobante que nunca llegó (parámetro chatbot_pago_expira_min; 0 = sin vencimiento). */
export async function leerExpiraPagoMin(prisma: PrismaService): Promise<number> {
  try {
    const param = await prisma.parametro.findUnique({ where: { clave: 'chatbot_pago_expira_min' } });
    const val = Number(param?.valor);
    if (param && param.valor != null && !isNaN(val) && val >= 0) return val;
  } catch (err: any) {
    logger.warn(`Error leyendo parametro chatbot_pago_expira_min: ${err.message}`);
  }
  return 30;
}

/** Pedido que la conversación tiene marcado en flujo.pago.pedidoId, o null si no tiene uno válido. */
export function pedidoIdDePago(flujo: unknown): bigint | null {
  const marcado = (flujo as any)?.pago?.pedidoId;
  return marcado && /^\d+$/.test(String(marcado)) ? BigInt(marcado) : null;
}

/**
 * Regla única para salir de VALIDAR_PAGO. Devuelve el motivo (texto) o null si la conversación sigue en espera.
 * `pedido` null = el pedido ya no existe. Con un voucher enviado nunca vence por tiempo: solo cuenta
 * que Caja decida o que el pedido se cierre (así no se oculta un comprobante sin revisar).
 */
export function motivoSalidaValidarPago(
  pedido: { estado: string; pago_estado: string | null; creado_en?: Date | string | null } | null,
  pago: { timestampUltimoVoucher?: unknown } | null | undefined,
  ahora: Date,
  expiraMin: number,
): string | null {
  if (!pedido) return 'el pedido ya no existe';
  if (ESTADOS_PEDIDO_CERRADO.includes(String(pedido.estado))) return `el pedido está ${pedido.estado}`;
  if (pedido.pago_estado && pedido.pago_estado !== 'PENDIENTE') return `el pago está ${pedido.pago_estado}`;
  if (!Number(pago?.timestampUltimoVoucher) && expiraMin > 0 && pedido.creado_en) {
    const ref = new Date(pedido.creado_en).getTime();
    if (ref && ahora.getTime() - ref > expiraMin * 60000) return `venció la espera de pago (${expiraMin} min)`;
  }
  return null;
}

/**
 * Saca la conversación de VALIDAR_PAGO: estado MENU y, si nadie la tiene tomada, vuelve al bot.
 * Deja un mensaje de sistema (no sale al cliente). No envía nada por WhatsApp ni emite sockets.
 */
export async function sacarDeValidarPago(
  prisma: PrismaService,
  conversacion: { id: bigint; tomado_por?: unknown; motivo_derivacion?: string | null },
  flujo: unknown,
  motivo: string,
): Promise<{ flujo: any; data: any }> {
  const nuevoFlujo: any = { ...((flujo as any) || {}) };
  if (nuevoFlujo.estado === 'VALIDAR_PAGO') nuevoFlujo.estado = 'MENU';
  const data: any = { estado: 'MENU', flujo: nuevoFlujo };
  if (conversacion.tomado_por == null && conversacion.motivo_derivacion !== 'CALIFICACION_BAJA') {
    data.duenio = 'BOT';
    data.urgente = false;
    data.motivo_derivacion = null;
  }
  await prisma.conversacion.update({ where: { id: conversacion.id }, data });
  await prisma.mensajeChat.create({
    data: {
      conversacion_id: conversacion.id,
      direccion: 'SALE',
      autor: 'BOT',
      tipo: 'SISTEMA',
      contenido: { texto: `La conversación salió de «Validar pago»: ${motivo}.` } as any,
    },
  });
  return { flujo: nuevoFlujo, data };
}

/**
 * Cierre silencioso: Caja cobró/coordinó el pedido, así que las conversaciones de VALIDAR_PAGO ligadas a él
 * salen de la espera sin mensaje al cliente. Idempotente; nunca lanza (solo registra el error).
 * Devuelve los ids de las conversaciones cerradas.
 */
export async function cerrarValidarPagoDePedido(
  prisma: PrismaService,
  pedidoId: bigint,
  motivo: string,
  eventos?: { emitirAdmin: (evento: string, datos: unknown) => unknown },
): Promise<bigint[]> {
  const cerradas: bigint[] = [];
  try {
    const enEspera = await prisma.conversacion.findMany({
      where: { estado: 'VALIDAR_PAGO' },
      select: { id: true, flujo: true, tomado_por: true, motivo_derivacion: true },
    });
    for (const conv of enEspera) {
      if (pedidoIdDePago(conv.flujo)?.toString() !== pedidoId.toString()) continue;
      await sacarDeValidarPago(prisma, conv, conv.flujo, motivo);
      cerradas.push(conv.id);
      eventos?.emitirAdmin('mensajes:actualizado', { id: conv.id.toString() });
    }
  } catch (err: any) {
    logger.error(`No se pudo cerrar Validar pago del pedido ${pedidoId}: ${err?.message}`, err?.stack);
  }
  return cerradas;
}
