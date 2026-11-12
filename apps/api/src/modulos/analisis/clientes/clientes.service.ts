import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { HORAS_TURNO, resolverFiltros, type FiltrosAnalisis, type RangoAnalisis } from '../comun/filtros';

/** Tope de clientes leídos por consulta (un local mediano en 92 días queda muy por debajo; si se pasa, se avisa). */
export const MAX_CLIENTES_ANALISIS = 20000;
const LIMA = 'America/Lima';
const r1 = (x: unknown) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 10) / 10);
const r2 = (x: unknown) => Math.round(Number(x ?? 0) * 100) / 100;

/** Identidad del cliente: su cuenta (cliente_party_id) o, si es invitado, su celular de 9 dígitos. Sin ninguno = no identificado. */
const CLAVE_CLIENTE = Prisma.sql`COALESCE(cliente_party_id::text, NULLIF(NULLIF(right(regexp_replace(COALESCE(cliente_telefono, ''), '[^0-9]', '', 'g'), 9), ''), '999999999'))`;

/** Los 4 tramos de «cada cuánto regresan» (días entre un pedido y el anterior del mismo cliente). */
export const TRAMOS_REGRESO = ['Hasta 7 días', '8 a 14 días', '15 a 30 días', 'Más de 30 días'] as const;

type Fila = Record<string, any>;

/** Filtros de modalidad, canal y turno (hora de Lima) sobre pedido.creado_en, como fragmento SQL. */
function filtrosSql(r: RangoAnalisis) {
  const partes: Prisma.Sql[] = [];
  if (r.modalidad) partes.push(Prisma.sql`AND modalidad = ${r.modalidad}`);
  if (r.canal) partes.push(Prisma.sql`AND canal = ${r.canal}`);
  if (r.turno) {
    const [a, b] = HORAS_TURNO[r.turno];
    partes.push(Prisma.sql`AND EXTRACT(HOUR FROM creado_en AT TIME ZONE ${LIMA}) >= ${a} AND EXTRACT(HOUR FROM creado_en AT TIME ZONE ${LIMA}) < ${b}`);
  }
  return partes.length ? Prisma.join(partes, ' ') : Prisma.empty;
}

