import { PrismaService } from '../../../comun/prisma/prisma.service';
import { OfertasService } from '../../ofertas/ofertas.service';
import { calcularEnvioDelivery } from '../../ofertas/envio-gratis-promo';
import { EstadoCarritoPedido } from './flujos/pedido/tipos-pedido';
import { VistaPreviaPedidoBot } from './tipos-conversacion';

const r2 = (n: number) => Math.round(n * 100) / 100;

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
  if (pedido.modalidad === 'DELIVERY') {
    if (tarifaZona === null || tarifaZona === undefined) {
      envio = null;
    } else {
      envio = (await calcularEnvioDelivery(deps.prisma, { subtotal, tarifaZona: Number(tarifaZona), canal: 'WHATSAPP' })).envio;
    }
  }

  return {
    subtotal,
    descuento,
    descuentoNombre,
    envio,
    envioGratis: envio === 0 && pedido.modalidad === 'DELIVERY',
  };
}
