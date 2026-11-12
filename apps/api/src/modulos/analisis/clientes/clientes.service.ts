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
   * Embudo de la carta: visitó → agregó al carrito → abrió el checkout → llegó al pago (eventos anónimos por sesión de navegador,
   * tabla carta_evento) → creó el pedido → pagado → entregado (pedidos de la carta enlazados a una sesión medida).
   * Cada sesión cuenta en la etapa MÁS ALTA que alcanzó y en todas las anteriores, así que el embudo nunca crece hacia abajo.
   * Solo respeta las fechas (modalidad, canal y turno no aplican a una visita). Sin celulares ni nombres.
   */
  private async embudoCarta(r: RangoAnalisis) {
    const [sesiones, pedidos, [primero]] = await Promise.all([
      this.prisma.$queryRaw<Fila[]>`
        WITH s AS (
          SELECT sesion_id,
                 MAX(CASE evento WHEN 'VISITA' THEN 1 WHEN 'CARRITO' THEN 2 WHEN 'CHECKOUT' THEN 3 WHEN 'PAGO' THEN 4 END) AS rango,
                 (array_agg(dispositivo ORDER BY id DESC))[1] AS dispositivo, bool_or(con_sesion) AS con_sesion
          FROM carta_evento
          WHERE sesion_id IS NOT NULL AND evento <> 'PEDIDO' AND creado_en >= ${r.inicio} AND creado_en < ${r.fin}
          GROUP BY sesion_id)
        SELECT dispositivo, con_sesion, rango, COUNT(*)::int AS n FROM s WHERE rango IS NOT NULL GROUP BY 1, 2, 3`,
      this.prisma.$queryRaw<Fila[]>`
        SELECT COALESCE(e.dispositivo, 'DESCONOCIDO') AS dispositivo, COALESCE(e.con_sesion, false) AS con_sesion,
               (e.sesion_id IS NOT NULL) AS medido, COUNT(*)::int AS creados,
               COUNT(*) FILTER (WHERE p.estado <> 'ANULADO' AND p.pago_estado = 'PAGADO')::int AS pagados,
               COUNT(*) FILTER (WHERE p.estado = 'ENTREGADO')::int AS entregados,
               COUNT(*) FILTER (WHERE p.estado = 'ANULADO')::int AS anulados
        FROM pedido p LEFT JOIN carta_evento e ON e.pedido_id = p.id AND e.evento = 'PEDIDO'
        WHERE p.canal = 'CARTA' AND p.creado_en >= ${r.inicio} AND p.creado_en < ${r.fin}
        GROUP BY 1, 2, 3`,
      this.prisma.$queryRaw<Fila[]>`SELECT MIN(creado_en) AS primero FROM carta_evento`,
    ]);

    // matriz[grupo][etapa] con etapas 0..6; los grupos de dispositivo y de sesión se llenan a la vez
    const GRUPOS = ['total', 'movil', 'escritorio', 'conSesion', 'sinSesion'] as const;
    const m = Object.fromEntries(GRUPOS.map((g) => [g, Array(7).fill(0)])) as Record<(typeof GRUPOS)[number], number[]>;
    const sumar = (disp: string, con: boolean, etapa: number, n: number) => {
      m.total[etapa] += n;
      if (disp === 'MOVIL') m.movil[etapa] += n;
      else if (disp === 'ESCRITORIO') m.escritorio[etapa] += n;
      (con ? m.conSesion : m.sinSesion)[etapa] += n;
    };
    for (const f of sesiones) for (let e = 0; e < Number(f.rango); e++) sumar(f.dispositivo, !!f.con_sesion, e, Number(f.n));
    let sinMedir = 0;
    let anulados = 0;
    for (const f of pedidos) {
      anulados += Number(f.anulados);
      if (!f.medido) {
        sinMedir += Number(f.creados);
        continue;
      }
      sumar(f.dispositivo, !!f.con_sesion, 4, Number(f.creados));
      sumar(f.dispositivo, !!f.con_sesion, 5, Number(f.pagados));
      sumar(f.dispositivo, !!f.con_sesion, 6, Number(f.entregados));
    }

    const NOMBRES = ['Visitó la carta', 'Agregó algo al carrito', 'Abrió el checkout', 'Llegó al paso de pago', 'Creó el pedido', 'Pedido pagado', 'Pedido entregado'];
    const IDS = ['visita', 'carrito', 'checkout', 'pago', 'creado', 'pagado', 'entregado'];
    const visitas = m.total[0];
    const pasos = NOMBRES.map((nombre, i) => {
      const n = m.total[i];
      const antes = i > 0 ? m.total[i - 1] : null;
      return {
        id: IDS[i],
        nombre,
        n,
        pctDelAnterior: antes ? r1((n / antes) * 100) : null,
        pctDeVisitas: visitas ? r1((n / visitas) * 100) : null,
        /** Cuántos se quedaron en el paso anterior sin llegar a este. */
        caida: antes == null ? null : Math.max(antes - n, 0),
        pctCaida: antes ? r1((Math.max(antes - n, 0) / antes) * 100) : null,
        movil: m.movil[i],
        escritorio: m.escritorio[i],
        conSesion: m.conSesion[i],
        sinSesion: m.sinSesion[i],
      };
    });
    const primeroEn: Date | null = primero?.primero ? new Date(primero.primero) : null;
    return {
      pasos,
      anulados,
      /** Pedidos de la carta del rango que no se pueden ligar a una visita (anteriores a la medición, sin sesión de navegador o con «no rastrear»). */
      pedidosSinMedir: sinMedir,
      /** Fecha (hora de Lima, AAAA-MM-DD) desde la que existen eventos; null si todavía no hay ninguno. */
      sinDatosAntesDe: primeroEn ? new Date(primeroEn.getTime() - 5 * 3_600_000).toISOString().slice(0, 10) : null,
      /** Verdadero si el rango empieza antes de esa fecha: las etapas de visita de esos días están incompletas. */
      rangoParcial: !primeroEn || primeroEn > r.inicio,
      queSeMide: [
        'Cada navegador recibe un código al azar al abrir la carta; no se guarda celular, nombre, IP ni modelo del aparato.',
        'Cuenta visitas por sesión de navegador (una persona que vuelve otro día cuenta otra vez) y la etapa más alta que alcanzó.',
        'No se mide a quien activa «no rastrear» (DNT o GPC) en su navegador.',
        'Los eventos se borran solos a los 120 días. Este embudo solo usa las fechas; modalidad, canal y turno no le aplican.',
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
