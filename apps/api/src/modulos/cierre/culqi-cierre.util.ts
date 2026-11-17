import { aCentimos, enPesos } from '../caja/caja.calculo';

/**
 * Pagos en línea (Culqi) dentro del cuadre de caja. Ese dinero llega a la cuenta de Culqi, NO al Yape ni al POS del
 * local: va en sus propias filas (YAPE_CULQI, TARJETA_CULQI) y nunca entra al «esperado» de Yape o tarjeta del local.
 */
export const MEDIOS_CULQI_CIERRE = ['YAPE_CULQI', 'TARJETA_CULQI'] as const;

export interface CulqiCierre {
  /** Neto del día: cobrado menos lo devuelto por Culqi ese día. */
  yape: number;
  tarjeta: number;
  cobradoYape: number;
  cobradoTarjeta: number;
  devueltoYape: number;
  devueltoTarjeta: number;
  total: number;
}

export interface OperacionCulqi {
  pedidoId: string;
  pedidoCodigo: string;
  medio: string;
  monto: number;
  en: Date;
  /** Número de operación de Culqi (id del cargo): lo que se busca en CulqiPanel. */
  operacion: string | null;
  /** COBRADO | DEVUELTO_CULQI | DEVUELTO_FUERA (devuelto por Yape/efectivo… del local) | ANULADO (cobro anulado sin devolución) */
  estado: 'COBRADO' | 'DEVUELTO_CULQI' | 'DEVUELTO_FUERA' | 'ANULADO';
  /** Medios usados en la devolución por fuera (YAPE, EFECTIVO…) */
  devueltoPor: string[];
  /** Comisión de la pasarela con IGV (la asume el local); null = por confirmar */
  comision: number | null;
  comisionDetalle: unknown;
  /** Lo que Culqi ya devolvió de este cobro (total o parcial). Culqi no devuelve la comisión. */
  devueltoCulqi: number;
  /** Hora de la última devolución hecha por Culqi (null si no hubo) */
  devueltoCulqiEn: Date | null;
}

/** Devoluciones hechas por Culqi (medio CULQI o sin medio) de un intento; el resto (Yape, efectivo… del local) no cuenta. */
function devueltoPorCulqi(lista: any[]): { monto: number; en: Date | null } {
  let centimos = 0;
  let en: Date | null = null;
  for (const d of lista) {
    if (d?.medio && String(d.medio).toUpperCase() !== 'CULQI') continue;
    centimos += Math.round(Number(d?.monto_centimos) || 0);
    const f = d?.en ? new Date(d.en) : null;
    if (f && (!en || f > en)) en = f;
  }
  return { monto: enPesos(centimos), en };
}

type Db = { pagoOnlineIntento: { findMany: (args: any) => Promise<any[]> }; cobro: { findMany: (args: any) => Promise<any[]> } };

/** Lo devuelto por Culqi dentro de [inicio, fin), por medio del intento (se lee de sus devoluciones). */
export async function devueltoCulqiDelDia(db: Pick<Db, 'pagoOnlineIntento'>, inicio: Date, fin: Date) {
  const intentos = await db.pagoOnlineIntento.findMany({
    where: { devuelto_centimos: { gt: 0 }, actualizado_en: { gte: inicio } },
    select: { medio: true, devoluciones: true },
  });
  const out = { YAPE: 0, TARJETA: 0 };
  for (const i of intentos) {
    const medio = String(i.medio ?? '').toUpperCase() as 'YAPE' | 'TARJETA';
    if (!(medio in out)) continue;
    for (const d of Array.isArray(i.devoluciones) ? (i.devoluciones as any[]) : []) {
      // Devuelta por fuera (Yape, efectivo… del local): el dinero sigue en Culqi, no baja el bloque Culqi
      if (d?.medio && String(d.medio).toUpperCase() !== 'CULQI') continue;
      const en = new Date(d?.en);
      if (en >= inicio && en < fin) out[medio] += Math.round(Number(d?.monto_centimos) || 0);
    }
  }
  return { yape: enPesos(out.YAPE), tarjeta: enPesos(out.TARJETA) };
}

