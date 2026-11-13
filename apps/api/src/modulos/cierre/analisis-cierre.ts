/**
 * «¿Por qué no cuadra?»: detectores puros (sin base de datos) sobre los datos de una caja.
 * Solo lectura y siempre en tono de «posible causa»: nunca acusan a una persona ni muestran nombres ni documentos de clientes.
 */
import { aCentimos, enPesos } from '../caja';

export const MEDIOS_DIGITALES = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];
const TOPE_PEDIDOS = 50;
const TOLERANCIA = 10; // 0.10 en céntimos

export interface PagoA { medio: string; monto: number; propina: number }
export interface CobroA {
  pedidoCodigo: string;
  pedidoCreadoEn: Date;
  en: Date;
  anuladoEn: Date | null;
  pagos: PagoA[];
}
export interface AnuladoPagadoA { codigo: string; pagoEstado: string | null; pagoMetodo: string | null; total: number; cobros: Array<{ anulado: boolean; pagos: PagoA[] }> }
export interface MovimientoA { tipo: string; monto: number; motivo: string; anulado: boolean }
export interface DatosAnalisis {
  medios: Array<{ medio: string; sistema: number; visto: number | null; diferencia: number | null }>;
  /** Total de billetes y monedas guardado en el conteo (null si no hay detalle) */
  conteoTotal: number | null;
  cobros: CobroA[];
  anuladosPagados: AnuladoPagadoA[];
  movimientos: MovimientoA[];
  delivery: { pendientes: Array<{ codigo: string; monto: number }>; liquidaciones: Array<{ esperado: number; entregado: number }>; repartidoresPorLiquidar: number };
  credito: Array<{ codigo: string; monto: number }>;
  inicioDia: Date;
}

export interface PedidoHallazgo { codigo: string; monto: number; detalle: string }
export interface Patron { codigo: string; titulo: string; explicacion: string; montoRelacionado?: number; pedidos?: PedidoHallazgo[] }
export interface Sugerencia { medio: string; diferencia: number; coincideCon: string[]; texto: string }

const NOMBRE: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };
const nombre = (m: string) => NOMBRE[m] ?? m;
const soles = (c: number) => `S/ ${(Math.abs(c) / 100).toFixed(2)}`;
const medioDe = (p: PagoA) => (p.medio || '').trim().toUpperCase();
const centimosPago = (p: PagoA) => aCentimos(p.monto) + aCentimos(p.propina);
export const horaLima = (d: Date) => new Date(d.getTime() - 5 * 3600_000).toISOString().slice(11, 16);

/** Subconjuntos de hasta 3 elementos cuya suma (en céntimos) cae a ±0.10 del objetivo. Determinista y con tope. */
export function combinaciones(items: Array<{ etiqueta: string; c: number }>, objetivo: number, maxResultados = 5) {
  const lista = items.slice(0, 30);
  const out: string[][] = [];
  const ir = (desde: number, quedan: number, suma: number, acum: string[]) => {
    if (out.length >= maxResultados) return;
    if (acum.length > 0 && Math.abs(suma - objetivo) <= TOLERANCIA) out.push([...acum]);
    if (quedan === 0) return;
    for (let i = desde; i < lista.length; i++) ir(i + 1, quedan - 1, suma + lista[i].c, [...acum, lista[i].etiqueta]);
  };
  ir(0, 3, 0, []);
  return out;
}

export const AYUDA_GENERAL = [
  { medio: 'EFECTIVO', sobrante: ['Un cobro registrado como Yape o tarjeta que se pagó en efectivo', 'Un egreso pagado con dinero de otro bolsillo', 'Vuelto que no se entregó', 'Una venta o propina que no se registró'], faltante: ['Un cobro registrado como efectivo que se pagó por Yape o tarjeta', 'Un gasto sin registrar como egreso', 'Vuelto de más', 'Efectivo de un repartidor que aún no liquida', 'Error al contar billetes o monedas'] },
  { medio: 'YAPE / PLIN', sobrante: ['Pago de un pedido anulado que no se devolvió', 'Un cobro anulado que sí había entrado', 'Propina que no se registró', 'Movimientos de la app que no son ventas'], faltante: ['Un cobro registrado como Yape que se pagó en efectivo', 'Devolución hecha por la app y no registrada', 'Pago que llegó al día siguiente'] },
  { medio: 'TRANSFERENCIA', sobrante: ['Pago de un pedido anulado', 'Depósito que no es una venta'], faltante: ['Transferencia que aún no se acredita', 'Cobro registrado que se pagó en otro medio'] },
  { medio: 'TARJETA (POS)', sobrante: ['Lote del POS de otro día', 'Propinas del POS que no se registraron'], faltante: ['Venta pasada por el POS en otro lote', 'Cobro anulado en el sistema pero no en el POS'] },
];

