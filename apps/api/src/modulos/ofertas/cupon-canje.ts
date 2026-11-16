import { NotFoundException } from '@nestjs/common';
import { celularEnmascarado } from './cupon-usos';

/**
 * Canje de cupones en Caja y mozo: revisar (solo consulta, no consume nada) y reglas comunes con el canje.
 */
export type CanalCanje = 'CAJA' | 'MOZO';
export const canalDeCanje = (c?: string | null): CanalCanje => (c === 'MOZO' ? 'MOZO' : 'CAJA');

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Motivo (español simple) por el que el pedido no admite un cupón; null si lo admite. */
export function motivoPedidoNoAdmiteCupon(p: { estado?: string | null; cupon_id?: unknown; puntos_canjeados?: unknown }): string | null {
  if (p.estado === 'ANULADO' || p.estado === 'RECHAZADO') return 'El pedido está anulado: no se le puede aplicar un cupón';
  if (p.cupon_id != null) return 'Este pedido ya tiene un cupón aplicado';
  if (Number(p.puntos_canjeados ?? 0) > 0) return 'No se pueden usar puntos y un cupón en el mismo pedido';
  return null;
}

/** Motivo por el que el cupón ya validado no sirve aquí (canal o envío gratis); null si sirve. */
export function motivoCuponNoAplica(c: { canales?: string[]; tipo?: string }, canal: CanalCanje): string | null {
  if (c.canales && c.canales.length > 0 && !c.canales.includes(canal)) {
    return `Este cupón no vale en ${canal === 'MOZO' ? 'mozo' : 'caja'}`;
  }
  if (c.tipo === 'ENVIO_GRATIS') return 'Este cupón es de envío gratis: se aplica al crear un pedido de delivery, no aquí';
  return null;
}

/** Líneas del pedido con la forma que espera la validación de cupones (alcance por producto o categoría). */
export const lineasParaCupon = (pedido: { lineas?: any[] }) =>
  (pedido.lineas ?? []).map((l) => ({
    productoId: l.producto_id != null ? String(l.producto_id) : '',
    categoriaId: l.producto?.categoria_id != null ? String(l.producto.categoria_id) : undefined,
    cantidad: Number(l.cantidad ?? 1),
    subtotal: Number(l.subtotal ?? 0),
  }));

export const PEDIDO_PARA_CUPON = {
  lineas: { select: { producto_id: true, cantidad: true, subtotal: true, producto: { select: { categoria_id: true } } } },
};

interface Deps {
  prisma: any;
  /** validarCuponInterno del servicio: lanza con `mensaje` si el cupón no sirve para estos datos. */
  validar: (dto: any) => Promise<any>;
  partyCliente: (pedido: any) => bigint | null;
}

const mensajeDe = (e: any): string => {
  const r = typeof e?.getResponse === 'function' ? e.getResponse() : null;
  return (r && typeof r === 'object' && (r as any).mensaje) || e?.message || 'Este cupón no se puede aplicar';
};

const ESTADO_TEXTO: Record<string, string> = { CANJEADO: 'Este cupón ya fue canjeado', ANULADO: 'Este cupón fue anulado', VENCIDO: 'Este cupón está vencido' };