/** Arma el bloque Culqi del cierre a partir de lo cobrado (calculo de caja) y lo devuelto. */
export function armarCulqiCierre(
  cobrado: { yape?: number; tarjeta?: number },
  devuelto: { yape: number; tarjeta: number },
): CulqiCierre {
  const cy = aCentimos(cobrado.yape);
  const ct = aCentimos(cobrado.tarjeta);
  const dy = aCentimos(devuelto.yape);
  const dt = aCentimos(devuelto.tarjeta);
  return {
    yape: enPesos(cy - dy),
    tarjeta: enPesos(ct - dt),
    cobradoYape: enPesos(cy),
    cobradoTarjeta: enPesos(ct),
    devueltoYape: enPesos(dy),
    devueltoTarjeta: enPesos(dt),
    total: enPesos(cy - dy + ct - dt),
  };
}

/** Operaciones Culqi de una caja: un renglón por cobro pagado por la pasarela (también el anulado: en Culqi sigue cobrado), con su nº de operación y estado. */
export async function operacionesCulqiDeCaja(db: Pick<Db, 'cobro' | 'pagoOnlineIntento'>, cajaId: bigint): Promise<OperacionCulqi[]> {
  const cobros = (
    await db.cobro.findMany({
      where: { caja_id: cajaId, pagos: { some: { origen: 'CULQI' } } },
      include: { pagos: true, pedido: { select: { codigo: true } } },
      orderBy: { id: 'asc' },
    })
  ).filter((c) => (c.pagos ?? []).some((p: any) => p.origen === 'CULQI'));
  if (cobros.length === 0) return [];
  const intentos = await db.pagoOnlineIntento.findMany({
    where: { pedido_id: { in: cobros.map((c) => c.pedido_id) }, culqi_cargo_id: { not: null } },
    select: { pedido_id: true, culqi_cargo_id: true, devoluciones: true },
    orderBy: { id: 'asc' },
  });
  const cargo = new Map<string, string>(intentos.map((i) => [String(i.pedido_id), String(i.culqi_cargo_id)]));
  const devs = new Map<string, any[]>(intentos.map((i) => [String(i.pedido_id), Array.isArray(i.devoluciones) ? (i.devoluciones as any[]) : []]));
  return cobros.flatMap((c) => {
    const lista = devs.get(String(c.pedido_id)) ?? [];
    const fuera = [...new Set(lista.filter((d) => d?.medio && String(d.medio).toUpperCase() !== 'CULQI').map((d) => String(d.medio).toUpperCase()))];
    const porCulqi = lista.some((d) => !d?.medio || String(d.medio).toUpperCase() === 'CULQI');
    const estado: OperacionCulqi['estado'] = fuera.length > 0 ? 'DEVUELTO_FUERA' : porCulqi ? 'DEVUELTO_CULQI' : c.anulado_en ? 'ANULADO' : 'COBRADO';
    return c.pagos
      .filter((p: any) => p.origen === 'CULQI')
      .map((p: any) => ({
        pedidoId: String(c.pedido_id),
        pedidoCodigo: c.pedido.codigo,
        medio: String(p.medio).toUpperCase(),
        monto: enPesos(aCentimos(p.monto) + aCentimos(p.propina)),
        en: c.en,
        operacion: cargo.get(String(c.pedido_id)) ?? null,
        estado,
        devueltoPor: fuera,
        comision: p.comision_pasarela == null ? null : Number(p.comision_pasarela),
        comisionDetalle: p.comision_detalle ?? null,
        devueltoCulqi: devueltoPorCulqi(lista).monto,
        devueltoCulqiEn: devueltoPorCulqi(lista).en,
      }));
  });
}

/**
 * Comisión de la pasarela del turno (la asume el local; NO es faltante ni entra al efectivo esperado ni al cuadre de Yape).
 * Culqi no devuelve la comisión al devolver un pago: las operaciones devueltas también cuentan como costo.
 * neto = cobrado vigente (no devuelto) menos la comisión de todas las operaciones con comisión conocida.
 */
export interface ComisionCulqiCierre {
  pagos: number;
  porConfirmar: number;
  estimadas: number;
  /** Cobrado menos lo que Culqi devolvió (parcial o total) */
  bruto: number;
  /** Lo devuelto por Culqi por su API (parcial o total) */
  devueltoCulqi: number;
  total: number;
  fijo: number;
  variable: number;
  igv: number;
  neto: number;
}

