import { BadRequestException, NotFoundException } from '@nestjs/common';
import { cuponEnHorario, generarCodigoCuponUnico } from './ofertas.util';
import { MATRIZ } from '../acceso/permisos';
import { rolesDelUsuario } from '../acceso/roles-usuario';

/**
 * Cupón «Lo da el mozo o cajero» (modo ASIGNADO_PERSONAL): cada vez que el personal lo da se crea un código único de un solo uso
 * en cupon_emitido (pedido_origen_id = el pedido, otorgado_por = quien lo dio). Cualquiera puede canjearlo: el canje usa el
 * mismo camino que los códigos impresos (UNICO_COMPROBANTE). El tope_usos del cupón limita cuántos se pueden DAR.
 */
export const MODO_ASIGNADO = 'ASIGNADO_PERSONAL';

interface Deps {
  prisma: any;
  auditoria: { registrar: (r: any) => Promise<void> };
}

const vista = (e: any) => ({
  id: String(e.id),
  cuponId: String(e.cupon_id),
  codigo: e.codigo as string,
  codigoBase: e.cupon?.codigo_base as string | undefined,
  descripcion: (e.cupon?.descripcion ?? null) as string | null,
  venceEn: e.vence_en ? (e.vence_en as Date).toISOString() : null,
  estado: e.estado as string,
});

/** Cuántos se han dado de cada cupón (los anulados por error no cuentan). */
async function dadosPorCupon(prisma: any, ids: bigint[]): Promise<Map<string, number>> {
  const filas: { cupon_id: bigint; _count: { _all: number } }[] = ids.length
    ? await prisma.cuponEmitido.groupBy({ by: ['cupon_id'], where: { cupon_id: { in: ids }, estado: { not: 'ANULADO' } }, _count: { _all: true } })
    : [];
  return new Map(filas.map((f) => [String(f.cupon_id), f._count._all]));
}

/** El cupón dado a un pedido (máximo uno, no anulado). */
function cuponDadoDelPedido(prisma: any, pedidoId: bigint) {
  return prisma.cuponEmitido.findFirst({
    where: { pedido_origen_id: pedidoId, estado: { not: 'ANULADO' }, cupon: { modo: MODO_ASIGNADO } },
    include: { cupon: true },
    orderBy: { id: 'desc' },
  });
}

/** Alcance del cupón para el ticket y la lista: «Solo <producto>», «Solo <categoría>» o «Toda la carta». */
export function alcanceCupon(c: { producto?: { nombre?: string } | null; categoria?: { nombre?: string } | null }): string {
  if (c.producto?.nombre) return `Solo ${c.producto.nombre}`;
  if (c.categoria?.nombre) return `Solo ${c.categoria.nombre}`;
  return 'Toda la carta';
}

