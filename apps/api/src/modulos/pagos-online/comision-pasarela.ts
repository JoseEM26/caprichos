import { enPesos } from '../caja/caja.calculo';

/** Comisión de la pasarela, en soles. La asume el local: nunca se suma al total del pedido ni se muestra al cliente. */
export interface ComisionDetalle {
  fijo: number | null;
  variable: number | null;
  igv: number | null;
  neto_depositado: number;
  fuente: 'CULQI' | 'ESTIMADA';
}
export interface ComisionCobro {
  /** Comisión total con IGV */
  total: number;
  detalle: ComisionDetalle;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Lee la comisión REAL del objeto cargo de Culqi (céntimos): total_fee, total_fee_taxes (IGV), transfer_amount (lo que
 * deposita) y fee_details.{fixed_fee,variable_fee}.total. Con transfer_amount el total es monto - transfer_amount
 * (no depende de si total_fee incluye o no el IGV). null si Culqi no mandó nada utilizable.
 */
export function comisionDeCargoCulqi(json: any, montoCentimos: number): ComisionCobro | null {
  if (!json || typeof json !== 'object') return null;
  const transfer = num(json.transfer_amount);
  const fee = num(json.total_fee);
  const igv = num(json.total_fee_taxes);
  let totalC: number | null = null;
  if (transfer !== null && transfer > 0 && transfer <= montoCentimos) totalC = montoCentimos - transfer;
  else if (fee !== null) totalC = fee + (igv ?? 0);
  if (totalC === null || totalC <= 0) return null;
  const fijo = num(json.fee_details?.fixed_fee?.total);
  const variable = num(json.fee_details?.variable_fee?.total);
  return {
    total: enPesos(totalC),
    detalle: {
      fijo: fijo === null ? null : enPesos(fijo),
      variable: variable === null ? null : enPesos(variable),
      igv: igv === null ? null : enPesos(igv),
      neto_depositado: enPesos(montoCentimos - totalC),
      fuente: 'CULQI',
    },
  };
}

export interface TarifaCulqi {
  pct: number;
  fijo: number;
}

/**
 * Estimada con la tarifa que el ADMIN configura (pct y fijo ya con el IGV incluido: es lo que Culqi cobra). Sin porcentaje configurado: null
 * («por confirmar»). El fijo sin configurar cuenta 0 solo cuando el porcentaje sí está.
 */
export function comisionEstimada(montoSoles: number, tarifa: TarifaCulqi | null): ComisionCobro | null {
  if (!tarifa) return null;
  const variable = Math.round(montoSoles * tarifa.pct) / 100;
  const base = variable + tarifa.fijo;
  const total = Math.round(base * 100) / 100;
  return { total, detalle: { fijo: tarifa.fijo, variable, igv: 0, neto_depositado: Math.round((montoSoles - total) * 100) / 100, fuente: 'ESTIMADA' } };
}

/** Lee la tarifa del medio (TARJETA | YAPE) de la tabla parametro. */
export async function leerTarifaCulqi(prisma: any, medio: string): Promise<TarifaCulqi | null> {
  const m = medio.toLowerCase() === 'yape' ? 'yape' : 'tarjeta';
  const leer = async (k: string) => {
    const p = await prisma.parametro.findUnique({ where: { clave: `culqi_comision_${m}_${k}` } }).catch(() => null);
    return num(p?.valor);
  };
  const pct = await leer('pct');
  if (pct === null) return null;
  return { pct, fijo: (await leer('fijo')) ?? 0 };
}
