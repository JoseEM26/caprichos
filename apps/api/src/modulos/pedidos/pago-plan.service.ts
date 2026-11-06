import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** TARJETA (POS al recibir o en caja) no lleva voucher: va en el plan pero no en MEDIOS_DIGITALES_PLAN. */
export const MEDIOS_PLAN = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] as const;
export const MEDIOS_DIGITALES_PLAN = ['YAPE', 'PLIN', 'TRANSFERENCIA'] as const;

export interface PlanPagoItem {
  medio: string;
  monto: number;
}

const TOLERANCIA = 0.01;

/**
 * Monto contra el que se compara un voucher: la parte digital del plan si el pedido lo tiene,
 * si no, el total (comportamiento de siempre). null = plan sin parte digital, no se compara.
 */
export function montoEsperadoVoucher(planPago: PlanPagoItem[] | null | undefined, total: number | null): number | null {
  if (!planPago || planPago.length === 0) return total;
  const digital = montoDigitalDePlan(planPago);
  return digital > 0 ? digital : null;
}

/** Parte digital del plan (la que lleva voucher). Función pura: sirve sin inyección. */
export function montoDigitalDePlan(plan: PlanPagoItem[]): number {
  const suma = plan
    .filter((f) => (MEDIOS_DIGITALES_PLAN as readonly string[]).includes(f.medio))
    .reduce((acc, f) => acc + Number(f.monto), 0);
  return Math.round(suma * 100) / 100;
}

/** Monto del renglón del plan para un medio digital (lo que se compara contra SU captura). */
export function montoDeMedioDigital(plan: PlanPagoItem[], medio: string): number {
  return Math.round(plan.filter((f) => f.medio === medio).reduce((acc, f) => acc + Number(f.monto), 0) * 100) / 100;
}

/**
 * Medios digitales que llevan captura, uno por medio. Con plan: sus renglones digitales. Sin plan:
 * el medio del pedido (pago_metodo) por el total, si es digital. Función pura.
 */
export function mediosDigitalesDelPedido(
  plan: PlanPagoItem[] | null | undefined,
  pagoMetodo: string | null | undefined,
  total: number,
): PlanPagoItem[] {
  if (plan && plan.length > 0) {
    return plan
      .filter((f) => (MEDIOS_DIGITALES_PLAN as readonly string[]).includes(f.medio))
      .map((f) => ({ medio: f.medio, monto: Math.round(Number(f.monto) * 100) / 100 }));
  }
  const m = String(pagoMetodo ?? '').toUpperCase();
  return (MEDIOS_DIGITALES_PLAN as readonly string[]).includes(m) ? [{ medio: m, monto: total }] : [];
}

/**
 * Efectivo que el repartidor debe cobrar en la puerta: el renglón EFECTIVO del plan si el pedido tiene plan;
 * sin plan, el total cuando el medio del pedido es efectivo. Función pura.
 */
export function efectivoDelPedido(
  planPago: PlanPagoItem[] | null | undefined,
  pagoMetodo: string | null | undefined,
  total: number,
): number {
  if (planPago && planPago.length > 0) {
    return Math.round(planPago.filter((f) => f.medio === 'EFECTIVO').reduce((acc, f) => acc + Number(f.monto), 0) * 100) / 100;
  }
  return String(pagoMetodo ?? '').toUpperCase() === 'EFECTIVO' ? total : 0;
}

/**
 * Pago dividido: plan de pago declarado al hacer el pedido (un renglón por medio).
 * Reutilizable por carta virtual, WhatsApp y el mozo. Sin dependencias.
 */
@Injectable()
export class PagoPlanService {
  /**
   * Valida el plan contra el total del pedido. Devuelve los renglones normalizados
   * o null si no vino plan (flujo de siempre, con pago.metodo).
   */
  validar(plan: PlanPagoItem[] | null | undefined, total: number): PlanPagoItem[] | null {
    if (!plan || plan.length === 0) return null;

    const vistos = new Set<string>();
    const filas = plan.map((fila) => {
      const medio = String(fila.medio ?? '').toUpperCase();
      if (!(MEDIOS_PLAN as readonly string[]).includes(medio)) {
        throw new BadRequestException({
          codigo: 'PLAN_PAGO_MEDIO_INVALIDO',
          mensaje: `Medio de pago no válido en el plan: ${fila.medio}`,
        });
      }
      if (vistos.has(medio)) {
        throw new BadRequestException({
          codigo: 'PLAN_PAGO_MEDIO_REPETIDO',
          mensaje: `El medio ${medio} aparece más de una vez en el plan de pago`,
        });
      }
      vistos.add(medio);
      const monto = Math.round(Number(fila.monto) * 100) / 100;
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new BadRequestException({
          codigo: 'PLAN_PAGO_MONTO_INVALIDO',
          mensaje: 'Cada monto del plan de pago debe ser mayor a 0',
        });
      }
      return { medio, monto };
    });

    const suma = Math.round(filas.reduce((acc, f) => acc + f.monto, 0) * 100) / 100;
    if (Math.abs(suma - total) > TOLERANCIA) {
      throw new BadRequestException({
        codigo: 'PLAN_PAGO_NO_CUADRA',
        mensaje: `La suma del plan de pago (S/ ${suma.toFixed(2)}) debe ser igual al total (S/ ${total.toFixed(2)})`,
      });
    }

    return filas.map((f, orden) => ({ ...f, orden }) as PlanPagoItem & { orden: number });
  }

  /** Inserta los renglones del plan dentro de la transacción del pedido. */
  async guardar(tx: Prisma.TransactionClient, pedidoId: bigint, plan: PlanPagoItem[]): Promise<void> {
    await tx.pedidoPagoPlan.createMany({
      data: plan.map((f, orden) => ({ pedido_id: pedidoId, medio: f.medio, monto: new Prisma.Decimal(f.monto), orden })),
    });
  }

  /** Medio que se guarda como pago_metodo / pago_preferido: el digital (o el de mayor monto). */
  pagoPrincipal(plan: PlanPagoItem[]): string {
    const digitales = plan.filter((f) => (MEDIOS_DIGITALES_PLAN as readonly string[]).includes(f.medio));
    const candidatos = digitales.length > 0 ? digitales : plan;
    return [...candidatos].sort((a, b) => b.monto - a.monto)[0].medio;
  }

  montoDigital(plan: PlanPagoItem[]): number {
    return montoDigitalDePlan(plan);
  }

  montoEfectivo(plan: PlanPagoItem[]): number {
    return this.suma(plan.filter((f) => f.medio === 'EFECTIVO'));
  }

  private suma(filas: PlanPagoItem[]): number {
    return Math.round(filas.reduce((acc, f) => acc + Number(f.monto), 0) * 100) / 100;
  }
}
