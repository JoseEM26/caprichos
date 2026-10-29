import type { PrismaService } from '../../comun/prisma/prisma.service';
import { partyClienteDelPedido } from './cliente-del-pedido';
import { ExplicacionPuntos, explicarPuntosPedido } from './explicar-puntos-pedido';

/** Lee de la base lo que `explicarPuntosPedido` necesita y devuelve la explicación por id de pedido. */
export async function explicarPedidosPorId(
  prisma: PrismaService,
  ids: bigint[],
): Promise<Map<string, ExplicacionPuntos>> {
  const salida = new Map<string, ExplicacionPuntos>();
  if (ids.length === 0) return salida;
  const [pedidos, param] = await Promise.all([
    prisma.pedido.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, canal: true, party_id: true, cliente_party_id: true, estado: true, pago_estado: true,
        cupon_id: true, cupon_emitido_id: true, puntos_ganados: true, puntos_canjeados: true, descuento_detalle: true,
        lineas: {
          select: {
            id: true, producto_id: true, subtotal: true, precio_unit: true, cantidad: true, oferta_id: true,
            linea_combo_id: true, producto: { select: { no_suma_beneficios: true } },
          },
        },
      },
    }),
    prisma.parametro.findUnique({ where: { clave: 'puntos_porcentaje' } }).catch(() => null),
  ]);
  const porcentaje = param && param.valor !== null && param.valor !== undefined ? Number(param.valor) : 5;
  const partys = [...new Set(pedidos.map((p) => partyClienteDelPedido(p)).filter((x): x is bigint => !!x))];
  const roles = partys.length
    ? await prisma.partyRole.findMany({ where: { party_id: { in: partys }, rol: 'CLIENTE', hasta: null }, select: { party_id: true } })
    : [];
  const conRol = new Set(roles.map((r) => String(r.party_id)));
  for (const p of pedidos) {
    const cli = partyClienteDelPedido(p);
    salida.set(String(p.id), explicarPuntosPedido(p as any, { porcentaje, tieneRolCliente: !!cli && conRol.has(String(cli)) }));
  }
  return salida;
}
