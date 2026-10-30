import { PrismaService } from '../../../comun/prisma/prisma.service';
import { MEDIOS_DIGITALES_VOUCHER, ultimos9 } from './pedido-esperando-voucher.util';

/** Por defecto, como mucho 3 pedidos por WhatsApp sin pagar por número (parámetro whatsapp_max_pedidos_sin_pagar). */
export const MAX_PEDIDOS_SIN_PAGAR_DEFECTO = 3;

/**
 * Pedidos por WhatsApp de este número, en medio digital, todavía sin pagar, no anulados y de las últimas 24 h.
 * Los pedidos en efectivo o ya pagados no cuentan.
 */
export async function contarPedidosSinPagarWhatsapp(prisma: PrismaService, telefono: string | null | undefined): Promise<number> {
  const fin = ultimos9(telefono);
  if (fin.length !== 9) return 0;
  return prisma.pedido.count({
    where: {
      canal: 'WHATSAPP',
      cliente_telefono: { endsWith: fin },
      estado: { not: 'ANULADO' },
      pago_estado: 'PENDIENTE',
      OR: [{ pago_preferido: { in: MEDIOS_DIGITALES_VOUCHER } }, { pago_metodo: { in: MEDIOS_DIGITALES_VOUCHER } }],
      creado_en: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
}

/** true si este número ya tiene el máximo de pedidos sin pagar: no se crea otro pedido. Un fallo de lectura no bloquea. */
export async function topePedidosSinPagarAlcanzado(prisma: PrismaService, telefono: string | null | undefined): Promise<{ alcanzado: boolean; max: number }> {
  let max = MAX_PEDIDOS_SIN_PAGAR_DEFECTO;
  try {
    const p = await prisma.parametro.findUnique({ where: { clave: 'whatsapp_max_pedidos_sin_pagar' } });
    const n = Number(p?.valor);
    if (Number.isFinite(n) && n > 0) max = n;
  } catch {
    // Se queda con el valor por defecto
  }
  try {
    const cuenta = await contarPedidosSinPagarWhatsapp(prisma, telefono);
    return { alcanzado: cuenta >= max, max };
  } catch {
    return { alcanzado: false, max };
  }
}

export function textoTopePedidosSinPagar(max: number): string {
  return `Tienes ${max} pedidos esperando pago 💛 Paga o cancela uno para pedir otro, o escribe a una persona.`;
}
