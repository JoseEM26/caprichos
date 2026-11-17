import { enPesos } from '../caja/caja.calculo';

/** Pago en línea (Culqi) aprobado de un pedido, tal como lo ven Caja y el mozo en el detalle. */
export interface PagoOnlineResumen {
  medio: string | null;
  marca: string | null;
  ultimos4: string | null;
  /** Número de operación de Culqi (id del cargo). */
  cargoId: string;
  monto: number;
  aprobadoEn: Date | null;
  devuelto: number;
  /** Fecha de la última devolución (ISO); null si no hubo */
  devueltoEn: string | null;
  estado: 'APROBADO' | 'DEVUELTO_PARCIAL' | 'DEVUELTO';
  modo: string;
  /** Comisión de la pasarela con IGV (la asume el local). Solo en el panel con permiso de caja; null = por confirmar. */
  comision?: number | null;
  neto?: number | null;
  comisionFuente?: 'CULQI' | 'ESTIMADA' | null;
}

type Db = { pagoOnlineIntento?: { findMany: (args: any) => Promise<any[]> }; cobroPago?: { findMany: (args: any) => Promise<any[]> } };

/** Último pago en línea aprobado (o ya devuelto) de cada pedido; los pedidos sin pago Culqi no aparecen. */
export async function pagosOnlineDe(db: Db, pedidoIds: bigint[], conComision = true): Promise<Map<string, PagoOnlineResumen>> {
  const out = new Map<string, PagoOnlineResumen>();
  if (!db.pagoOnlineIntento || pedidoIds.length === 0) return out;
  const filas = await db.pagoOnlineIntento
    .findMany({
      where: { pedido_id: { in: pedidoIds }, estado: { in: ['APROBADO', 'DEVUELTO'] }, culqi_cargo_id: { not: null } },
      orderBy: { id: 'asc' },
    })
    .catch(() => [] as any[]);
  // Comisión de la pasarela: del cobro_pago CULQI de cada pedido (nunca llega al cliente ni a roles sin caja)
  const pagos = conComision && db.cobroPago && filas.length
    ? await db.cobroPago.findMany({ where: { origen: 'CULQI', cobro: { pedido_id: { in: filas.map((f) => f.pedido_id) } } }, select: { comision_pasarela: true, comision_detalle: true, cobro: { select: { pedido_id: true } } } }).catch(() => [] as any[])
    : [];
  const comision = new Map<string, any>(pagos.map((p: any) => [String(p.cobro.pedido_id), p]));
  for (const f of filas) {
    const cp = comision.get(String(f.pedido_id));
    const devuelto = f.devuelto_centimos ?? 0;
    const ultima = ((f.devoluciones as any[]) ?? []).reduce<string | null>((m, d) => (d?.en && (!m || String(d.en) > m) ? String(d.en) : m), null);
    out.set(String(f.pedido_id), {
      medio: f.medio ?? null,
      marca: f.marca ?? null,
      ultimos4: f.ultimos4 ?? null,
      cargoId: String(f.culqi_cargo_id),
      monto: enPesos(f.monto_centimos),
      aprobadoEn: f.aprobado_en ?? null,
      devuelto: enPesos(devuelto),
      devueltoEn: devuelto > 0 ? ultima : null,
      estado: devuelto <= 0 ? 'APROBADO' : devuelto >= f.monto_centimos ? 'DEVUELTO' : 'DEVUELTO_PARCIAL',
      modo: f.modo,
      ...(conComision ? { comision: cp?.comision_pasarela == null ? null : Number(cp.comision_pasarela), neto: cp?.comision_detalle?.neto_depositado ?? null, comisionFuente: cp?.comision_detalle?.fuente ?? null } : {}),
    });
  }
  return out;
}
