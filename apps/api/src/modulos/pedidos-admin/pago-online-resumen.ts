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
  estado: 'APROBADO' | 'DEVUELTO_PARCIAL' | 'DEVUELTO';
  modo: string;
}

type Db = { pagoOnlineIntento?: { findMany: (args: any) => Promise<any[]> } };

/** Último pago en línea aprobado (o ya devuelto) de cada pedido; los pedidos sin pago Culqi no aparecen. */
export async function pagosOnlineDe(db: Db, pedidoIds: bigint[]): Promise<Map<string, PagoOnlineResumen>> {
  const out = new Map<string, PagoOnlineResumen>();
  if (!db.pagoOnlineIntento || pedidoIds.length === 0) return out;
  const filas = await db.pagoOnlineIntento
    .findMany({
      where: { pedido_id: { in: pedidoIds }, estado: { in: ['APROBADO', 'DEVUELTO'] }, culqi_cargo_id: { not: null } },
      orderBy: { id: 'asc' },
    })
    .catch(() => [] as any[]);
  for (const f of filas) {
    const devuelto = f.devuelto_centimos ?? 0;
    out.set(String(f.pedido_id), {
      medio: f.medio ?? null,
      marca: f.marca ?? null,
      ultimos4: f.ultimos4 ?? null,
      cargoId: String(f.culqi_cargo_id),
      monto: enPesos(f.monto_centimos),
      aprobadoEn: f.aprobado_en ?? null,
      devuelto: enPesos(devuelto),
      estado: devuelto <= 0 ? 'APROBADO' : devuelto >= f.monto_centimos ? 'DEVUELTO' : 'DEVUELTO_PARCIAL',
      modo: f.modo,
    });
  }
  return out;
}
