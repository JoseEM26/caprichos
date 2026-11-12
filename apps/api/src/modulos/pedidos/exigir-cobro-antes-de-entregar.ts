import { montoACobrar } from '../../comun/monto-a-cobrar';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { tieneRol } from '../acceso/roles-usuario';
import { efectivoDelPedido } from './pago-plan.service';

/** Largo del motivo con el que el administrador entrega sin cobrar (mismo rango que forzar sin Cocina). */
export const MOTIVO_SIN_COBRO_MIN = 10;
export const MOTIVO_SIN_COBRO_MAX = 300;

export interface PedidoParaCobro {
  modalidad: string;
  pago_estado: string | null;
  pago_metodo?: string | null;
  es_personal?: boolean | null;
  total: unknown;
  /** Parte del total a crédito del personal (delivery): no se cobra al contado */
  monto_credito?: unknown;
  planPago?: Array<{ medio: string; monto: unknown }> | null;
}

/**
 * Criterio único (puro). Un pedido NO pasa a ENTREGADO ni sale a reparto sin estar PAGADO cuando es:
 *  - PARA LLEVAR o RECOGER, o
 *  - DELIVERY sin efectivo contra entrega (Yape, Plin, transferencia, tarjeta o sin medio).
 * Quedan libres: pedidos del personal, MESA y COMER_LOCAL (se cobra al final) y el DELIVERY con efectivo por cobrar en la puerta
 * o con tarjeta (POS) por cobrar en la puerta (renglón EFECTIVO/TARJETA del plan, o ese medio sin plan): ese efectivo lo rinde el repartidor.
 * COORDINADO cuenta como no cobrado (falta validar el voucher o liquidar).
 */
export function pedidoDebeEstarCobrado(p: PedidoParaCobro): boolean {
  if (p.pago_estado === 'PAGADO') return false;
  // Pedido del personal: se carga a su crédito/planilla, se cobra al final.
  if (p.es_personal) return false;
  // Crédito del personal + delivery: si no queda envío por cobrar (gratis o aún por confirmar), no hay cobro pendiente
  if (Number(p.monto_credito ?? 0) > 0 && montoACobrar(p) <= 0) return false;
  if (p.modalidad === 'LLEVAR' || p.modalidad === 'RECOGER') return true;
  if (p.modalidad !== 'DELIVERY') return false;
  const plan = (p.planPago ?? []).map((f) => ({ medio: f.medio, monto: Number(f.monto) }));
  // Efectivo y tarjeta (POS en la puerta) se cobran contra entrega: los rinde el repartidor.
  const contraEntrega = plan.some((f) => f.medio === 'TARJETA' && f.monto > 0) || p.pago_metodo === 'TARJETA';
  return !contraEntrega && efectivoDelPedido(plan, p.pago_metodo, montoACobrar(p)) <= 0;
}

/** Igual que el criterio puro, pero carga el plan de pago del delivery si hace falta. */
export async function requiereCobroAntesDeEntregar(
  prisma: PrismaService,
  pedido: PedidoParaCobro & { id: bigint },
): Promise<boolean> {
  if (pedido.pago_estado === 'PAGADO' || pedido.modalidad !== 'DELIVERY') return pedidoDebeEstarCobrado(pedido);
  const planPago =
    pedido.planPago ?? (await prisma.pedidoPagoPlan.findMany({ where: { pedido_id: pedido.id }, select: { medio: true, monto: true } }));
  return pedidoDebeEstarCobrado({ ...pedido, planPago });
}

/**
 * Regla única para pasar a ENTREGADO o a la salida del delivery. Sin cobro pendiente devuelve false.
 * Con cobro pendiente:
 *  - sin `forzar`: 409 COBRO_PENDIENTE con mensaje claro y `puedeForzar` (solo el ADMIN);
 *  - con `forzar`: solo el ADMIN (403 si no), con motivo de MOTIVO_SIN_COBRO_MIN a _MAX (400 si no),
 *    y devuelve true para que quien llama deje la auditoría PEDIDO_FORZAR_SIN_COBRO. El pedido sigue «Falta cobrar».
 */
export async function exigirCobroAntesDeEntregar(
  prisma: PrismaService,
  pedido: PedidoParaCobro & { id: bigint },
  usuario: { rol: string; roles?: string[] },
  opciones: { forzar?: boolean; motivo?: string } = {},
): Promise<boolean> {
  if (!(await requiereCobroAntesDeEntregar(prisma, pedido))) return false;
  const esAdmin = tieneRol(usuario, 'ADMIN');

  if (!opciones.forzar) {
    throw new ConflictException({
      codigo: 'COBRO_PENDIENTE',
      mensaje:
        'Este pedido aún no está cobrado. Cóbralo en Caja antes de entregarlo.' +
        (esAdmin ? ' Como administrador puedes entregarlo sin cobrar indicando un motivo.' : ''),
      puedeForzar: esAdmin,
    });
  }
  if (!esAdmin) {
    throw new ForbiddenException({
      codigo: 'FORZAR_SOLO_ADMIN',
      mensaje: 'Solo el administrador puede entregar sin cobrar. Cobra el pedido en Caja.',
    });
  }
  const motivo = (opciones.motivo ?? '').trim();
  if (motivo.length < MOTIVO_SIN_COBRO_MIN || motivo.length > MOTIVO_SIN_COBRO_MAX) {
    throw new BadRequestException({
      codigo: 'MOTIVO_REQUERIDO',
      mensaje: `Escribe el motivo (entre ${MOTIVO_SIN_COBRO_MIN} y ${MOTIVO_SIN_COBRO_MAX} caracteres) para entregar sin cobrar.`,
    });
  }
  return true;
}
