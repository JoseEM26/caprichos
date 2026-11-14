import type { MetodoPago } from './tipos';

export interface PlanCarta {
  medio: MetodoPago;
  monto: number;
}

const DIGITALES: MetodoPago[] = ['YAPE', 'PLIN', 'TRANSFERENCIA'];
const cent = (n: number) => Math.round(n * 100);

/** Renglón en edición: el monto va como texto mientras el cliente escribe. */
export interface FilaDiv {
  medio: MetodoPago;
  monto: string;
}

export const MAX_MEDIOS_CARTA = 3;

/** Lo que cubre el último renglón: total menos lo escrito en los demás (puede salir <= 0). */
export function montoUltimo(filas: FilaDiv[], aCobrar: number): number {
  const otros = filas.slice(0, -1).reduce((a, f) => a + (cent(Number(f.monto)) || 0), 0);
  return (cent(aCobrar) - otros) / 100;
}

/** Filas tal como se ven: el último monto se autocompleta con lo que falta. */
export function filasVisibles(filas: FilaDiv[], aCobrar: number): FilaDiv[] {
  if (filas.length < 2) return filas;
  return filas.map((f, i) => (i === filas.length - 1 ? { ...f, monto: montoUltimo(filas, aCobrar).toFixed(2) } : f));
}

/** «Falta S/ X» / «Sobra S/ X» / null si cuadra, sobre lo escrito en los renglones que no son el último. */
export function estadoDiv(filas: FilaDiv[], aCobrar: number): { tipo: 'falta' | 'sobra' | 'cuadra'; monto: number } {
  const ultimo = montoUltimo(filas, aCobrar);
  const vacios = filas.slice(0, -1).some((f) => !f.monto.trim());
  if (ultimo < 0) return { tipo: 'sobra', monto: -ultimo };
  if (ultimo === 0 || vacios) return { tipo: ultimo === 0 ? 'cuadra' : 'falta', monto: ultimo };
  return { tipo: 'cuadra', monto: 0 };
}

/**
 * Pago dividido de la carta (2 o 3 medios): los renglones escritos llevan su monto y el último, lo que falta.
 * Devuelve el plan (igual que pago.plan del API) o el mensaje de error. `permitidos` = medios que ofrece el canal.
 */
export function armarPlanCarta(
  filas: FilaDiv[],
  aCobrar: number,
  permitidos?: MetodoPago[],
): { plan: PlanCarta[]; error: null } | { plan: null; error: string } {
  if (filas.length < 2) return { plan: null, error: 'Elige al menos 2 medios, o paga con uno solo' };
  if (filas.length > MAX_MEDIOS_CARTA) return { plan: null, error: `Máximo ${MAX_MEDIOS_CARTA} medios de pago` };
  const medios = filas.map((f) => f.medio);
  if (new Set(medios).size !== medios.length) return { plan: null, error: 'Elige medios distintos: cada uno solo puede ir una vez' };
  const fuera = medios.find((m) => permitidos && !permitidos.includes(m));
  if (fuera) return { plan: null, error: `${fuera} no está disponible para este pedido` };
  for (const f of filas.slice(0, -1)) {
    const n = Number(f.monto);
    if (!f.monto.trim() || !Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - cent(n)) > 1e-6) {
      return { plan: null, error: `Escribe cuánto pagas con ${f.medio} (mayor a 0, hasta 2 decimales)` };
    }
  }
  const ultimo = montoUltimo(filas, aCobrar);
  if (ultimo < 0) return { plan: null, error: `Sobra S/ ${(-ultimo).toFixed(2)}: baja los montos` };
  if (ultimo === 0) return { plan: null, error: `${filas[filas.length - 1].medio} queda en S/ 0.00: quítalo o baja los otros montos` };
  const plan = filas.map((f, i) => ({ medio: f.medio, monto: i === filas.length - 1 ? ultimo : Number(f.monto) }));
  return { plan, error: null };
}

/** Medio principal, igual que el servidor: el digital de mayor monto, o el de mayor monto. */
export function medioPrincipalCarta(plan: PlanCarta[]): MetodoPago {
  const dig = plan.filter((f) => DIGITALES.includes(f.medio));
  return [...(dig.length ? dig : plan)].sort((a, b) => b.monto - a.monto)[0].medio;
}

/** Parte que se paga por medios digitales (la que se yapea y lleva captura). */
export const montoDigitalCarta = (plan: PlanCarta[]): number =>
  plan.filter((f) => DIGITALES.includes(f.medio)).reduce((a, f) => a + cent(f.monto), 0) / 100;