export async function cuponesParaDar(prisma: any, pedidoId?: string, ahora = new Date()) {
  const cupones: any[] = await prisma.cupon.findMany({
    where: { modo: MODO_ASIGNADO, activo: true },
    include: { producto: true, categoria: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  const dados = await dadosPorCupon(prisma, cupones.map((c) => c.id));
  const disponibles = cupones
    .filter((c) => cuponEnHorario(c, ahora))
    .map((c) => ({
      id: String(c.id),
      codigoBase: c.codigo_base as string,
      descripcion: (c.descripcion ?? null) as string | null,
      descuentoTipo: c.descuento_tipo as string,
      descuentoValor: Number(c.descuento_valor),
      diasValidez: (c.dias_validez ?? 15) as number,
      alcance: alcanceCupon(c),
      quedan: c.tope_usos != null ? Math.max(0, c.tope_usos - (dados.get(String(c.id)) ?? 0)) : null,
    }))
    .filter((c) => c.quedan !== 0);
  const dado = pedidoId && /^\d+$/.test(pedidoId) ? await cuponDadoDelPedido(prisma, BigInt(pedidoId)) : null;
  return { cupones: disponibles, dado: dado ? vista(dado) : null };
}

export async function darCupon({ prisma, auditoria }: Deps, cuponId: string, pedidoId: string, partyId?: bigint | string | null, ahora = new Date()) {
  if (!/^\d+$/.test(String(pedidoId)) || !/^\d+$/.test(String(cuponId))) {
    throw new NotFoundException({ codigo: 'CUPON_NO_ENCONTRADO', mensaje: 'No se encontró el cupón o el pedido' });
  }
  const pedido = await prisma.pedido.findUnique({ where: { id: BigInt(pedidoId) }, select: { id: true, estado: true } });
  if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'No se encontró el pedido' });
  if (pedido.estado === 'ANULADO' || pedido.estado === 'RECHAZADO') {
    throw new BadRequestException({ codigo: 'PEDIDO_ANULADO', mensaje: 'No se puede dar un cupón a un pedido anulado' });
  }
  // Un cupón por pedido: si ya tiene uno, se devuelve el mismo
  const yaDado = await cuponDadoDelPedido(prisma, pedido.id);
  if (yaDado) return { ...vista(yaDado), yaExistia: true };

  const cupon = await prisma.cupon.findUnique({ where: { id: BigInt(cuponId) } });
  if (!cupon) throw new NotFoundException({ codigo: 'CUPON_NO_ENCONTRADO', mensaje: 'No se encontró el cupón' });
  if (cupon.modo !== MODO_ASIGNADO) {
    throw new BadRequestException({ codigo: 'CUPON_NO_ASIGNABLE', mensaje: 'Este cupón no es de los que da el mozo o cajero' });
  }
  if (!cupon.activo || !cuponEnHorario(cupon, ahora)) {
    throw new BadRequestException({ codigo: 'CUPON_INACTIVO', mensaje: 'Este cupón no está disponible hoy' });
  }
  if (cupon.tope_usos != null) {
    const dados = (await dadosPorCupon(prisma, [cupon.id])).get(String(cupon.id)) ?? 0;
    if (dados >= cupon.tope_usos) {
      throw new BadRequestException({ codigo: 'CUPON_AGOTADO', mensaje: 'Ya se dieron todos los cupones de este tipo' });
    }
  }

  const venceEn = new Date(ahora.getTime() + (cupon.dias_validez || 15) * 86_400_000);
  const creado = await prisma.cuponEmitido.create({
    data: {
      cupon_id: cupon.id,
      codigo: generarCodigoCuponUnico(cupon.codigo_base),
      pedido_origen_id: pedido.id,
      vence_en: venceEn,
      estado: 'VIGENTE',
      otorgado_por: partyId != null ? BigInt(partyId) : null,
    },
    include: { cupon: true },
  });
  await auditoria.registrar({
    categoria: 'CAMBIO',
    modulo: 'cupones',
    accion: 'dar',
    entidad: 'cupon_emitido',
    entidadId: creado.id,
    despues: { cuponId: String(cupon.id), codigo: creado.codigo, pedidoId: String(pedido.id) },
    partyId: partyId ?? undefined,
  });
  return { ...vista(creado), yaExistia: false };
}

/** Quien puede dar un cupón «Lo da el personal» (mismo permiso cupones/dar que el botón del detalle). */
export function puedeDarCupon(usuario: { rol: string; roles?: string[] } | undefined): boolean {
  return rolesDelUsuario(usuario).some((r) => (MATRIZ[r] ?? []).includes('cupones/dar'));
}

/** Quita un cupón dado por error: lo anula, solo si nadie lo canjeó. */
export async function quitarCuponDado({ prisma, auditoria }: Deps, emitidoId: string, partyId?: bigint | string | null) {
  const e = /^\d+$/.test(String(emitidoId)) ? await prisma.cuponEmitido.findUnique({ where: { id: BigInt(emitidoId) }, include: { cupon: true } }) : null;
  if (!e || e.cupon?.modo !== MODO_ASIGNADO) {
    throw new NotFoundException({ codigo: 'CUPON_EMITIDO_NO_ENCONTRADO', mensaje: 'No se encontró ese cupón dado' });
  }
  if (e.estado === 'CANJEADO') {
    throw new BadRequestException({ codigo: 'CUPON_YA_CANJEADO', mensaje: 'Ese cupón ya fue canjeado, no se puede quitar' });
  }
  if (e.estado === 'ANULADO') return { ...vista(e), quitado: true };
  const anulado = await prisma.cuponEmitido.update({
    where: { id: e.id },
    data: { estado: 'ANULADO', motivo_anulacion: 'Quitado: se dio por error', anulado_en: new Date(), anulado_por: partyId != null ? BigInt(partyId) : null },
    include: { cupon: true },
  });
  await auditoria.registrar({
    categoria: 'CAMBIO',
    modulo: 'cupones',
    accion: 'quitar_dado',
    entidad: 'cupon_emitido',
    entidadId: e.id,
    despues: { codigo: e.codigo, pedidoId: e.pedido_origen_id != null ? String(e.pedido_origen_id) : null },
    partyId: partyId ?? undefined,
  });
  return { ...vista(anulado), quitado: true };
}
