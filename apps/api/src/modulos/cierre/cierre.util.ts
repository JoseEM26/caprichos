import { aCentimos, enPesos } from '../caja/caja.calculo';
import { inicioDiaLimaDeFecha, sumarDiasFechaIso } from '../cocina/cocina.util';

export const DENOMINACIONES: number[] = [
  200, 100, 50, 20, 10,
  5, 2, 1, 0.5, 0.2, 0.1,
];

/**
 * Calcula la suma total en efectivo a partir del conteo por denominación.
 * Maneja claves numéricas y en texto (e.g. '0.5', '0.50', 0.5).
 */
export function calcularTotalConteo(conteo: Record<string, number> | undefined | null): number {
  if (!conteo || typeof conteo !== 'object') {
    return 0;
  }

  // Se suma en céntimos enteros para no acumular errores de redondeo de los floats.
  let totalCentimos = 0;
  for (const denom of DENOMINACIONES) {
    const k1 = denom.toString();
    const k2 = denom === 0.5 ? '0.50' : denom === 0.2 ? '0.20' : denom === 0.1 ? '0.10' : k1;
    const cant = Number(
      (conteo as any)[k1] ?? (conteo as any)[k2] ?? (conteo as any)[denom] ?? 0,
    );
    if (!isNaN(cant) && cant > 0) {
      totalCentimos += cant * Math.round(denom * 100);
    }
  }

  return totalCentimos / 100;
}

/** Medios digitales que el cierre cuadra (la clave es la del DTO y de la pantalla). */
export type ClaveDigitalCierre = 'yape' | 'plin' | 'transferencia' | 'tarjeta';

const CLAVE_DE_MEDIO_DIGITAL: Record<string, ClaveDigitalCierre> = {
  YAPE: 'yape',
  PLIN: 'plin',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
};

/**
 * Día de la caja en Lima: [inicio, fin). Es el mismo criterio que usa el cálculo de pedidos del día
 * (inicioDiaLimaDeFecha), así una devolución cae en la caja del día en que se hizo, nunca en la de otro.
 */
export function rangoDiaCaja(fecha: Date): { inicio: Date; fin: Date } {
  const fechaIso = fecha.toISOString().slice(0, 10);
  return { inicio: inicioDiaLimaDeFecha(fechaIso), fin: inicioDiaLimaDeFecha(sumarDiasFechaIso(fechaIso, 1)) };
}

/**
 * Suma, por medio digital, las devoluciones hechas dentro del día de la caja [inicio, fin). Solo cuentan
 * Yape, Plin, transferencia y tarjeta: las de efectivo ya salen como egreso de caja y no se tocan aquí.
 * Devuelve montos en soles, positivos (el cierre los resta del cobrado).
 */
export function sumarDevolucionesDigitales(
  filas: Array<{ medio: string; monto_devuelto: unknown; creado_en: Date }>,
  inicio: Date,
  fin: Date,
): Record<ClaveDigitalCierre, number> {
  const centimos: Record<ClaveDigitalCierre, number> = { yape: 0, plin: 0, transferencia: 0, tarjeta: 0 };
  for (const f of filas) {
    const clave = CLAVE_DE_MEDIO_DIGITAL[(f.medio || '').trim().toUpperCase()];
    if (!clave) continue;
    if (f.creado_en < inicio || f.creado_en >= fin) continue;
    centimos[clave] += aCentimos(f.monto_devuelto);
  }
  return {
    yape: enPesos(centimos.yape),
    plin: enPesos(centimos.plin),
    transferencia: enPesos(centimos.transferencia),
    tarjeta: enPesos(centimos.tarjeta),
  };
}

/**
 * Pedidos pagados (confirmados o entregados ese día) que no tienen ningún cobro vigente: dinero que no pasó
 * por «cobrar». Quedan fuera por diseño el crédito del personal y el total 0 (una cortesía solo baja el total).
 */
export function pagadosSinCobroDelDia(db: { pedido: { findMany: (args: any) => Promise<any[]> } }, enElDia: { gte: Date; lt: Date }) {
  return db.pedido.findMany({
    where: {
      pago_estado: 'PAGADO',
      estado: { not: 'ANULADO' },
      es_personal: false,
      total: { gt: 0 },
      cobros: { none: { anulado_en: null } },
      OR: [{ pago_coordinado_en: enElDia }, { entregado_en: enElDia }],
    },
    include: { planPago: true },
    orderBy: { id: 'asc' },
  });
}
