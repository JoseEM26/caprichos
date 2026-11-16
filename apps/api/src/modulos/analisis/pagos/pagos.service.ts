import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';

/** Orden de los medios en pantalla. DIVIDIDO = el pedido se pagó con más de un medio. */
export const MEDIOS_PAGO = ['YAPE', 'YAPE_CULQI', 'TARJETA', 'TARJETA_CULQI', 'EFECTIVO', 'PLIN', 'TRANSFERENCIA', 'DIVIDIDO', 'OTRO'];

/** Fila agregada que devuelve el SQL. `canal` null = total de todos los canales. */
export interface FilaMedio {
  canal: string | null;
  medio: string;
  pedidos: number;
  clientes: number;
  monto: number;
}
export interface FilaDia {
  dia: string;
  pedidos: number;
  culqi: number;
  montoCulqi: number;
  montoResto: number;
}
export interface Comision {
  total: number;
  pagosCulqi: number;
  porConfirmar: number;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Arma la respuesta desde las filas agregadas (puro: lo prueba el jest sin base de datos). */
export function armarPagos(medios: FilaMedio[], dias: FilaDia[], comision: Comision, devueltos: { pedidos: number; monto: number }, esAdmin: boolean) {
  const $ = (n: number) => (esAdmin ? Math.round(n * 100) / 100 : null);
  const orden = (m: string) => MEDIOS_PAGO.indexOf(m) + 1 || 99;
  const fila = (f: FilaMedio) => ({ medio: f.medio, pedidos: f.pedidos, clientes: f.clientes, monto: $(f.monto) });
  const ordenar = (l: FilaMedio[]) => [...l].sort((a, b) => orden(a.medio) - orden(b.medio) || b.pedidos - a.pedidos).map(fila);
  const totales = medios.filter((f) => f.canal === null);
  const canales = [...new Set(medios.filter((f) => f.canal !== null).map((f) => f.canal as string))].sort();
  const pedidosTotal = totales.reduce((s, f) => s + f.pedidos, 0);

  const cartaPedidos = dias.reduce((s, d) => s + d.pedidos, 0);
  const cartaCulqi = dias.reduce((s, d) => s + d.culqi, 0);
  const montoCulqi = dias.reduce((s, d) => s + d.montoCulqi, 0);
  const montoResto = dias.reduce((s, d) => s + d.montoResto, 0);
  const restoPedidos = cartaPedidos - cartaCulqi;

  return {
    conDinero: esAdmin,
    pedidos: pedidosTotal,
    porMedio: ordenar(totales).map((f) => ({ ...f, porcentaje: pct(f.pedidos, pedidosTotal) })),
    porCanal: canales.map((canal) => ({ canal, medios: ordenar(medios.filter((f) => f.canal === canal)) })),
    devueltosCulqi: { pedidos: devueltos.pedidos, monto: $(devueltos.monto) },
    adopcion: {
      pedidosCarta: cartaPedidos,
      pedidosCulqi: cartaCulqi,
      porcentaje: pct(cartaCulqi, cartaPedidos),
      ticketCulqi: cartaCulqi > 0 ? $(montoCulqi / cartaCulqi) : null,
      ticketResto: restoPedidos > 0 ? $(montoResto / restoPedidos) : null,
      porDia: dias.map((d) => ({ dia: d.dia, pedidos: d.pedidos, culqi: d.culqi, porcentaje: pct(d.culqi, d.pedidos) })),
    },
    // total null para el SUPERVISOR; porConfirmar = pagos Culqi aún sin comisión guardada
    comision: { total: $(comision.total), pagosCulqi: comision.pagosCulqi, porConfirmar: comision.porConfirmar },
  };
}

@Injectable()
export class PagosAnalisisService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const base = Prisma.sql`pe.creado_en >= ${rango.inicio} AND pe.creado_en < ${rango.fin} AND pe.estado NOT IN ('ANULADO','RECHAZADO')${rango.modalidad ? Prisma.sql` AND pe.modalidad = ${rango.modalidad}` : Prisma.empty}`;
    const clave = Prisma.sql`CASE WHEN cp.origen = 'CULQI' AND upper(cp.medio) IN ('YAPE','TARJETA') THEN upper(cp.medio) || '_CULQI' ELSE COALESCE(NULLIF(upper(trim(cp.medio)),''),'OTRO') END`;
    // Pedidos devueltos por la pasarela salen aparte, no cuentan como venta cobrada
    const noDevuelto = Prisma.sql`NOT EXISTS (SELECT 1 FROM pago_online_intento i WHERE i.pedido_id = pe.id AND i.estado = 'DEVUELTO')`;
    const porPedido = Prisma.sql`
      SELECT pe.id, pe.canal, to_char(pe.creado_en AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS dia,
             COALESCE(pe.party_id::text, NULLIF(pe.cliente_telefono, ''), 'p' || pe.id) AS cliente,
             CASE WHEN count(DISTINCT ${clave}) > 1 THEN 'DIVIDIDO' ELSE min(${clave}) END AS medio,
             bool_or(cp.origen = 'CULQI') AS culqi, sum(cp.monto) AS monto
      FROM pedido pe JOIN cobro c ON c.pedido_id = pe.id AND c.anulado_en IS NULL JOIN cobro_pago cp ON cp.cobro_id = c.id
      WHERE ${base} AND ${noDevuelto}
      GROUP BY pe.id`;
    const filtroCanal = rango.canal ? Prisma.sql`WHERE canal = ${rango.canal}` : Prisma.empty;

