import { montoACobrar } from '../../comun/monto-a-cobrar';
/**
 * Propinas (función pura, sin BD). La propina es opcional, va aparte de la venta y se suma por mes
 * (día calendario de Lima) solo de lo cobrado. Lima no tiene horario de verano: UTC-5 fijo.
 */

export const TOPE_PROPINA_DEFECTO = 200;

/** Canal del pedido → clave del interruptor propina_activa (carta, bot, mozo y caja). */
export function claveCanalPropina(canal: string | null | undefined): 'carta' | 'bot' | 'mozo' | 'caja' | null {
  if (canal === 'CARTA') return 'carta';
  if (canal === 'MOZO') return 'mozo';
  if (canal === 'CAJA') return 'caja';
  if (canal === 'WHATSAPP' || canal === 'BOT') return 'bot';
  return null;
}

/**
 * Interruptor: propina_activa = { carta, bot, mozo, caja } (booleanos). ENCENDIDA POR DEFECTO: un canal sin valor
 * (o sin configuración) ofrece propina; solo un `false` explícito la apaga. Un canal desconocido nunca la ofrece.
 */
export function propinaActivaParaCanal(activa: unknown, canal: string | null | undefined): boolean {
  const clave = claveCanalPropina(canal);
  if (!clave) return false;
  if (!activa || typeof activa !== 'object') return true;
  return (activa as Record<string, unknown>)[clave] !== false;
}

/** Tope en soles: número positivo; si no es válido, el de por defecto. */
export function topePropina(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : TOPE_PROPINA_DEFECTO;
}

export type ResultadoPropina = { valido: true; monto: number } | { valido: false; motivo: string };

/**
 * Monto de propina que escribe el cliente: vacío o 0 = sin propina; número con máximo 2 decimales,
 * entre 0 y el tope. Acepta texto con coma o «S/» (lo que escribe alguien en WhatsApp).
 */
export function normalizarPropina(valor: unknown, tope: number): ResultadoPropina {
  if (valor === undefined || valor === null || valor === '') return { valido: true, monto: 0 };
  let n: number;
  if (typeof valor === 'number') {
    n = valor;
  } else if (typeof valor === 'string') {
    const limpio = valor.replace(/s\s*\/\.?/gi, '').replace(',', '.').trim();
    if (limpio === '') return { valido: true, monto: 0 };
    if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return { valido: false, motivo: 'formato' };
    n = Number(limpio);
  } else {
    return { valido: false, motivo: 'formato' };
  }
  if (!Number.isFinite(n) || n < 0) return { valido: false, motivo: 'formato' };
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return { valido: false, motivo: 'decimales' };
  const monto = Math.round(n * 100) / 100;
  if (monto > tope) return { valido: false, motivo: 'tope' };
  return { valido: true, monto };
}

/**
 * Reparte la propina entre los renglones de un cobro, en PROPORCIÓN a lo cobrado por medio, en
 * céntimos (método del resto mayor). La suma es exacta. Es el criterio del cobro: no hay medio de
 * propina aparte. Devuelve la propina de cada renglón, en el mismo orden.
 */
export function repartirPropina(pagos: Array<{ monto: number }>, propina: number): number[] {
  const totalC = pagos.reduce((acc, p) => acc + Math.round(p.monto * 100), 0);
  const propinaC = Math.round(propina * 100);
  if (propinaC <= 0 || totalC <= 0 || pagos.length === 0) return pagos.map(() => 0);
  const cuotas = pagos.map((p) => (Math.round(p.monto * 100) * propinaC) / totalC);
  const bases = cuotas.map((c) => Math.floor(c));
  let resto = propinaC - bases.reduce((a, b) => a + b, 0);
  const orden = cuotas
    .map((c, i) => ({ i, r: c - Math.floor(c) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of orden) {
    if (resto <= 0) break;
    bases[i] += 1;
    resto -= 1;
  }
  return bases.map((c) => c / 100);
}

/** Día calendario de Lima (YYYY-MM-DD) de un instante. */
export function diaLima(fecha: Date): string {
  return new Date(fecha.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Rango [inicio, fin) en UTC de un mes calendario de Lima. */
export function rangoMesLima(anio: number, mes: number): { inicio: Date; fin: Date } {
  return {
    inicio: new Date(Date.UTC(anio, mes - 1, 1, 5)),
    fin: new Date(Date.UTC(anio, mes, 1, 5)),
  };
}

export interface FilaPropina {
  en: Date;
  medio: string;
  canal: string;
  propina: number;
}

const DIGITALES = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Acumulado a partir de filas de propina: cobros (positivas) y DEVOLUCIONES (negativas, el día en que se
 * devuelve y por el medio original del cobro). La propina devuelta sale del día de la devolución: así el
 * acumulado y el cierre de caja no divergen. Las filas llegan ya filtradas por cobro vigente.
 */
export function resumirPropinas(filas: FilaPropina[]) {
  const porDia = new Map<string, { fecha: string; total: number; efectivo: number; digital: number }>();
  const porMedio = new Map<string, number>();
  const porCanal = new Map<string, number>();
  let total = 0;
  let efectivo = 0;
  let digital = 0;
  for (const f of filas) {
    if (!f.propina) continue;
    const medio = String(f.medio || '').toUpperCase();
    const esEfectivo = medio === 'EFECTIVO';
    const esDigital = DIGITALES.includes(medio);
    const dia = diaLima(f.en);
    const d = porDia.get(dia) ?? { fecha: dia, total: 0, efectivo: 0, digital: 0 };
    d.total = redondear(d.total + f.propina);
    if (esEfectivo) d.efectivo = redondear(d.efectivo + f.propina);
    else if (esDigital) d.digital = redondear(d.digital + f.propina);
    porDia.set(dia, d);
    porMedio.set(medio, redondear((porMedio.get(medio) ?? 0) + f.propina));
    porCanal.set(f.canal, redondear((porCanal.get(f.canal) ?? 0) + f.propina));
    total = redondear(total + f.propina);
    if (esEfectivo) efectivo = redondear(efectivo + f.propina);
    else if (esDigital) digital = redondear(digital + f.propina);
  }
  return {
    total,
    efectivo,
    digital,
    porDia: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    porMedio: [...porMedio.entries()].map(([medio, monto]) => ({ medio, monto })).sort((a, b) => b.monto - a.monto),
    porCanal: [...porCanal.entries()].map(([canal, monto]) => ({ canal, monto })).sort((a, b) => b.monto - a.monto),
  };
}

/** Lo que el cliente paga por el pedido: total de la venta + propina (lo usan plan, vouchers y efectivo). */
export function totalCobrable(pedido: { total: unknown; monto_credito?: unknown; propina?: unknown }): number {
  // montoACobrar: con crédito del personal + delivery solo se cobra el envío
  return Math.round((montoACobrar(pedido) + Number(pedido.propina ?? 0)) * 100) / 100;
}
