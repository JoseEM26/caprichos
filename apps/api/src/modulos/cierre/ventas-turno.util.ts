/** Pesos a céntimos enteros (mismo criterio que el cálculo de caja; local para no cruzar módulos). */
const aCentimos = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const enPesos = (c: number) => c / 100;

/**
 * Detalle de cada venta cobrada del turno (solo para mostrar en el cierre: no entra en ningún cálculo).
 * Se pega por `pedidoId` a la lista `cobrados`, que no cambia.
 */
export interface VentaTurno {
  pedidoId: string;
  modalidad: string | null;
  canal: string | null;
  estadoPedido: string | null;
  mesa: string | null;
  /** Cuándo se registró el pedido (el cobro va en `cobrados[].en`). */
  creadoEn: Date | null;
  /** Mozo o cajero que tomó el pedido; null si lo hizo el cliente (web, WhatsApp). */
  registradoPor: string | null;
  cobradoPor: string | null;
  /** Mozo que lo cobró en la mesa y lo envió a Caja, si fue así. */
  cobradoPorMozo: string | null;
  repartidor: string | null;
  categorias: string[];
  pagos: Array<{ medio: string; monto: number }>;
  propina: number;
  creditoPersonal: boolean;
  comprobante: { tipo: string; numero: string; estado: string | null } | null;
}

/** Cobro con el pedido tal como lo trae el cierre; todo lo opcional puede faltar. */
export interface CobroConDetalle {
  pedido_id: bigint;
  cobrado_por?: bigint | null;
  credito_personal?: boolean | null;
  anulado_en: Date | null;
  pagos: Array<{ medio: string | null; monto?: unknown; propina?: unknown }>;
  pedido: {
    modalidad?: string | null;
    canal?: string | null;
    estado?: string | null;
    mesa_nombre?: string | null;
    creado_en?: Date | null;
    party_id?: bigint | null;
    repartidor_party_id?: bigint | null;
    cobro_mozo_party_id?: bigint | null;
    lineas?: Array<{ producto?: { categoria?: { nombre?: string | null } | null } | null }>;
    comprobante?: Array<{ tipo: string; numero_texto: string; facturacion_estado?: string | null; emision?: string | null; anulado_en?: Date | null }>;
  };
}

/** En MOZO y CAJA el party_id del pedido es la persona de la casa; en el resto es el cliente. */
const CANALES_CON_ATENDIDO = ['MOZO', 'CAJA'];

/** Ids de personas que hay que nombrar para armar el detalle. */
export function idsDePersonas(cobros: CobroConDetalle[]): bigint[] {
  const ids: bigint[] = [];
  for (const c of cobros) {
    if (c.anulado_en) continue;
    if (c.cobrado_por != null) ids.push(c.cobrado_por);
    if (c.pedido.repartidor_party_id != null) ids.push(c.pedido.repartidor_party_id);
    if (c.pedido.cobro_mozo_party_id != null) ids.push(c.pedido.cobro_mozo_party_id);
    if (CANALES_CON_ATENDIDO.includes(String(c.pedido.canal)) && c.pedido.party_id != null) ids.push(c.pedido.party_id);
  }
  return ids;
}

/** Nombre completo por party_id (sin consultar si no hay ids). */
export async function nombresDeCobros(
  prisma: { person: { findMany: (args: any) => Promise<Array<{ party_id: bigint; nombres: string; apellidos: string | null }>> } },
  ids: bigint[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.map(String))].map((x) => BigInt(x));
  if (unicos.length === 0) return new Map();
  const personas = await prisma.person.findMany({
    where: { party_id: { in: unicos } },
    select: { party_id: true, nombres: true, apellidos: true },
  });
  return new Map(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos || ''}`.trim()]));
}

export function detallarVentasTurno(cobros: CobroConDetalle[], nombres: Map<string, string>): VentaTurno[] {
  const nombre = (id?: bigint | null) => (id == null ? null : (nombres.get(String(id)) ?? null));
  return cobros
    .filter((c) => !c.anulado_en)
    .map((c) => {
      const p = c.pedido;
      const vigente = (p.comprobante ?? []).find((x) => !x.anulado_en);
      return {
        pedidoId: c.pedido_id.toString(),
        modalidad: p.modalidad ?? null,
        canal: p.canal ?? null,
        estadoPedido: p.estado ?? null,
        mesa: p.mesa_nombre ?? null,
        creadoEn: p.creado_en ?? null,
        registradoPor: CANALES_CON_ATENDIDO.includes(String(p.canal)) ? nombre(p.party_id) : null,
        cobradoPor: nombre(c.cobrado_por),
        cobradoPorMozo: nombre(p.cobro_mozo_party_id),
        repartidor: nombre(p.repartidor_party_id),
        categorias: [...new Set((p.lineas ?? []).map((l) => l.producto?.categoria?.nombre).filter((n): n is string => !!n))],
        pagos: c.pagos.map((x) => ({ medio: (x.medio || '').toUpperCase(), monto: enPesos(aCentimos(x.monto)) })),
        propina: enPesos(c.pagos.reduce((t, x) => t + aCentimos(x.propina), 0)),
        creditoPersonal: !!c.credito_personal,
        comprobante: vigente ? { tipo: vigente.tipo, numero: vigente.numero_texto, estado: vigente.facturacion_estado ?? vigente.emision ?? null } : null,
      };
    });
}
