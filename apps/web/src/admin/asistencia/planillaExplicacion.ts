import { DetallePlanilla, LineaDesglose, RecurrenteFueraApi, soles } from './planillaApi';

const GRUPOS_DESCUENTO = ['TARDANZA', 'CONSUMO', 'DESCUENTO', 'PRESTAMO', 'RECURRENTE'];
const PERIODO_CORTO: Record<string, string> = { SEMANAL: 'por semana', MENSUAL: 'por mes', UNICA: 'una sola vez' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const suma = (xs: LineaDesglose[]) => r2(xs.reduce((a, x) => a + x.monto, 0));

/** Partes que restan del bruto (tardanza, consumos, descuentos, préstamos y personalizados). Sin desglose del servidor (período pagado antes), arma las partes con los totales. */
export function lineasDescuento(d: DetallePlanilla): LineaDesglose[] {
  if (d.desglose) return d.desglose.filter((x) => GRUPOS_DESCUENTO.includes(x.grupo) && x.monto > 0);
  const r = d.resultado;
  const partes: LineaDesglose[] = [
    { grupo: 'TARDANZA', concepto: 'Tardanza', monto: r.penalidadTardanza ?? 0 },
    { grupo: 'CONSUMO', concepto: 'Consumos del personal', monto: r.consumosCobrados },
    { grupo: 'DESCUENTO', concepto: 'Descuentos, cuotas de préstamo y servicios', monto: r.descuentos },
  ];
  return partes.filter((x) => x.monto > 0);
}

/** Adelantos del período (se restan después de los descuentos). */
export function lineasAdelanto(d: DetallePlanilla): LineaDesglose[] {
  if (d.desglose) return d.desglose.filter((x) => x.grupo === 'ADELANTO' && x.monto > 0);
  return d.resultado.adelantos > 0 ? [{ grupo: 'ADELANTO', concepto: 'Adelantos', monto: d.resultado.adelantos }] : [];
}

/** Cifras del cálculo en palabras: bruto, bonos, descuentos, adelantos y neto (las mismas de la planilla). */
export function resumenCalculo(d: DetallePlanilla) {
  const r = d.resultado;
  const descuentos = lineasDescuento(d);
  const adelantos = lineasAdelanto(d);
  const bonos = r.adicional ?? 0;
  return { bruto: r.ganado, bonos, descuentos, adelantos, totalDescuentos: suma(descuentos), totalAdelantos: suma(adelantos), totalRestas: r2(suma(descuentos) + suma(adelantos)), neto: r.neto };
}

/** Fórmula en una línea con los números reales: «S/ 348.96 − S/ 4.80 = S/ 344.16». */
export function formulaNeto(d: DetallePlanilla): string {
  const s = resumenCalculo(d);
  const partes = [soles(s.bruto)];
  if (s.bonos) partes.push(`+ ${soles(s.bonos)}`);
  if (s.totalRestas) partes.push(`− ${soles(s.totalRestas)}`);
  return `${partes.join(' ')} = ${soles(s.neto)}`;
}

/** Si el neto es negativo, la razón concreta: qué se descuenta y qué concepto pesa más. */
export function motivoNeto(d: DetallePlanilla): string | null {
  const s = resumenCalculo(d);
  if (s.neto >= 0) return null;
  const mayor = [...s.descuentos, ...s.adelantos].sort((a, b) => b.monto - a.monto)[0];
  return `El neto es negativo: lo que se descuenta (${soles(s.totalRestas)}) supera lo ganado (${soles(s.bruto + s.bonos)}).${mayor ? ` Lo que más pesa: ${mayor.concepto.toLowerCase()} (${soles(mayor.monto)}).` : ''}`;
}

/** «16/11/2026» desde una fecha AAAA-MM-DD. */
export const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${m}/${y}`;
};
const diaMes = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};

/** Línea para un descuento personalizado que NO cae en el período visto. */
export function textoFuera(x: RecurrenteFueraApi): string {
  const valor = x.valorTipo === 'PORCENTAJE' ? `${x.valor} % del sueldo` : soles(x.valor);
  const cada = PERIODO_CORTO[x.periodicidad] ?? '';
  const cuando = x.estado === 'EMPIEZA'
    ? `empieza el ${fechaCorta(x.desde)}${x.proximoPeriodo ? `: entra en la planilla del ${diaMes(x.proximoPeriodo.desde)} al ${diaMes(x.proximoPeriodo.hasta ?? x.proximoPeriodo.desde)}` : ''}`
    : `terminó el ${fechaCorta(x.hasta ?? x.desde)}: ya no se aplica en esta planilla`;
  return `${x.nombre} — ${valor}${cada ? ` ${cada}` : ''} · ${cuando}`;
}
