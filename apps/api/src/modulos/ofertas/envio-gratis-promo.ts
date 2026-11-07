import { calcularEnvioFinal, ReglaEnvioGratis } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { leerReglaEnvioGratis } from '../zonas/envio-gratis';
import { canalOferta, estaVigente, formatearHora } from './ofertas.util';

/** Promoción ENVIO_GRATIS vigente para un canal. `compraMinima` null = sin mínimo. */
export interface PromoEnvioGratis {
  id: string;
  nombre: string;
  /** Hora de fin (HH:mm). Exclusiva, igual que en el resto de ofertas (18:00 ya no aplica). */
  hasta: string | null;
  compraMinima: number | null;
}

/** Alias histórico: el canal de oferta de un pedido (ver ofertas.util). */
export const canalOfertaParaEnvio = canalOferta;

/** Primera promo ENVIO_GRATIS (por orden) activa y vigente ahora para el canal. Sin filtrar compra mínima. */
export async function promoEnvioGratisVigente(
  prisma: PrismaService,
  canalPedido: string,
  ahora: Date = new Date(),
): Promise<PromoEnvioGratis | null> {
  const canal = canalOfertaParaEnvio(canalPedido);
  const candidatas = await prisma.oferta.findMany({
    where: { tipo: 'ENVIO_GRATIS', activo: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  const oferta = candidatas.find((o) => estaVigente(o, canal, ahora));
  if (!oferta) return null;
  return {
    id: oferta.id.toString(),
    nombre: oferta.nombre,
    hasta: formatearHora(oferta.hora_hasta),
    compraMinima: oferta.compra_minima !== null ? Number(oferta.compra_minima) : null,
  };
}

/** Igual que el descuento automático: aplica si el subtotal alcanza la compra mínima (si la tiene). */
export function aplicaPromoEnvio(promo: PromoEnvioGratis | null, subtotal: number): boolean {
  if (!promo) return false;
  return promo.compraMinima === null || subtotal >= promo.compraMinima;
}

/**
 * Envío que paga el cliente por un delivery: 0 con la promo vigente; si no, la regla de envío gratis
 * por monto y la tarifa de la zona. La usan el pedido, ubicar y la consulta (así dan el mismo monto).
 */
export async function calcularEnvioDelivery(
  prisma: PrismaService,
  params: { subtotal: number; tarifaZona: number; canal: string; ahora?: Date; envioGratisCupon?: boolean },
): Promise<{ envio: number; promo: PromoEnvioGratis | null }> {
  // Cupón de envío gratis canjeado en el pedido: gana sobre la promo y sobre el monto (se cuenta su uso aparte)
  if (params.envioGratisCupon) return { envio: 0, promo: null };
  const promo = await promoEnvioGratisVigente(prisma, params.canal, params.ahora);
  if (aplicaPromoEnvio(promo, params.subtotal)) return { envio: 0, promo };
  const regla: ReglaEnvioGratis = await leerReglaEnvioGratis(prisma);
  return { envio: calcularEnvioFinal(params.subtotal, params.tarifaZona, regla), promo: null };
}

/** Una promo de envío no lleva descuento, lleva/paga ni productos: se guardan vacíos aunque lleguen. */
export const CAMPOS_BENEFICIO_ENVIO = {
  lleva: null,
  paga: null,
  alcance_categoria_id: null,
  alcance_producto_id: null,
  descuento_tipo: null,
  descuento_valor: null,
} as const;