/** Detalles del cupón y si se puede aplicar a ESTE pedido. No consume ni escribe nada. */
export async function revisarCupon({ prisma, validar, partyCliente }: Deps, codigoCrudo: string, pedidoId: string | number | null | undefined, canalCrudo?: string, ahora = new Date()) {
  const canal = canalDeCanje(canalCrudo);
  const codigo = String(codigoCrudo ?? '').replace(/\s+/g, '').toUpperCase();
  if (!codigo) throw new NotFoundException({ codigo: 'CUPON_INVALIDO', mensaje: 'Escribe el código del cupón' });
  // Sin pedido (botón global): solo detalles y estado del cupón; el descuento se calcula al elegir el pedido
  const sinPedido = pedidoId == null || String(pedidoId).trim() === '';
  if (!sinPedido && !/^\d+$/.test(String(pedidoId))) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'No se encontró el pedido' });
  const pedido = sinPedido ? null : await prisma.pedido.findUnique({ where: { id: BigInt(String(pedidoId)) }, include: PEDIDO_PARA_CUPON });
  if (!sinPedido && !pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'No se encontró el pedido' });

  const emitido = await prisma.cuponEmitido.findUnique({
    where: { codigo },
    include: { cupon: { include: { categoria: true, producto: true } }, pedidoOrigen: { select: { codigo: true, cliente_telefono: true } }, pedidoCanje: { select: { codigo: true } } },
  });
  const cupon = emitido?.cupon ?? (await prisma.cupon.findUnique({ where: { codigo_base: codigo }, include: { categoria: true, producto: true } }));
  if (!cupon) return { codigo, existe: false, aplicable: false, motivo: 'El código no existe. Revisa que esté bien escrito', cupon: null };

  const vencido = !!emitido && (emitido.estado === 'VENCIDO' || (emitido.estado === 'VIGENTE' && emitido.vence_en && emitido.vence_en < ahora));
  const estado: string = emitido ? (vencido ? 'VENCIDO' : emitido.estado) : cupon.activo ? 'VIGENTE' : 'INACTIVO';

  // Motivo: primero lo del pedido, luego lo del cupón (estado, horario, mínimo, alcance) y al final el canal
  let motivo: string | null = pedido ? motivoPedidoNoAdmiteCupon(pedido) : null;
  let descuento: number | null = null;
  let validacion: any = null;
  if (!pedido) {
    if (emitido && ESTADO_TEXTO[estado]) motivo = ESTADO_TEXTO[estado];
    else if (estado === 'INACTIVO') motivo = 'Este cupón no se encuentra activo';
    else motivo = motivoCuponNoAplica({ canales: cupon.canales, tipo: cupon.descuento_tipo }, canal);
  } else if (!motivo) {
    try {
      validacion = await validar({ codigo, subtotal: Number(pedido.subtotal), lineas: lineasParaCupon(pedido), clientePartyId: partyCliente(pedido) });
      descuento = Number(validacion.cupon.descuentoCalculado);
      motivo = motivoCuponNoAplica(validacion.cupon, canal);
      if (motivo) descuento = null;
    } catch (e) {
      motivo = (emitido && ESTADO_TEXTO[estado]) || mensajeDe(e);
    }
  }
  if (!motivo && !emitido && cupon.modo !== 'COMPARTIDO') motivo = 'Este código no es un cupón canjeable';

  const ids = [emitido?.otorgado_por, emitido?.canjeado_por].filter((x): x is bigint => x != null);
  const personas: any[] = ids.length ? await prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } }) : [];
  const nombre = (id: bigint | null | undefined) => {
    const p = id == null ? null : personas.find((x) => String(x.party_id) === String(id));
    return id == null ? null : p ? `${p.nombres} ${p.apellidos ?? ''}`.trim() : 'Trabajador';
  };
  const nuevoTotal = pedido && descuento != null ? Math.max(0, r2(Number(pedido.subtotal) - descuento + (Number(pedido.envio) || 0))) : null;

  return {
    codigo,
    existe: true,
    aplicable: motivo == null,
    motivo,
    estado,
    descuento,
    nuevoTotal,
    totalActual: pedido ? Number(pedido.total) : null,
    cupon: {
      codigoBase: cupon.codigo_base as string,
      descripcion: (cupon.descripcion ?? null) as string | null,
      modo: cupon.modo as string,
      tipo: cupon.descuento_tipo as string,
      valor: Number(cupon.descuento_valor),
      compraMinima: cupon.compra_minima != null ? Number(cupon.compra_minima) : null,
      alcance: cupon.categoria?.nombre ? `Solo categoría ${cupon.categoria.nombre}` : cupon.producto?.nombre ? `Solo ${cupon.producto.nombre}` : null,
      canales: (cupon.canales ?? []) as string[],
      venceEn: emitido?.vence_en ? (emitido.vence_en as Date).toISOString() : cupon.fecha_hasta ? (cupon.fecha_hasta as Date).toISOString().slice(0, 10) : null,
    },
    dado: emitido
      ? {
          por: nombre(emitido.otorgado_por),
          en: (emitido.creado_en as Date).toISOString(),
          pedido: emitido.pedidoOrigen?.codigo ?? null,
          cliente: celularEnmascarado(emitido.pedidoOrigen?.cliente_telefono),
        }
      : null,
    canje:
      emitido?.estado === 'CANJEADO'
        ? { en: emitido.canjeado_en ? (emitido.canjeado_en as Date).toISOString() : null, por: nombre(emitido.canjeado_por), canal: emitido.canjeado_canal ?? null, pedido: emitido.pedidoCanje?.codigo ?? null }
        : null,
  };
}
