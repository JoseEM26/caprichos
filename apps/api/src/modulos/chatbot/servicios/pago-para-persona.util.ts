import { PrismaService } from '../../../comun/prisma/prisma.service';

/**
 * Deja la conversación para que una persona de Caja revise el pago: pasa a PERSONA, urgente,
 * estado VALIDAR_PAGO y guarda el pedido en flujo.pago. Lo usan el voucher que llega por WhatsApp
 * y el pedido de la carta con pago digital (Yape, Plin o transferencia).
 */
export async function marcarPagoParaPersona(
  prisma: PrismaService,
  conversacion: { id: bigint; flujo?: unknown },
  pedido: {
    id: bigint;
    codigo: string;
    total?: unknown;
    pago_preferido?: string | null;
    pago_metodo?: string | null;
  },
  extraPago: Record<string, unknown> = {},
): Promise<void> {
  const flujoActual = (conversacion.flujo as any) || {};
  const pagoPrev = flujoActual.pago || {};

  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: {
      estado: 'VALIDAR_PAGO',
      // Con un pago por revisar la conversación pasa a una persona de Caja: el bot ya no decide
      duenio: 'PERSONA',
      urgente: true,
      flujo: {
        ...flujoActual,
        pago: {
          ...pagoPrev,
          pedidoId: pedido.id.toString(),
          pedidoCodigo: pedido.codigo,
          medio: pedido.pago_preferido || pedido.pago_metodo,
          monto: Number(pedido.total || 0),
          ...extraPago,
        },
      },
    },
  });
}

/**
 * Anota en la conversación el pedido que espera captura SIN tomar el chat: la captura es opcional, así que el
 * bot sigue atendiendo (no pasa a VALIDAR_PAGO, ni a PERSONA, ni urgente). Si el cliente manda la foto después,
 * se enlaza a este pedido. Mantiene el estado y el dueño que ya tenía la conversación.
 */
export async function anotarPagoEnFlujo(
  prisma: PrismaService,
  conversacion: { id: bigint; flujo?: unknown },
  pedido: {
    id: bigint;
    codigo: string;
    total?: unknown;
    pago_preferido?: string | null;
    pago_metodo?: string | null;
  },
  extraPago: Record<string, unknown> = {},
): Promise<void> {
  const flujoActual = (conversacion.flujo as any) || {};
  const pagoPrev = flujoActual.pago || {};
  await prisma.conversacion.update({
    where: { id: conversacion.id },
    data: {
      flujo: {
        ...flujoActual,
        pago: {
          ...pagoPrev,
          pedidoId: pedido.id.toString(),
          pedidoCodigo: pedido.codigo,
          medio: pedido.pago_preferido || pedido.pago_metodo,
          monto: Number(pedido.total || 0),
          ...extraPago,
        },
      },
    },
  });
}
