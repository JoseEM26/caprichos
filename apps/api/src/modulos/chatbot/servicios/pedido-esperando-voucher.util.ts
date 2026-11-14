import { PrismaService } from '../../../comun/prisma/prisma.service';

/** Medios digitales que llevan voucher. */
export const MEDIOS_DIGITALES_VOUCHER = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Últimos 9 dígitos: el chat guarda 51XXXXXXXXX y el pedido puede traer solo los 9 dígitos. */
export function ultimos9(telefono: string | null | undefined): string {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return digitos.length >= 9 ? digitos.slice(-9) : '';
}

/**
 * Pedido al que pertenece el voucher que llega por WhatsApp. Regla explícita:
 * 1) el pedido que la conversación ya tiene marcado en VALIDAR_PAGO (flujo.pago.pedidoId), si sigue esperando pago;
 * 2) si no, el pedido digital pendiente de pago más reciente del cliente (dos pendientes: gana el más nuevo).
 * Nunca liga a un pedido anulado, entregado, ya pagado o personal. Sin candidato devuelve null.
 */
export async function pedidoEsperandoVoucher(
  prisma: PrismaService,
  flujo: unknown,
  telefono: string | null | undefined,
) {
  const select = {
    id: true,
    codigo: true,
    estado: true,
    total: true,
    monto_credito: true, adelanto_total: true,
    pago_estado: true,
    pago_metodo: true,
    pago_preferido: true,
    modalidad: true,
    cliente_telefono: true,
    creado_en: true,
    planPago: { select: { medio: true, monto: true } },
  } as const;
  const noCerrado = { estado: { notIn: ['ANULADO', 'ENTREGADO'] }, pago_estado: 'PENDIENTE', es_personal: false };

  const marcado = (flujo as any)?.pago?.pedidoId;
  if (marcado && /^\d+$/.test(String(marcado))) {
    const pedido = await prisma.pedido.findFirst({
      where: { id: BigInt(marcado), ...noCerrado },
      select,
    });
    if (pedido) return pedido;
  }

  const fin = ultimos9(telefono);
  if (fin.length !== 9) return null;
  return prisma.pedido.findFirst({
    where: {
      ...noCerrado,
      cliente_telefono: { endsWith: fin },
      OR: [{ pago_preferido: { in: MEDIOS_DIGITALES_VOUCHER } }, { pago_metodo: { in: MEDIOS_DIGITALES_VOUCHER } }],
    },
    orderBy: { creado_en: 'desc' },
    select,
  });
}
