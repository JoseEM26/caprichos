import { PrismaService } from '../../comun/prisma/prisma.service';
import { MOTIVO_RETIRO } from '../chatbot/servicios/reprogramacion.service';

/**
 * Recargo por volver a enviar un pedido tras el retiro por espera agotada.
 * Una sola fuente de verdad: la pregunta al cliente, el listado de Caja y el reenvío usan este cálculo.
 *  - IGUAL_ENVIO: el mismo costo de envío del pedido (sin contar recargos de reprogramaciones previas).
 *                 Si el envío base es 0 (gratis por promoción), usa la tarifa de la zona; sin zona, 0.
 *  - FIJO:        el monto de reparto_recargo_reprogramacion.
 *  - SIN_COSTO:   0.
 */
export const MODOS_RECARGO_REPROG = ['IGUAL_ENVIO', 'FIJO', 'SIN_COSTO'] as const;
export type ModoRecargoReprog = (typeof MODOS_RECARGO_REPROG)[number];
export const MODO_RECARGO_REPROG_DEFECTO: ModoRecargoReprog = 'IGUAL_ENVIO';

export interface EntradaRecargoReprog {
  modo: unknown;
  montoFijo: number;
  /** pedido.envio tal como está hoy (incluye los recargos de reprogramaciones ya cobradas). */
  envioActual: number | null;
  /** Suma de los recargos de reprogramaciones ya sumadas al envío (incidentes REPROGRAMADO). */
  recargosPrevios: number;
  /** Tarifa de la zona del pedido, si la tiene. */
  tarifaZona: number | null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Función pura: monto en soles del recargo según el modo. */
export function calcularRecargoReprogramacion(e: EntradaRecargoReprog): number {
  const modo = MODOS_RECARGO_REPROG.includes(e.modo as ModoRecargoReprog)
    ? (e.modo as ModoRecargoReprog)
    : MODO_RECARGO_REPROG_DEFECTO;

  if (modo === 'SIN_COSTO') return 0;
  if (modo === 'FIJO') return redondear(Math.max(0, Number(e.montoFijo) || 0));

  const envioBase = Math.max(0, (e.envioActual ?? 0) - e.recargosPrevios);
  const base = envioBase > 0 ? envioBase : Math.max(0, e.tarifaZona ?? 0);
  return redondear(base);
}

/** Lee el estado del pedido y calcula el recargo con la función pura. Lo usa el planificador al retirar. */
export async function calcularMontoReprogramacion(
  prisma: Pick<PrismaService, 'parametro' | 'pedido' | 'incidenteEntrega'>,
  pedidoId: bigint,
): Promise<{ monto: number; modo: ModoRecargoReprog }> {
  const [params, pedido, previos] = await Promise.all([
    prisma.parametro.findMany({
      where: { clave: { in: ['reprog_recargo_modo', 'reparto_recargo_reprogramacion'] } },
    }),
    prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { envio: true, zona: { select: { tarifa: true } } },
    }),
    prisma.incidenteEntrega.findMany({
      where: { pedido_id: pedidoId, cierre: 'REPROGRAMADO', recargo: { not: null } },
      select: { recargo: true },
    }),
  ]);
  const mapa = new Map<string, unknown>(params.map((p) => [p.clave, p.valor]));
  const modo = String(mapa.get('reprog_recargo_modo') ?? MODO_RECARGO_REPROG_DEFECTO).replace(/"/g, '');

  const monto = calcularRecargoReprogramacion({
    modo,
    montoFijo: Number(mapa.get('reparto_recargo_reprogramacion') ?? 0),
    envioActual: pedido?.envio != null ? Number(pedido.envio) : null,
    recargosPrevios: previos.reduce((acc, i) => acc + Number(i.recargo ?? 0), 0),
    tarifaZona: pedido?.zona?.tarifa != null ? Number(pedido.zona.tarifa) : null,
  });
  const modoValido = MODOS_RECARGO_REPROG.includes(modo as ModoRecargoReprog)
    ? (modo as ModoRecargoReprog)
    : MODO_RECARGO_REPROG_DEFECTO;
  return { monto, modo: modoValido };
}

/**
 * Monto que se cobra al reenviar: el que quedó guardado en el incidente del retiro (es el mismo que
 * vio el cliente). Si no hay incidente pendiente, lo calcula en ese momento.
 */
export async function montoPendienteReprogramacion(
  prisma: Pick<PrismaService, 'parametro' | 'pedido' | 'incidenteEntrega'>,
  pedidoId: bigint,
): Promise<number> {
  const pendiente = await prisma.incidenteEntrega.findFirst({
    where: { pedido_id: pedidoId, cierre: null, motivo: MOTIVO_RETIRO },
    orderBy: { en: 'desc' },
    select: { recargo: true },
  });
  if (pendiente?.recargo != null) return Number(pendiente.recargo);
  return (await calcularMontoReprogramacion(prisma, pedidoId)).monto;
}
