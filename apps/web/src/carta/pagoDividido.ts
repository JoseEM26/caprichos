import type { MetodoPago } from './tipos';

export interface PlanCarta {
  medio: MetodoPago;
  monto: number;
}

const DIGITALES: MetodoPago[] = ['YAPE', 'PLIN', 'TRANSFERENCIA'];
const cent = (n: number) => Math.round(n * 100);

/**
 * Pago dividido de la carta: dos medios; el primero lleva el monto escrito y el segundo, lo que falta.
 * Devuelve el plan (igual que pago.plan del API) o el mensaje de error.
 */
export function armarPlanCarta(
  medio1: MetodoPago,
  monto1Texto: string,
  medio2: MetodoPago | null,
  aCobrar: number,
): { plan: PlanCarta[]; error: null } | { plan: null; error: string } {
  if (!medio2) return { plan: null, error: 'Elige el segundo medio de pago' };
  if (medio2 === medio1) return { plan: null, error: 'Elige dos medios distintos' };
  const monto1 = Number(monto1Texto);
  if (!monto1Texto.trim() || !Number.isFinite(monto1) || monto1 <= 0 || Math.abs(monto1 * 100 - cent(monto1)) > 1e-6) {
    return { plan: null, error: 'Escribe cuánto pagas con el primer medio (hasta 2 decimales)' };
  }
  if (cent(monto1) >= cent(aCobrar)) {
    return { plan: null, error: `El primer monto debe ser menor a S/ ${aCobrar.toFixed(2)}` };
  }
  return { plan: [{ medio: medio1, monto: monto1 }, { medio: medio2, monto: (cent(aCobrar) - cent(monto1)) / 100 }], error: null };
}

/** Medio principal, igual que el servidor: el digital de mayor monto, o el de mayor monto. */
export function medioPrincipalCarta(plan: PlanCarta[]): MetodoPago {
  const dig = plan.filter((f) => DIGITALES.includes(f.medio));
  return [...(dig.length ? dig : plan)].sort((a, b) => b.monto - a.monto)[0].medio;
}

/** Parte que se paga por medios digitales (la que se yapea y lleva captura). */
export const montoDigitalCarta = (plan: PlanCarta[]): number =>
  plan.filter((f) => DIGITALES.includes(f.medio)).reduce((a, f) => a + cent(f.monto), 0) / 100;