    const [medios, dias, com, dev] = await Promise.all([
      this.prisma.$queryRaw<Array<{ canal: string | null; medio: string; pedidos: bigint; clientes: bigint; monto: unknown }>>(Prisma.sql`
        WITH p AS (${porPedido}) SELECT canal, medio, count(*) AS pedidos, count(DISTINCT cliente) AS clientes, COALESCE(sum(monto),0) AS monto
        FROM p ${filtroCanal} GROUP BY GROUPING SETS ((canal, medio), (medio))`),
      this.prisma.$queryRaw<Array<{ dia: string; pedidos: bigint; culqi: bigint; monto_culqi: unknown; monto_resto: unknown }>>(Prisma.sql`
        WITH p AS (${porPedido}) SELECT dia, count(*) AS pedidos, count(*) FILTER (WHERE culqi) AS culqi,
          COALESCE(sum(monto) FILTER (WHERE culqi),0) AS monto_culqi, COALESCE(sum(monto) FILTER (WHERE NOT culqi),0) AS monto_resto
        FROM p WHERE canal = 'CARTA' GROUP BY dia ORDER BY dia`),
      this.prisma.$queryRaw<Array<{ total: unknown; pagos: bigint; sin: bigint }>>(Prisma.sql`
        SELECT COALESCE(sum(cp.comision_pasarela),0) AS total, count(*) AS pagos, count(*) FILTER (WHERE cp.comision_pasarela IS NULL) AS sin
        FROM pedido pe JOIN cobro c ON c.pedido_id = pe.id AND c.anulado_en IS NULL JOIN cobro_pago cp ON cp.cobro_id = c.id
        WHERE ${base} AND cp.origen = 'CULQI' AND ${noDevuelto}${rango.canal ? Prisma.sql` AND pe.canal = ${rango.canal}` : Prisma.empty}`),
      this.prisma.$queryRaw<Array<{ pedidos: bigint; centimos: unknown }>>(Prisma.sql`
        SELECT count(DISTINCT i.pedido_id) AS pedidos, COALESCE(sum(i.devuelto_centimos),0) AS centimos
        FROM pago_online_intento i JOIN pedido pe ON pe.id = i.pedido_id
        WHERE pe.creado_en >= ${rango.inicio} AND pe.creado_en < ${rango.fin} AND (i.estado = 'DEVUELTO' OR i.devuelto_centimos > 0)`),
    ]);
    const n = (v: unknown) => Number(v ?? 0);
    const c = com[0];
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      filtros: { modalidad: rango.modalidad, canal: rango.canal },
      ...armarPagos(
        medios.map((f) => ({ canal: f.canal, medio: f.medio, pedidos: n(f.pedidos), clientes: n(f.clientes), monto: n(f.monto) })),
        dias.map((d) => ({ dia: d.dia, pedidos: n(d.pedidos), culqi: n(d.culqi), montoCulqi: n(d.monto_culqi), montoResto: n(d.monto_resto) })),
        { total: n(c?.total), pagosCulqi: n(c?.pagos), porConfirmar: n(c?.sin) },
        { pedidos: n(dev[0]?.pedidos), monto: n(dev[0]?.centimos) / 100 },
        esAdmin,
      ),
    };
  }
}
