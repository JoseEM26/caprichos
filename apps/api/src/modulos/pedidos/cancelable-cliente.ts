import type { PrismaService } from '../../comun/prisma/prisma.service';

/**
 * Regla de «el cliente puede cancelar su pedido» (carta y WhatsApp).
 * Solo mientras NO está pagado, NO tiene un voucher subido (en revisión) y aún no entró a preparación.
 */
export type RazonNoCancelable = 'ANULADO' | 'FINALIZADO' | 'YA_PAGADO' | 'PAGO_EN_REVISION' | 'EN_PREPARACION';

export interface DatosCancelable {
  estado: string;
  pago_estado: string | null;
  cobro_mozo_en: Date | null;
  adelanto_total: unknown;
  cobrosVigentes: number;
  pagosOnlineActivos: number; // cargo PROCESANDO o APROBADO
  vouchersVigentes: number;
  comandasEmpezadas: number; // áreas de cocina ya despejadas o devueltas
  /** Pedido del personal a crédito sin saldar: nace «PAGADO» pero no entró dinero (se descuenta después), no cuenta como pagado. */
  creditoPersonalSinCobrar?: boolean;
}

export type ResultadoCancelable = { cancelable: true } | { cancelable: false; razon: RazonNoCancelable; mensaje: string };

export const MENSAJES_NO_CANCELABLE: Record<RazonNoCancelable, string> = {
  ANULADO: 'Este pedido ya está cancelado.',
  FINALIZADO: 'Este pedido ya fue entregado.',
  YA_PAGADO: 'Ya no se puede cancelar: tu pedido ya está pagado o con el pago confirmado. Escríbenos y lo vemos contigo.',
  PAGO_EN_REVISION: 'Tu pago está en revisión, escríbenos y lo vemos contigo.',
  EN_PREPARACION: 'Ya no se puede cancelar: tu pedido ya está en preparación.',
};

const no = (razon: RazonNoCancelable): ResultadoCancelable => ({ cancelable: false, razon, mensaje: MENSAJES_NO_CANCELABLE[razon] });

export function reglaCancelable(d: DatosCancelable): ResultadoCancelable {
  if (d.estado === 'ANULADO') return no('ANULADO');
  if (d.estado === 'ENTREGADO') return no('FINALIZADO');
  const pagado =
    (!d.creditoPersonalSinCobrar && (d.pago_estado === 'PAGADO' || d.pago_estado === 'COORDINADO' || !!d.cobro_mozo_en)) ||
    Number(d.adelanto_total ?? 0) > 0 ||
    d.cobrosVigentes > 0 ||
    d.pagosOnlineActivos > 0;
  if (pagado) return no('YA_PAGADO');
  // ponytail: cualquier voucher vigente bloquea (incluso ilegible); decisión abierta con el dueño
  if (d.vouchersVigentes > 0) return no('PAGO_EN_REVISION');
  if (!['POR_PAGAR', 'COLA', 'PROGRAMADO'].includes(d.estado) || d.comandasEmpezadas > 0) return no('EN_PREPARACION');
  return { cancelable: true };
}

const SELECCION = {
  id: true,
  codigo: true,
  estado: true,
  pago_estado: true,
  pago_metodo: true,
  consumoPersonal: { select: { pagado_en: true } },
  cobro_mozo_en: true,
  adelanto_total: true,
  cliente_telefono: true,
  _count: {
    select: {
      cobros: { where: { anulado_en: null, credito_personal: false } }, // el crédito del personal no es dinero recibido
      pagosOnline: { where: { estado: { in: ['PROCESANDO', 'APROBADO'] } } },
      vouchers: { where: { reemplazado_en: null } },
      comandas: { where: { OR: [{ estado: 'DESPEJADA' }, { devuelta_en: { not: null } }] } },
    },
  },
} as const;

export type FilaCancelable = {
  id: bigint;
  codigo: string;
  estado: string;
  pago_estado: string | null;
  pago_metodo?: string | null;
  consumoPersonal?: { pagado_en: Date | null } | null;
  cobro_mozo_en: Date | null;
  adelanto_total: unknown;
  cliente_telefono: string | null;
  _count: { cobros: number; pagosOnline: number; vouchers: number; comandas: number };
};

export const evaluarFila = (p: FilaCancelable): ResultadoCancelable =>
  reglaCancelable({
    estado: p.estado,
    pago_estado: p.pago_estado,
    cobro_mozo_en: p.cobro_mozo_en,
    adelanto_total: p.adelanto_total,
    cobrosVigentes: (p._count?.cobros ?? 0),
    pagosOnlineActivos: (p._count?.pagosOnline ?? 0),
    vouchersVigentes: (p._count?.vouchers ?? 0),
    comandasEmpezadas: (p._count?.comandas ?? 0),
    creditoPersonalSinCobrar: p.pago_metodo === 'CREDITO_PERSONAL' && !!p.consumoPersonal && !p.consumoPersonal.pagado_en,
  });

/** Lee el pedido con sus conteos y aplica la regla. null si no existe. */
export async function cargarCancelable(prisma: PrismaService, where: { id?: bigint; codigo?: string }) {
  const p = (await prisma.pedido.findUnique({ where: where as any, select: SELECCION as any })) as FilaCancelable | null;
  return p ? { pedido: p, resultado: evaluarFila(p) } : null;
}

/** Pedidos recientes de un celular (cualquier canal) con su veredicto; el más nuevo primero. */
export async function cancelablesDelTelefono(prisma: PrismaService, telefono: string, horas = 24) {
  const ultimos = String(telefono || '').replace(/\D/g, '').slice(-8);
  if (ultimos.length < 8) return [];
  const filas = (await prisma.pedido.findMany({
    where: { cliente_telefono: { contains: ultimos }, creado_en: { gte: new Date(Date.now() - horas * 3600_000) } },
    orderBy: { creado_en: 'desc' },
    take: 10,
    select: SELECCION as any,
  })) as unknown as FilaCancelable[];
  return filas.map((pedido) => ({ pedido, resultado: evaluarFila(pedido) }));
}
