import { PrismaService } from '../../../comun/prisma/prisma.service';
import { OfertasService } from '../../ofertas/ofertas.service';
import { aplicaPromoEnvio, calcularEnvioDelivery, promoEnvioGratisVigente } from '../../ofertas/envio-gratis-promo';
import { EstadoCarritoPedido } from './flujos/pedido/tipos-pedido';
import { VistaPreviaPedidoBot } from './tipos-conversacion';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Envío de una ubicación recibida antes de tener carrito (subtotal 0): mismas reglas del servidor que la vista previa.
 * Sin zona conocida el envío queda por calcular (null).
 */
export async function vistaPreviaUbicacionBot(
  prisma: PrismaService,
  tarifaZona: number | null | undefined,
): Promise<VistaPreviaPedidoBot> {
  const envio =
    tarifaZona === null || tarifaZona === undefined
      ? null
      : (await calcularEnvioDelivery(prisma, { subtotal: 0, tarifaZona: Number(tarifaZona), canal: 'WHATSAPP' })).envio;
  return { subtotal: 0, descuento: 0, descuentoNombre: null, envio, envioGratis: envio === 0 };
}

/**
 * Vista previa del pedido del bot con las MISMAS funciones del servidor: descuentos automáticos de la
 * promoción con casilla «Vale también por WhatsApp» (calcularDescuentosParaPedido, sin cupones) y envío
 * (calcularEnvioDelivery, con la promo de envío gratis por horario). El total del bot sale de aquí.
 * `tarifaZona` null = la zona aún no se conoce: el envío queda por calcular (sin default).
 */
export async function vistaPreviaPedidoBot(
  deps: { prisma: PrismaService; ofertasService?: OfertasService },
  pedido: EstadoCarritoPedido,
  tarifaZona: number | null | undefined,
): Promise<VistaPreviaPedidoBot | null> {
  if (!pedido.items?.length) return null;
  const subtotal = r2(pedido.items.reduce((s, i) => s + i.subtotal, 0));

  let descuento = 0;
  let descuentoNombre: string | null = null;
  if (deps.ofertasService) {
    const lineas = pedido.items.map((i) => ({
      productoId: BigInt(i.productoId),
      categoriaId: i.categoriaId ? BigInt(i.categoriaId) : null,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      precioUnitario: i.precioUnitario,
      noSumaBeneficios: i.noSumaBeneficios,
    }));
    const desglose = await deps.ofertasService.calcularDescuentosParaPedido({ subtotal, lineas, canal: 'WHATSAPP' });
    descuento = desglose.descuentoTotal;
    descuentoNombre = desglose.detalles[0]?.nombre ?? null;
  }

  let envio: number | null = 0;
  let envioPromoNombre: string | null = null;
  let envioGratisFalta: number | null = null;
  if (pedido.modalidad === 'DELIVERY') {
    // Una promo de Envío gratis vigente por WhatsApp deja el envío en 0 aunque la zona aún no se conozca
    // (ubicar el pedido después aplica la misma regla); sin promo, la tarifa de la zona o «por confirmar».
    const promo = await promoEnvioGratisVigente(deps.prisma, 'WHATSAPP');
    if (aplicaPromoEnvio(promo, subtotal)) {
      envio = 0;
      envioPromoNombre = promo!.nombre;
    } else {
      if (promo?.compraMinima != null) envioGratisFalta = r2(promo.compraMinima - subtotal);
      envio =
        tarifaZona === null || tarifaZona === undefined
          ? null
          : (await calcularEnvioDelivery(deps.prisma, { subtotal, tarifaZona: Number(tarifaZona), canal: 'WHATSAPP' })).envio;
      // La regla de envío gratis por monto también puede dejarlo en 0: ahí no hay «faltante» de la promo
      if (envio === 0) envioGratisFalta = null;
    }
  }

  return {
    subtotal,
    descuento,
    descuentoNombre,
    envio,
    envioGratis: envio === 0 && pedido.modalidad === 'DELIVERY',
    envioPromoNombre,
    envioGratisFalta,
  };
}