export function analizarCaja(d: DatosAnalisis) {
  const difs = d.medios.filter((m) => m.diferencia !== null).map((m) => ({ medio: m.medio, c: aCentimos(m.diferencia) }));
  const totalC = difs.reduce((a, x) => a + x.c, 0);
  const ef = difs.find((x) => x.medio === 'EFECTIVO')?.c ?? null;
  const digitales = difs.filter((x) => x.medio !== 'EFECTIVO');
  const dig = digitales.reduce((a, x) => a + x.c, 0);
  const patrones: Patron[] = [];
  // Candidatos para las sugerencias: traen su medio (o ninguno si valen para cualquiera)
  const candidatos: Array<{ etiqueta: string; c: number; medio?: string }> = [];

  // 1) Mala clasificación de medio
  if (ef !== null && digitales.length && Math.abs(ef) >= 100 && Math.abs(dig) >= 100 && Math.sign(ef) !== Math.sign(dig) && Math.abs(ef + dig) <= Math.max(100, Math.abs(ef) * 0.1)) {
    patrones.push({
      codigo: 'MALA_CLASIFICACION',
      titulo: 'Posible cobro registrado en un medio y pagado por otro',
      explicacion: `El efectivo ${ef < 0 ? 'faltó' : 'sobró'} ${soles(ef)} y los medios digitales ${dig < 0 ? 'faltaron' : 'sobraron'} ${soles(dig)}: casi se compensan (${soles(ef + dig)} de diferencia total). Posible causa: un cobro se registró en un medio y el dinero entró por otro (por ejemplo, se cobró como efectivo pero el cliente pagó por Yape, o al revés).`,
      montoRelacionado: enPesos(Math.abs(ef)),
    });
  }

  // 2) Dinero sin cobro registrado: sobrante en todos los medios con movimiento
  const activos = d.medios.filter((m) => m.diferencia !== null && (m.sistema > 0 || (m.visto ?? 0) > 0));
  if (activos.length >= 2 && activos.every((m) => (m.diferencia ?? 0) > 0.005)) {
    patrones.push({
      codigo: 'DINERO_SIN_COBRO',
      titulo: 'Entró más dinero del que está registrado',
      explicacion: 'Sobra en todos los medios. Posibles causas: una venta hecha fuera del sistema, el pago de un pedido anulado, una devolución que no se hizo o una propina que no se registró.',
      montoRelacionado: enPesos(totalC),
    });
  }

  // 3) Pedidos anulados con pago
  const anul: PedidoHallazgo[] = [];
  for (const p of d.anuladosPagados) {
    const pagos = p.cobros.flatMap((c) => c.pagos);
    if (!(p.pagoEstado === 'PAGADO' || pagos.some((x) => MEDIOS_DIGITALES.includes(medioDe(x))))) continue;
    const medio = (pagos[0] ? medioDe(pagos[0]) : (p.pagoMetodo || '').toUpperCase()) || 'SIN MEDIO';
    const cent = pagos.length ? pagos.reduce((a, x) => a + centimosPago(x), 0) : aCentimos(p.total);
    anul.push({ codigo: p.codigo, monto: enPesos(cent), detalle: `${nombre(medio)} · pedido anulado${p.pagoEstado === 'PAGADO' ? ' pero con pago en estado PAGADO' : ' con cobro registrado'}` });
    candidatos.push({ etiqueta: `el pedido anulado ${p.codigo} (${nombre(medio)} ${soles(cent)})`, c: cent, medio });
  }
  if (anul.length) {
    patrones.push({
      codigo: 'ANULADOS_CON_PAGO',
      titulo: 'Pedidos anulados que tenían pago',
      explicacion: 'Si el cliente ya había pagado y el pedido se anuló, el dinero queda en el medio pero no en las ventas: posible causa de sobrante en ese medio (falta devolverlo o registrar la devolución).',
      montoRelacionado: enPesos(anul.reduce((a, x) => a + aCentimos(x.monto), 0)),
      pedidos: anul.slice(0, TOPE_PEDIDOS),
    });
  }

  // 4) Cobros anulados del día
  const anulados = d.cobros.filter((c) => c.anuladoEn);
  if (anulados.length) {
    const ped = anulados.slice(0, TOPE_PEDIDOS).map((c) => ({
      codigo: c.pedidoCodigo,
      monto: enPesos(c.pagos.reduce((a, x) => a + centimosPago(x), 0)),
      detalle: `${c.pagos.map((x) => nombre(medioDe(x))).join(' + ') || 'sin medio'} · anulado a las ${horaLima(c.anuladoEn!)}`,
    }));
    for (const c of anulados) for (const p of c.pagos) {
      candidatos.push({ etiqueta: `el cobro anulado de ${c.pedidoCodigo} (${nombre(medioDe(p))} ${soles(centimosPago(p))})`, c: centimosPago(p), medio: medioDe(p) });
    }
    patrones.push({
      codigo: 'COBROS_ANULADOS',
      titulo: 'Cobros anulados ese día',
      explicacion: 'El sistema descontó estos cobros. Si el dinero ya había entrado, queda como sobrante en ese medio. Posible causa sobre todo si el pedido se cobró otra vez por otro monto.',
      montoRelacionado: enPesos(ped.reduce((a, x) => a + aCentimos(x.monto), 0)),
      pedidos: ped,
    });
  }

  // 5) Propinas por medio (incluidas en el «sistema» de cada medio)
  const prop = new Map<string, number>();
  for (const c of d.cobros) if (!c.anuladoEn) for (const p of c.pagos) if (aCentimos(p.propina) > 0) prop.set(medioDe(p), (prop.get(medioDe(p)) ?? 0) + aCentimos(p.propina));
  if (prop.size) {
    patrones.push({
      codigo: 'PROPINAS',
      titulo: 'Propinas incluidas en cada medio',
      explicacion: `El «sistema» de cada medio ya suma las propinas (${[...prop.entries()].map(([m, c]) => `${nombre(m)} ${soles(c)}`).join(', ')}). El total de la app de Yape o del POS también las incluye, pero la lista de pedidos no: no las cuentes dos veces ni las olvides.`,
      montoRelacionado: enPesos([...prop.values()].reduce((a, x) => a + x, 0)),
    });
  }

  // 6) Movimientos de caja
  if (d.movimientos.length) {
    const vig = d.movimientos.filter((m) => !m.anulado);
    for (const m of vig) candidatos.push({ etiqueta: `${m.tipo === 'INGRESO' ? 'el ingreso' : 'el egreso'} «${m.motivo}» (${soles(aCentimos(m.monto))})`, c: aCentimos(m.monto), medio: 'EFECTIVO' });
    patrones.push({
      codigo: 'MOVIMIENTOS',
      titulo: 'Ingresos y egresos de caja',
      explicacion: `Hay ${vig.length} movimiento(s) vigente(s) y ${d.movimientos.length - vig.length} anulado(s). Un egreso pagado con dinero de otro bolsillo (no de la gaveta) deja sobrante en efectivo; uno que no se registró deja faltante.`,
      montoRelacionado: enPesos(vig.reduce((a, m) => a + (m.tipo === 'EGRESO' ? -1 : 1) * aCentimos(m.monto), 0)),
      pedidos: d.movimientos.slice(0, TOPE_PEDIDOS).map((m) => ({ codigo: m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso', monto: m.monto, detalle: `${m.motivo}${m.anulado ? ' (anulado)' : ''}` })),
    });
  }

  // 7) Delivery
  const dl = d.delivery;
  const difLiq = dl.liquidaciones.filter((l) => aCentimos(l.entregado) !== aCentimos(l.esperado));
  if (dl.pendientes.length || difLiq.length || dl.repartidoresPorLiquidar > 0) {
    for (const p of dl.pendientes) candidatos.push({ etiqueta: `el efectivo contra entrega de ${p.codigo} (${soles(aCentimos(p.monto))})`, c: aCentimos(p.monto), medio: 'EFECTIVO' });
    patrones.push({
      codigo: 'DELIVERY',
      titulo: 'Delivery: efectivo contra entrega',
      explicacion: `${dl.repartidoresPorLiquidar > 0 ? `${dl.repartidoresPorLiquidar} repartidor(es) por liquidar. ` : ''}${difLiq.length ? `${difLiq.length} liquidación(es) entregaron un monto distinto al esperado. ` : ''}El efectivo que trae el repartidor solo suma a la caja cuando se liquida: posible causa de faltante hasta entonces.`,
      montoRelacionado: enPesos(dl.pendientes.reduce((a, p) => a + aCentimos(p.monto), 0)),
      pedidos: dl.pendientes.slice(0, TOPE_PEDIDOS).map((p) => ({ codigo: p.codigo, monto: p.monto, detalle: 'Efectivo contra entrega' })),
    });
  }

  // 8) Crédito del personal
  if (d.credito.length) {
    patrones.push({
      codigo: 'CREDITO_PERSONAL',
      titulo: 'Pedidos con crédito del personal',
      explicacion: 'El crédito del personal no es dinero: no debe estar en el efectivo. Está aquí para que lo descartes como causa.',
      montoRelacionado: enPesos(d.credito.reduce((a, p) => a + aCentimos(p.monto), 0)),
      pedidos: d.credito.slice(0, TOPE_PEDIDOS).map((p) => ({ codigo: p.codigo, monto: p.monto, detalle: 'Crédito del personal' })),
    });
  }

  // 9) Cortes de hora
  const cortes = d.cobros.filter((c) => !c.anuladoEn && c.pedidoCreadoEn < d.inicioDia);
  if (cortes.length) {
    patrones.push({
      codigo: 'CORTE_DE_HORA',
      titulo: 'Cobros de pedidos de otro día',
      explicacion: 'Estos pedidos se hicieron antes del día de esta caja y se cobraron en ella. Posible causa si la app de Yape o el POS los cuentan en otro día (corte de hora).',
      pedidos: cortes.slice(0, TOPE_PEDIDOS).map((c) => ({
        codigo: c.pedidoCodigo,
        monto: enPesos(c.pagos.reduce((a, x) => a + centimosPago(x), 0)),
        detalle: `${c.pagos.map((x) => nombre(medioDe(x))).join(' + ')} · cobrado a las ${horaLima(c.en)}`,
      })),
    });
  }

  // 10) Vuelto o redondeo
  if (ef !== null && ef !== 0 && Math.abs(ef) <= 100) {
    patrones.push({
      codigo: 'VUELTO_REDONDEO',
      titulo: 'Diferencia pequeña en efectivo',
      explicacion: `Es solo ${soles(ef)}. Posible causa: monedas, vuelto mal dado o redondeo.`,
      montoRelacionado: enPesos(Math.abs(ef)),
    });
  }

  // 11) Conteo
  const efFila = d.medios.find((m) => m.medio === 'EFECTIVO');
  if (d.conteoTotal !== null && efFila?.visto != null && aCentimos(d.conteoTotal) !== aCentimos(efFila.visto)) {
    patrones.push({
      codigo: 'CONTEO_DISTINTO',
      titulo: 'El conteo por billetes no coincide con el efectivo visto',
      explicacion: `Los billetes y monedas suman ${soles(aCentimos(d.conteoTotal))} pero el efectivo visto del cierre es ${soles(aCentimos(efFila.visto))}. Posible causa: un error al anotar el conteo.`,
      montoRelacionado: enPesos(Math.abs(aCentimos(d.conteoTotal) - aCentimos(efFila.visto))),
    });
  }

  // Sugerencias: combinaciones de hasta 3 montos listados que igualan la diferencia de un medio
  const sugerencias: Sugerencia[] = [];
  for (const x of difs) {
    if (x.c === 0) continue;
    const items = candidatos.filter((k) => !k.medio || k.medio === x.medio).map((k) => ({ etiqueta: k.etiqueta, c: k.c }));
    for (const combo of combinaciones(items, Math.abs(x.c), 3)) {
      sugerencias.push({ medio: x.medio, diferencia: enPesos(x.c), coincideCon: combo, texto: `La diferencia de ${nombre(x.medio)} (${soles(x.c)}) coincide con ${combo.join(' + ')}. Es una posible causa; revísalo.` });
    }
  }
  // Marca los pedidos anulados que, solos, igualan la diferencia de su medio
  for (const p of patrones.find((x) => x.codigo === 'ANULADOS_CON_PAGO')?.pedidos ?? []) {
    if (sugerencias.some((g) => g.coincideCon.length === 1 && g.coincideCon[0].includes(p.codigo))) p.detalle += ' · coincide con la diferencia';
  }

  return { medios: d.medios, totalDiferencia: enPesos(totalC), patrones, sugerencias, ayudaGeneral: AYUDA_GENERAL };
}
