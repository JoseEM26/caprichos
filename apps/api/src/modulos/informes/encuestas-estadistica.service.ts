import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { FiltroEncuestasDto } from './dto/filtro-encuestas.dto';

const DIAS_RANGO_DEFECTO = 30;
const DIAS_RANGO_MAXIMO = 366;
const LIMITE_DEFECTO = 8;

/** Perú no tiene horario de verano: Lima es UTC-5 todo el año. */
const inicioDiaLima = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

const redondear1 = (n: number) => Math.round(n * 10) / 10;

const ORDEN_MODALIDAD = ['MESA', 'RECOGER', 'DELIVERY'];

interface FilaTendencia {
  dia: string;
  respondidas: number;
  promedio: number | null;
}

interface FilaModalidad {
  modalidad: string;
  respondidas: number;
  promedio: number | null;
}

/**
 * Estadísticas de la encuesta posventa (WhatsApp) para el módulo Informes/Indicadores.
 * Filtra por fecha de envío (zona Lima). Distribución, tendencia y resumen usan
 * solo encuestas respondidas; el filtro de puntaje aplica únicamente a la lista.
 */
@Injectable()
export class EncuestasEstadisticaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerEstadisticas(filtro: FiltroEncuestasDto) {
    const hasta = filtro.hasta ?? hoyLima();
    const desde = filtro.desde ?? sumarDias(hasta, -(DIAS_RANGO_DEFECTO - 1));
    if (isNaN(Date.parse(`${desde}T00:00:00Z`)) || isNaN(Date.parse(`${hasta}T00:00:00Z`))) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'Fecha no válida' });
    }
    if (desde > hasta) {
      throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: '«Desde» es posterior a «Hasta»' });
    }
    if (diasEntre(desde, hasta).length > DIAS_RANGO_MAXIMO) {
      throw new BadRequestException({ codigo: 'RANGO_MUY_GRANDE', mensaje: 'El rango máximo es de 366 días' });
    }

    const pagina = filtro.pagina ?? 1;
    const limite = filtro.limite ?? LIMITE_DEFECTO;
    const modalidad = filtro.modalidad;
    const enviadoEn = { gte: inicioDiaLima(desde), lt: inicioDiaLima(sumarDias(hasta, 1)) };
    const relacionPedido = modalidad ? { pedido: { modalidad } } : {};

    const whereEnviadas = { enviada_en: enviadoEn, estado: { not: 'SIMULADA' }, ...relacionPedido };
    const whereRespondidas = {
      enviada_en: enviadoEn,
      estado: 'RESPONDIDA',
      puntaje: { not: null },
      ...relacionPedido,
    };
    const whereLista = { ...whereRespondidas, puntaje: filtro.puntaje ?? { not: null } };

    const filtroSqlModalidad = modalidad ? Prisma.sql`AND p.modalidad = ${modalidad}` : Prisma.empty;
    const filtroSqlRango = Prisma.sql`e.estado = 'RESPONDIDA' AND e.puntaje IS NOT NULL
      AND e.enviada_en >= ${enviadoEn.gte} AND e.enviada_en < ${enviadoEn.lt}`;

    const [enviadas, porPuntaje, tendenciaRows, modalidadRows, items, total] = await Promise.all([
      this.prisma.encuestaPosventa.count({ where: whereEnviadas }),
      this.prisma.encuestaPosventa.groupBy({
        by: ['puntaje'],
        where: whereRespondidas,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<FilaTendencia[]>`
        SELECT to_char(e.enviada_en AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS dia,
               COUNT(*)::int AS respondidas,
               AVG(e.puntaje)::float AS promedio
        FROM encuesta_posventa e
        JOIN pedido p ON p.id = e.pedido_id
        WHERE ${filtroSqlRango} ${filtroSqlModalidad}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<FilaModalidad[]>`
        SELECT p.modalidad AS modalidad,
               COUNT(*)::int AS respondidas,
               AVG(e.puntaje)::float AS promedio
        FROM encuesta_posventa e
        JOIN pedido p ON p.id = e.pedido_id
        WHERE ${filtroSqlRango}
        GROUP BY 1`,
      this.prisma.encuestaPosventa.findMany({
        where: whereLista,
        orderBy: { respondida_en: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { pedido: { select: { codigo: true, cliente_nombre: true, modalidad: true, canal: true } } },
      }),
      this.prisma.encuestaPosventa.count({ where: whereLista }),
    ]);

    // Distribución 1..5 (siempre las cinco filas, aunque sean cero)
    const conteo = new Map<number, number>();
    for (const fila of porPuntaje) {
      if (fila.puntaje != null) conteo.set(fila.puntaje, fila._count._all);
    }
    const distribucion = [1, 2, 3, 4, 5].map((puntaje) => ({ puntaje, cantidad: conteo.get(puntaje) ?? 0 }));
    const respondidas = distribucion.reduce((s, d) => s + d.cantidad, 0);
    const suma = distribucion.reduce((s, d) => s + d.puntaje * d.cantidad, 0);
    const satisfechos = distribucion.filter((d) => d.puntaje >= 4).reduce((s, d) => s + d.cantidad, 0);
    const insatisfechos = distribucion.filter((d) => d.puntaje <= 2).reduce((s, d) => s + d.cantidad, 0);
    const porcentaje = (n: number) => (respondidas > 0 ? redondear1((n / respondidas) * 100) : null);

    const porDia = new Map(tendenciaRows.map((f) => [f.dia, f]));
    const tendencia = diasEntre(desde, hasta).map((dia) => {
      const f = porDia.get(dia);
      return { dia, promedio: f?.promedio != null ? redondear1(f.promedio) : null, respondidas: f?.respondidas ?? 0 };
    });

    const porModalidad = modalidadRows
      .map((f) => ({
        modalidad: f.modalidad,
        promedio: f.promedio != null ? redondear1(f.promedio) : null,
        respondidas: f.respondidas,
      }))
      .sort((a, b) => {
        const ia = ORDEN_MODALIDAD.indexOf(a.modalidad);
        const ib = ORDEN_MODALIDAD.indexOf(b.modalidad);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.modalidad.localeCompare(b.modalidad);
      });

    // Quejas enlazadas a los pedidos de la página (una sola consulta)
    const pedidoIds = items.map((e) => e.pedido_id);
    const quejas = pedidoIds.length
      ? await this.prisma.quejaWhatsapp.findMany({
          where: { pedido_id: { in: pedidoIds } },
          select: { id: true, pedido_id: true },
          orderBy: { id: 'asc' },
        })
      : [];
    const quejaPorPedido = new Map<string, string>();
    for (const q of quejas) {
      if (q.pedido_id != null && !quejaPorPedido.has(q.pedido_id.toString())) {
        quejaPorPedido.set(q.pedido_id.toString(), q.id.toString());
      }
    }

    return {
      rango: { desde, hasta },
      resumen: {
        enviadas,
        respondidas,
        tasaRespuesta: enviadas > 0 ? redondear1((respondidas / enviadas) * 100) : null,
        promedio: respondidas > 0 ? redondear1(suma / respondidas) : null,
        satisfechos: porcentaje(satisfechos),
        insatisfechos: porcentaje(insatisfechos),
      },
      distribucion,
      tendencia,
      porModalidad,
      items: items.map((e) => ({
        id: e.id.toString(),
        fecha: (e.respondida_en ?? e.enviada_en).toISOString(),
        puntaje: e.puntaje,
        ...(e.comentario ? { comentario: e.comentario } : {}),
        pedidoCodigo: e.pedido.codigo,
        clienteNombre: e.pedido.cliente_nombre || 'Cliente',
        modalidad: e.pedido.modalidad,
        canal: e.pedido.canal,
        quejaId: quejaPorPedido.get(e.pedido_id.toString()) ?? null,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }
}