@Injectable()
export class ClientesAnalisisService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(filtros: FiltrosAnalisis, ahora: Date = new Date()) {
    const r = resolverFiltros(filtros, ahora);
    const [fidelidad, embudo, puntos, calificaciones] = await Promise.all([
      this.nuevosYRecurrentes(r),
      this.embudoCarta(r),
      this.puntos(r),
      this.calificaciones(r),
    ]);
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: r.desde, hasta: r.hasta, dias: r.dias },
      ...fidelidad,
      embudo,
      puntos,
      calificaciones,
    };
  }

  /**
   * Nuevo = su primer pedido (válido: no anulado ni del personal) cae dentro del rango; recurrente = ya había pedido antes.
   * «Cada cuánto regresan» = días entre un pedido del rango y el pedido anterior del mismo cliente (mediana y p90).
   */
  private async nuevosYRecurrentes(r: RangoAnalisis) {
    const extra = filtrosSql(r);
    const [clientes, regresos] = await Promise.all([
      this.prisma.$queryRaw<Fila[]>`
        WITH h AS (
          SELECT creado_en, modalidad, canal, ${CLAVE_CLIENTE} AS k,
                 MIN(creado_en) OVER (PARTITION BY ${CLAVE_CLIENTE}) AS primero
          FROM pedido WHERE estado <> 'ANULADO' AND es_personal = false AND creado_en < ${r.fin})
        SELECT (k IS NULL) AS sin_id, (MIN(primero) >= ${r.inicio}) AS nuevo, COUNT(*)::int AS pedidos,
               to_char(date_trunc('week', MIN(creado_en) AT TIME ZONE ${LIMA}), 'YYYY-MM-DD') AS semana
        FROM h WHERE creado_en >= ${r.inicio} ${extra}
        GROUP BY k
        LIMIT ${MAX_CLIENTES_ANALISIS + 1}`,
      this.prisma.$queryRaw<Fila[]>`
        WITH h AS (
          SELECT creado_en, modalidad, canal, ${CLAVE_CLIENTE} AS k,
                 LAG(creado_en) OVER (PARTITION BY ${CLAVE_CLIENTE} ORDER BY creado_en) AS previo
          FROM pedido WHERE estado <> 'ANULADO' AND es_personal = false AND creado_en < ${r.fin}),
        g AS (SELECT EXTRACT(EPOCH FROM creado_en - previo) / 86400.0 AS dias FROM h
              WHERE k IS NOT NULL AND previo IS NOT NULL AND creado_en >= ${r.inicio} ${extra})
        SELECT COUNT(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY dias) AS mediana,
               percentile_cont(0.9) WITHIN GROUP (ORDER BY dias) AS p90,
               COUNT(*) FILTER (WHERE dias <= 7)::int AS t1, COUNT(*) FILTER (WHERE dias > 7 AND dias <= 14)::int AS t2,
               COUNT(*) FILTER (WHERE dias > 14 AND dias <= 30)::int AS t3, COUNT(*) FILTER (WHERE dias > 30)::int AS t4
        FROM g`,
    ]);
    const truncado = clientes.length > MAX_CLIENTES_ANALISIS;
    const filas = truncado ? clientes.slice(0, MAX_CLIENTES_ANALISIS) : clientes;
    let nuevos = 0;
    let recurrentes = 0;
    let sinIdentificar = 0;
    const semanas = new Map<string, { nuevos: number; recurrentes: number }>();
    for (const f of filas) {
      if (f.sin_id) {
        sinIdentificar += Number(f.pedidos);
        continue;
      }
      const s = semanas.get(f.semana) ?? { nuevos: 0, recurrentes: 0 };
      if (f.nuevo) {
        nuevos++;
        s.nuevos++;
      } else {
        recurrentes++;
        s.recurrentes++;
      }
      semanas.set(f.semana, s);
    }
    const total = nuevos + recurrentes;
    const g = regresos[0] ?? {};
    const n = Number(g.n ?? 0);
    return {
      truncado,
      limite: MAX_CLIENTES_ANALISIS,
      clientes: {
        total,
        nuevos,
        recurrentes,
        pctRecurrentes: total ? r1((recurrentes / total) * 100) : null,
        pedidosSinIdentificar: sinIdentificar,
      },
      semanas: [...semanas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, v]) => ({ semana, ...v })),
      regreso: {
        n,
        medianaDias: n ? r1(g.mediana) : null,
        p90Dias: n ? r1(g.p90) : null,
        tramos: TRAMOS_REGRESO.map((nombre, i) => ({ nombre, n: Number(g[`t${i + 1}`] ?? 0) })),
      },
    };
  }

  /**
   * Embudo de la carta con lo que SÍ se guarda: no hay visitas ni carrito en el servidor (el carrito vive en el navegador).
   * Pasos: pedidos creados en la carta → con pago confirmado → entregados. Los anulados salen aparte.
   */
  private async embudoCarta(r: RangoAnalisis) {
    const [f] = await this.prisma.$queryRaw<Fila[]>`
      SELECT COUNT(*)::int AS creados,
             COUNT(*) FILTER (WHERE estado <> 'ANULADO' AND pago_estado = 'PAGADO')::int AS pagados,
             COUNT(*) FILTER (WHERE estado = 'ENTREGADO')::int AS entregados,
             COUNT(*) FILTER (WHERE estado = 'ANULADO')::int AS anulados
      FROM pedido
      WHERE canal = 'CARTA' AND creado_en >= ${r.inicio} AND creado_en < ${r.fin}
      ${filtrosSql({ ...r, canal: null })}`;
    const creados = Number(f?.creados ?? 0);
    const paso = (id: string, nombre: string, n: number) => ({
      id,
      nombre,
      n,
      pctDelAnterior: null as number | null,
      pctDeCreados: creados ? r1((n / creados) * 100) : null,
    });
    const pasos = [
      paso('creados', 'Pedidos creados en la carta', creados),
      paso('pagados', 'Con pago confirmado', Number(f?.pagados ?? 0)),
      paso('entregados', 'Entregados', Number(f?.entregados ?? 0)),
    ];
    pasos.forEach((p, i) => {
      if (i > 0 && pasos[i - 1].n > 0) p.pctDelAnterior = r1((p.n / pasos[i - 1].n) * 100);
    });
    return {
      pasos,
      anulados: Number(f?.anulados ?? 0),
      noSeGuarda: [
        'Visitas o aperturas de la carta (la carta no registra eventos de visita).',
        'Quién agregó un producto al carrito y no terminó (el carrito vive en el navegador).',
        'Quién llegó a la pantalla de pago y la dejó (no se guarda el abandono del pago).',
      ],
    };
  }

  /** Puntos: 1 punto = S/ 1 de descuento (el canje se resta del total en soles). Pendiente = saldo vivo de todas las cuentas. */
  private async puntos(r: RangoAnalisis) {
    const [mov, saldo, semanal] = await Promise.all([
      this.prisma.$queryRaw<Fila[]>`
        SELECT tipo, COUNT(*)::int AS n, COALESCE(SUM(puntos), 0)::float8 AS puntos FROM movimiento_puntos
        WHERE en >= ${r.inicio} AND en < ${r.fin} GROUP BY tipo`,
      this.prisma.$queryRaw<Fila[]>`
        SELECT COALESCE(SUM(puntos) FILTER (WHERE puntos > 0), 0)::float8 AS saldo, COUNT(*) FILTER (WHERE puntos > 0)::int AS cuentas
        FROM customer_detail`,
      this.prisma.$queryRaw<Fila[]>`
        SELECT to_char(date_trunc('week', en AT TIME ZONE ${LIMA}), 'YYYY-MM-DD') AS semana, tipo, COALESCE(SUM(puntos), 0)::float8 AS puntos
        FROM movimiento_puntos WHERE en >= ${r.inicio} AND en < ${r.fin} GROUP BY 1, 2 ORDER BY 1 LIMIT 100`,
    ]);
    const suma = (t: string) => Number(mov.find((m) => m.tipo === t)?.puntos ?? 0);
    const emitidos = suma('SUMA') - suma('REVERSA');
    const canjeados = suma('CANJE') - suma('DEVOLUCION_CANJE');
    const porSemana = new Map<string, { emitidos: number; canjeados: number }>();
    for (const s of semanal) {
      const v = porSemana.get(s.semana) ?? { emitidos: 0, canjeados: 0 };
      const p = Number(s.puntos);
      if (s.tipo === 'SUMA') v.emitidos += p;
      else if (s.tipo === 'REVERSA') v.emitidos -= p;
      else if (s.tipo === 'CANJE') v.canjeados += p;
      else if (s.tipo === 'DEVOLUCION_CANJE') v.canjeados -= p;
      porSemana.set(s.semana, v);
    }
    return {
      emitidos: r2(emitidos),
      canjeados: r2(canjeados),
      pctCanjeado: emitidos > 0 ? r1((canjeados / emitidos) * 100) : null,
      saldoVivo: r2(saldo[0]?.saldo),
      cuentasConSaldo: Number(saldo[0]?.cuentas ?? 0),
      /** Costo real del período: lo canjeado (soles de descuento). */
      costoCanjeadoPen: r2(canjeados),
      /** Costo máximo pendiente: si todo el saldo vivo se canjeara. */
      costoPendientePen: r2(saldo[0]?.saldo),
      semanas: [...porSemana.entries()].map(([semana, v]) => ({ semana, emitidos: r2(v.emitidos), canjeados: r2(v.canjeados) })),
    };
  }

  /** Encuestas de posventa (sin las simuladas) y reseñas de Google. Solo agregados: nunca comentarios ni nombres. */
  private async calificaciones(r: RangoAnalisis) {
    const [semanal, dist, enviadas, demora, google] = await Promise.all([
      this.prisma.$queryRaw<Fila[]>`
        SELECT to_char(date_trunc('week', respondida_en AT TIME ZONE ${LIMA}), 'YYYY-MM-DD') AS semana, COUNT(*)::int AS respuestas, AVG(puntaje)::float8 AS promedio
        FROM encuesta_posventa WHERE estado = 'RESPONDIDA' AND puntaje IS NOT NULL AND respondida_en >= ${r.inicio} AND respondida_en < ${r.fin}
        GROUP BY 1 ORDER BY 1 LIMIT 20`,
      this.prisma.$queryRaw<Fila[]>`
        SELECT puntaje, COUNT(*)::int AS n FROM encuesta_posventa
        WHERE estado = 'RESPONDIDA' AND puntaje IS NOT NULL AND respondida_en >= ${r.inicio} AND respondida_en < ${r.fin} GROUP BY puntaje`,
      this.prisma.encuestaPosventa.count({ where: { enviada_en: { gte: r.inicio, lt: r.fin }, estado: { not: 'SIMULADA' } } }),
      this.prisma.$queryRaw<Fila[]>`
        SELECT (EXTRACT(EPOCH FROM p.entregado_en - p.creado_en) / 60.0 > p.eta_max) AS demorado, COUNT(*)::int AS n, AVG(e.puntaje)::float8 AS promedio
        FROM encuesta_posventa e JOIN pedido p ON p.id = e.pedido_id
        WHERE e.estado = 'RESPONDIDA' AND e.puntaje IS NOT NULL AND e.respondida_en >= ${r.inicio} AND e.respondida_en < ${r.fin}
          AND p.eta_max IS NOT NULL AND p.entregado_en IS NOT NULL
        GROUP BY 1`,
      this.prisma.resenaGoogle.aggregate({
        where: { publicada_en: { gte: r.inicio, lt: r.fin } },
        _avg: { calificacion: true },
        _count: { _all: true },
      }),
    ]);
    const respuestas = semanal.reduce((s, f) => s + Number(f.respuestas), 0);
    const suma = semanal.reduce((s, f) => s + Number(f.promedio) * Number(f.respuestas), 0);
    const de = (d: boolean) => demora.find((x) => !!x.demorado === d);
    const grupo = (d: boolean) => ({ n: Number(de(d)?.n ?? 0), promedio: de(d) ? r2(de(d)!.promedio) : null });
    return {
      encuestas: {
        enviadas,
        respondidas: respuestas,
        pctRespuesta: enviadas ? r1((respuestas / enviadas) * 100) : null,
        promedio: respuestas ? r2(suma / respuestas) : null,
        semanas: semanal.map((f) => ({ semana: f.semana, respuestas: Number(f.respuestas), promedio: r2(f.promedio) })),
        distribucion: [1, 2, 3, 4, 5].map((p) => ({ puntaje: p, n: Number(dist.find((d) => Number(d.puntaje) === p)?.n ?? 0) })),
      },
      /** Puntaje de quienes recibieron su pedido pasada la espera máxima prometida (eta_max) frente a los que no. */
      demora: { conDemora: grupo(true), sinDemora: grupo(false) },
      google: { n: google._count._all, promedio: google._count._all ? r2(google._avg.calificacion) : null },
    };
  }
}
