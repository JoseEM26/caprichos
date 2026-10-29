/** Plan de pago (pago dividido): monto por medio. Compartido por mesa, llevar/delivery, caja y Mis pedidos. */
export type MedioPlan = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

export const MEDIOS_PLAN: ReadonlyArray<{ id: MedioPlan; nombre: string }> = [
  { id: 'EFECTIVO', nombre: 'Efectivo' },
  { id: 'YAPE', nombre: 'Yape' },
  { id: 'PLIN', nombre: 'Plin' },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia' },
];

const MEDIOS_DIGITALES: ReadonlyArray<MedioPlan> = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Fila editable: el monto va como texto mientras el mozo escribe. */
export interface FilaPlan {
  medio: MedioPlan;
  monto: string;
}

/** Renglón ya validado, tal como lo recibe el API (pago.plan). */
export interface PlanPagoItem {
  medio: MedioPlan;
  monto: number;
}

export function nombreMedio(medio: string): string {
  return MEDIOS_PLAN.find((m) => m.id === medio)?.nombre ?? medio;
}

/** Plan inicial de un solo medio por el total. */
export function planInicial(medio: MedioPlan, total: number): FilaPlan[] {
  return [{ medio, monto: total > 0 ? total.toFixed(2) : '' }];
}

/** Monto en céntimos enteros; NaN si no es un número positivo o cero válido. */
function centimos(valor: string | number): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Lo que falta (positivo) o sobra (negativo) para cubrir el total, en soles. */
export function restantePlan(total: number, filas: FilaPlan[]): number {
  const suma = filas.reduce((acc, f) => acc + (centimos(f.monto) || 0), 0);
  return (Math.round(total * 100) - suma) / 100;
}

/** Mensaje de error del plan o null si el plan es válido para el total. */
export function errorPlan(total: number, filas: FilaPlan[]): string | null {
  if (filas.length === 0) return 'Elige cómo paga';
  const medios = filas.map((f) => f.medio);
  if (new Set(medios).size !== medios.length) return 'Cada medio solo puede ir una vez';
  if (filas.some((f) => !(centimos(f.monto) > 0))) return 'Indica el monto de cada medio';
  const restante = restantePlan(total, filas);
  if (Math.abs(restante) >= 0.005) {
    return restante > 0
      ? `Falta S/ ${restante.toFixed(2)} por asignar`
      : `Sobra S/ ${(-restante).toFixed(2)}: ajusta los montos`;
  }
  return null;
}

/** Filas válidas convertidas a números para el API. */
export function aPlan(filas: FilaPlan[]): PlanPagoItem[] {
  return filas
    .filter((f) => centimos(f.monto) > 0)
    .map((f) => ({ medio: f.medio, monto: Math.round(Number(f.monto) * 100) / 100 }));
}

/** Parte digital del plan: la que lleva voucher. */
export function montoDigitalPlan(plan: Array<{ medio: string; monto: number }>): number {
  const suma = plan
    .filter((f) => (MEDIOS_DIGITALES as ReadonlyArray<string>).includes(f.medio))
    .reduce((acc, f) => acc + Number(f.monto), 0);
  return Math.round(suma * 100) / 100;
}

/** Parte en efectivo del plan (la que se paga con dinero, sin voucher). */
export function montoEfectivoPlan(plan: Array<{ medio: string; monto: number }>): number {
  return Math.round(plan.filter((f) => f.medio === 'EFECTIVO').reduce((a, f) => a + Number(f.monto), 0) * 100) / 100;
}

/** Primer medio digital del plan (el que pide voucher) o null si todo es efectivo. */
export function medioDigitalDelPlan(plan: Array<{ medio: string; monto: number }>): MedioPlan | null {
  const digital = plan.find((f) => (MEDIOS_DIGITALES as ReadonlyArray<string>).includes(f.medio));
  return digital ? (digital.medio as MedioPlan) : null;
}

/** Mismo criterio que el API: el digital como medio principal, o el de mayor monto. */
export function medioPrincipalPlan(plan: Array<{ medio: string; monto: number }>): MedioPlan {
  const digitales = plan.filter((f) => (MEDIOS_DIGITALES as ReadonlyArray<string>).includes(f.medio));
  const candidatos = digitales.length > 0 ? digitales : plan;
  return [...candidatos].sort((a, b) => b.monto - a.monto)[0].medio as MedioPlan;
}