export function resumirComisionCulqi(
  ops: Array<Pick<OperacionCulqi, 'monto' | 'estado'> & { devueltoCulqi?: number; comision?: number | null; comisionDetalle?: any }>,
): ComisionCulqiCierre {
  let bruto = 0, total = 0, fijo = 0, variable = 0, igv = 0, porConfirmar = 0, estimadas = 0, devuelto = 0;
  for (const o of ops) {
    // Legado: sin el dato por operación, una DEVUELTO_CULQI se da por devuelta entera
    const devCulqi = aCentimos(o.devueltoCulqi ?? (o.estado === 'DEVUELTO_CULQI' ? o.monto : 0));
    devuelto += devCulqi;
    // Culqi deposita lo cobrado menos lo que devolvió por su propia API; lo devuelto por Yape/efectivo del local sigue en Culqi
    bruto += aCentimos(o.monto) - devCulqi;
    if (o.comision == null) { porConfirmar++; continue; }
    total += aCentimos(o.comision);
    fijo += aCentimos(o.comisionDetalle?.fijo ?? 0);
    variable += aCentimos(o.comisionDetalle?.variable ?? 0);
    igv += aCentimos(o.comisionDetalle?.igv ?? 0);
    if (o.comisionDetalle?.fuente === 'ESTIMADA') estimadas++;
  }
  return { pagos: ops.length, porConfirmar, estimadas, bruto: enPesos(bruto), devueltoCulqi: enPesos(devuelto), total: enPesos(total), fijo: enPesos(fijo), variable: enPesos(variable), igv: enPesos(igv), neto: enPesos(bruto - total) };
}

/**
 * Cobros Culqi que el cierre no pudo registrar o que quedaron por revisar. No bloquean el cierre (no tocan el efectivo):
 * salen como alerta visible para que el ADMIN los resuelva. Mira todo lo aún abierto, de cualquier día.
 */
export interface AlertaCobroCulqi {
  pedidoId: string;
  pedidoCodigo: string;
  monto: number;
  tipo: 'SIN_REGISTRAR' | 'EN_CURSO' | 'ERROR' | 'TARDIO' | 'DEVOLVER';
  mensaje: string;
}

export async function alertasCobroCulqi(db: { pagoOnlineIntento: { findMany: (args: any) => Promise<any[]> } }): Promise<AlertaCobroCulqi[]> {
  const filas = await db.pagoOnlineIntento.findMany({
    // Aprobado por Culqi y aún sin cobro registrado en Caja (cobrado_en null)
    where: { estado: 'APROBADO', cobrado_en: null },
    select: { pedido_id: true, monto_centimos: true, cobro_error: true, pedido: { select: { codigo: true } } },
    orderBy: { id: 'asc' },
    take: 100,
  });
  return filas.map((f) => {
    const e = String(f.cobro_error ?? '');
    const base = { pedidoId: String(f.pedido_id), pedidoCodigo: f.pedido?.codigo ?? '', monto: enPesos(f.monto_centimos) };
    if (e.startsWith('PEDIDO_ANULADO_DEVOLVER')) return { ...base, tipo: 'DEVOLVER' as const, mensaje: 'Pagó con el pedido ya anulado: hay que devolverle el dinero (Pagos en línea › Devolver).' };
    if (e.startsWith('PEDIDO_YA_NO_EN_LINEA')) return { ...base, tipo: 'TARDIO' as const, mensaje: 'Llegó el cobro de Culqi de un pedido que ya había cambiado de medio: revísalo y devuelve o cobra según corresponda.' };
    if (e === 'EN_CURSO') return { ...base, tipo: 'EN_CURSO' as const, mensaje: 'El cobro de Culqi quedó a medias (EN_CURSO). Revisa Pagos en línea.' };
    if (e) return { ...base, tipo: 'ERROR' as const, mensaje: `El cobro de Culqi no se registró en Caja: ${e.slice(0, 120)}` };
    return { ...base, tipo: 'SIN_REGISTRAR' as const, mensaje: 'Culqi aprobó el pago y el cobro no se registró en Caja.' };
  });
}
