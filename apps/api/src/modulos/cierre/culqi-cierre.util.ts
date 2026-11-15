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
      }));
  });
}
