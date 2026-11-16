import { celularEnmascarado, descuentoDelCupon } from '../ofertas/cupon-usos';
import { rangoDiaCaja } from './cierre.util';

const r2 = (n: number) => Math.round(n * 100) / 100;
const MODO_ASIGNADO = 'ASIGNADO_PERSONAL';
const SIN_PERSONA = 'Cliente (carta, sin trabajador)';

/** Un pedido anulado, rechazado o con todos sus cobros anulados no cuenta como canje del turno. */
const pedidoVigente = (p: { estado?: string | null; cobros?: Array<{ anulado_en: Date | null }> } | null | undefined) =>
  !!p && p.estado !== 'ANULADO' && p.estado !== 'RECHAZADO' && !((p.cobros?.length ?? 0) > 0 && p.cobros!.every((c) => c.anulado_en != null));

const selPedido = { codigo: true, estado: true, descuento: true, descuento_detalle: true, cobros: { select: { anulado_en: true } } };

export interface CuponesTurno {
  porPersona: Array<{
    partyId: string | null;
    nombre: string;
    dados: Array<{ codigo: string; cupon: string; pedido: string | null; cliente: string | null; en: string; venceEn: string | null; estado: string }>;
    canjeados: Array<{ codigo: string; cupon: string; pedido: string | null; descuento: number; dioNombre: string | null; canal: string | null; en: string }>;
    pendientes: Array<{ codigo: string; cupon: string; pedido: string | null; cliente: string | null; venceEn: string | null }>;
    totales: { dados: number; canjeados: number; pendientes: number; descuento: number };
  }>;
  /** Cupones compartidos y de código único (impresos en comprobante) canjeados en el turno: línea aparte. */
  otros: { canjes: number; descuento: number };
  totales: { dados: number; canjeados: number; pendientes: number; descuento: number };
}

/**
 * Cupones del turno (informativo: NO entra al efectivo esperado ni al cuadre; el descuento ya está dentro del total del pedido).
 * Turno = día de la caja en Lima hasta que se cerró (o ahora). Tres consultas fijas, sin N+1.
 */
export async function cuponesDelTurno(prisma: any, caja: { fecha: Date; cerrada_en?: Date | null }, ahora = new Date()): Promise<CuponesTurno> {
  const inicio = rangoDiaCaja(caja.fecha).inicio;
  const fin = caja.cerrada_en ?? ahora;
  const enVentana = { gte: inicio, lte: fin };
  const [dadosBd, canjesBd, compartidosBd]: [any[], any[], any[]] = await Promise.all([
    prisma.cuponEmitido.findMany({
      where: { creado_en: enVentana, cupon: { modo: MODO_ASIGNADO } },
      include: { cupon: { select: { codigo_base: true } }, pedidoOrigen: { select: { codigo: true, estado: true, cliente_telefono: true } } },
      orderBy: { creado_en: 'asc' },
    }),
    prisma.cuponEmitido.findMany({
      where: { canjeado_en: enVentana, estado: 'CANJEADO' },
      include: { cupon: { select: { codigo_base: true, modo: true } }, pedidoOrigen: { select: { codigo: true } }, pedidoCanje: { select: selPedido } },
      orderBy: { canjeado_en: 'asc' },
    }),
    prisma.cuponCanjeCompartido.findMany({ where: { en: enVentana }, include: { pedido: { select: selPedido } } }),
  ]);

  const dados = dadosBd.filter((e) => e.estado !== 'ANULADO' && e.pedidoOrigen?.estado !== 'ANULADO' && e.pedidoOrigen?.estado !== 'RECHAZADO');
  const canjesAsignados = canjesBd.filter((e) => e.cupon.modo === MODO_ASIGNADO && pedidoVigente(e.pedidoCanje));
  const canjesUnicos = canjesBd.filter((e) => e.cupon.modo !== MODO_ASIGNADO && pedidoVigente(e.pedidoCanje));
  const compartidos = compartidosBd.filter((c) => pedidoVigente(c.pedido));

  // Quién dio y quién canjeó (el que dio puede ser de otro turno): una sola lectura de nombres
  const ids = new Set<bigint>();
  [...dados, ...canjesAsignados].forEach((e) => {
    if (e.otorgado_por != null) ids.add(e.otorgado_por);
    if (e.canjeado_por != null) ids.add(e.canjeado_por);
  });
  const personas: any[] = ids.size ? await prisma.person.findMany({ where: { party_id: { in: [...ids] } }, select: { party_id: true, nombres: true, apellidos: true } }) : [];
  const nombres = new Map<string, string>(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));
  const nombreDe = (id: bigint | null | undefined) => (id == null ? null : (nombres.get(String(id)) ?? 'Trabajador'));

  const grupos = new Map<string, CuponesTurno['porPersona'][number]>();
  const grupo = (id: bigint | null | undefined) => {
    const k = id == null ? '' : String(id);
    let g = grupos.get(k);
    if (!g) {
      g = { partyId: k || null, nombre: id == null ? SIN_PERSONA : (nombreDe(id) as string), dados: [], canjeados: [], pendientes: [], totales: { dados: 0, canjeados: 0, pendientes: 0, descuento: 0 } };
      grupos.set(k, g);
    }
    return g;
  };

  for (const e of dados) {
    const g = grupo(e.otorgado_por);
    const venceEn = e.vence_en ? (e.vence_en as Date).toISOString() : null;
    const cliente = celularEnmascarado(e.pedidoOrigen?.cliente_telefono);
    const cupon = e.cupon.codigo_base as string;
    const pedido = (e.pedidoOrigen?.codigo ?? null) as string | null;
    g.dados.push({ codigo: e.codigo, cupon, pedido, cliente, en: (e.creado_en as Date).toISOString(), venceEn, estado: e.estado });
    g.totales.dados += 1;
    if (e.estado === 'VIGENTE' && (!e.vence_en || e.vence_en > ahora)) {
      g.pendientes.push({ codigo: e.codigo, cupon, pedido, cliente, venceEn });
      g.totales.pendientes += 1;
    }
  }
  for (const e of canjesAsignados) {
    const g = grupo(e.canjeado_por);
    const descuento = descuentoDelCupon(e.pedidoCanje);
    g.canjeados.push({
      codigo: e.codigo,
      cupon: e.cupon.codigo_base,
      pedido: e.pedidoCanje?.codigo ?? null,
      descuento,
      dioNombre: nombreDe(e.otorgado_por),
      canal: e.canjeado_canal ?? null,
      en: (e.canjeado_en as Date).toISOString(),
    });
    g.totales.canjeados += 1;
    g.totales.descuento = r2(g.totales.descuento + descuento);
  }

  const porPersona = [...grupos.values()].sort((a, b) => b.totales.dados + b.totales.canjeados - (a.totales.dados + a.totales.canjeados));
  const otrosDesc = r2([...canjesUnicos.map((e) => e.pedidoCanje), ...compartidos.map((c) => c.pedido)].reduce((t, p) => t + descuentoDelCupon(p), 0));
  return {
    porPersona,
    otros: { canjes: canjesUnicos.length + compartidos.length, descuento: otrosDesc },
    totales: {
      dados: dados.length,
      canjeados: canjesAsignados.length,
      pendientes: porPersona.reduce((t, g) => t + g.totales.pendientes, 0),
      descuento: r2(porPersona.reduce((t, g) => t + g.totales.descuento, 0)),
    },
  };
}
