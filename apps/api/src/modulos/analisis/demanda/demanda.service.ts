import { Injectable } from '@nestjs/common';
import { semaforoContraMeta } from '@caprichos/compartido';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { enTurno, horaLima, resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';
import { minutosEntre, resumirMinutos } from '../comun/estadistica';
import { TiemposService } from '../tiempos/tiempos.service';

/** Tope de pedidos leídos por consulta (si se pasa, se avisa y se leen los más recientes). */
export const MAX_PEDIDOS_DEMANDA = 5000;
const MAX_COMANDAS_VIVO = 500;
const MAX_MOTIVOS = 10;
const HORAS_VENTANA_VIVO = 24;
const SIN_MOTIVO = 'Sin motivo escrito';

export const ETAPA_ANULACION: Record<string, string> = {
  COLA: 'En cola (antes de cocina)',
  NUEVO: 'Nuevo (por aprobar)',
  PREPARANDO: 'En preparación',
  LISTO: 'Listo (sin entregar)',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Ya entregado',
};

/** Etapa en que estaba el pedido al anularse: la del historial; si no hay fila, se deduce de las horas guardadas. */
export function etapaDeAnulacion(p: {
  historial?: Array<{ estado_anterior: string | null }>;
  salio_en?: Date | null;
  listo_en?: Date | null;
  pasa_cocina_en?: Date | null;
}): string {
  const h = p.historial?.[0]?.estado_anterior;
  if (h) return ETAPA_ANULACION[h] ?? h;
  if (p.salio_en) return ETAPA_ANULACION.EN_CAMINO;
  if (p.listo_en) return ETAPA_ANULACION.LISTO;
  if (p.pasa_cocina_en) return ETAPA_ANULACION.PREPARANDO;
  return ETAPA_ANULACION.COLA;
}

const porcentaje = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : null);
/** Lunes = 0 … domingo = 6, en Lima. */
const diaSemanaLima = (d: Date) => (new Date(d.getTime() - 5 * 3_600_000).getUTCDay() + 6) % 7;
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type PedidoAnulado = {
  anulado_por: bigint | null;
  motivo_anulacion: string | null;
  creado_en: Date;
  anulado_en: Date | null;
  salio_en: Date | null;
  listo_en: Date | null;
  pasa_cocina_en: Date | null;
  historial: Array<{ estado_anterior: string | null }>;
};

@Injectable()
export class DemandaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiempos: TiemposService,
  ) {}

  async resumen(filtros: FiltrosAnalisis, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const filas = await this.prisma.pedido.findMany({
      where: {
        creado_en: { gte: rango.inicio, lt: rango.fin },
        ...(rango.modalidad ? { modalidad: rango.modalidad } : {}),
        ...(rango.canal ? { canal: rango.canal } : {}),
      },
      select: {
        id: true,
        estado: true,
        modalidad: true,
        creado_en: true,
        eta_min: true,
        eta_max: true,
        salio_en: true,
        llego_en: true,
        entregado_en: true,
        anulado_en: true,
        anulado_por: true,
        motivo_anulacion: true,
        pasa_cocina_en: true,
        listo_en: true,
        historial: { where: { estado_nuevo: 'ANULADO' }, orderBy: { en: 'desc' }, take: 1, select: { estado_anterior: true } },
      },
      orderBy: { creado_en: 'desc' },
      take: MAX_PEDIDOS_DEMANDA + 1,
    });
    const truncado = filas.length > MAX_PEDIDOS_DEMANDA;
    const pedidos = (truncado ? filas.slice(0, MAX_PEDIDOS_DEMANDA) : filas).filter((p) => !rango.turno || enTurno(p.creado_en, rango.turno));

    const anulados = pedidos.filter((p) => p.estado === 'ANULADO');
    const rechazados = pedidos.filter((p) => p.estado === 'RECHAZADO').length;
    const validos = pedidos.filter((p) => p.estado !== 'ANULADO' && p.estado !== 'RECHAZADO');

    // Mapa de calor: día de la semana (lunes primero) × hora de Lima
    const mapa = DIAS.map(() => Array<number>(24).fill(0));
    for (const p of validos) mapa[diaSemanaLima(p.creado_en)][horaLima(p.creado_en)] += 1;
    const celdas = mapa.flatMap((fila, d) => fila.map((n, h) => ({ dia: DIAS[d], hora: h, pedidos: n }))).filter((c) => c.pedidos > 0);
    const pico = celdas.sort((a, b) => b.pedidos - a.pedidos)[0] ?? null;

    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      filtros: { modalidad: rango.modalidad, canal: rango.canal, turno: rango.turno },
      truncado,
      limite: MAX_PEDIDOS_DEMANDA,
      pedidos: { entran: pedidos.length, validos: validos.length },
      mapa: { dias: DIAS, valores: mapa, pico },
      cumplimiento: this.cumplimiento(validos),
      anulados: await this.anulados(anulados, pedidos.length, rechazados),
    };
  }

  /**
   * De los delivery entregados con tiempo prometido (eta_min/eta_max, que se guarda al salir el repartidor),
   * % que llegó dentro del máximo prometido: minutos desde la salida (salio_en) hasta la llegada (llego_en o entregado_en).
   * Las demás modalidades no guardan promesa: no se miden y se dice «sin dato».
   */
  private cumplimiento(
    validos: Array<{ estado: string; modalidad: string; eta_max: number | null; salio_en: Date | null; llego_en: Date | null; entregado_en: Date | null }>,
  ) {
    const entregados = validos.filter((p) => p.estado === 'ENTREGADO');
    const delivery = entregados.filter((p) => p.modalidad === 'DELIVERY');
    const medibles = delivery.filter((p) => p.eta_max != null && p.salio_en && (p.llego_en ?? p.entregado_en));
    const validas = medibles
      .map((p) => ({ min: minutosEntre(p.salio_en, p.llego_en ?? p.entregado_en), prometido: p.eta_max as number }))
      .filter((f): f is { min: number; prometido: number } => f.min != null);
    const cumplieron = validas.filter((f) => f.min <= f.prometido).length;
    const tarde = validas.filter((f) => f.min > f.prometido).map((f) => f.min - f.prometido);
    return {
      evaluados: validas.length,
      cumplieron,
      porcentaje: porcentaje(cumplieron, validas.length),
      retrasoPromedioMin: resumirMinutos(tarde).promedio,
      deliverySinPromesa: delivery.length - validas.length,
      otrasModalidadesSinDato: entregados.length - delivery.length,
      sinDato: validas.length === 0,
    };
  }

  private async anulados(anulados: PedidoAnulado[], totalPedidos: number, rechazados: number) {
    const motivos = new Map<string, { motivo: string; n: number }>();
    const etapas = new Map<string, number>();
    const quienes = new Map<string, number>();
    for (const p of anulados) {
      const texto = (p.motivo_anulacion ?? '').trim();
      const k = texto.toLowerCase() || SIN_MOTIVO;
      const m = motivos.get(k) ?? { motivo: texto || SIN_MOTIVO, n: 0 };
      m.n += 1;
      motivos.set(k, m);
      const e = etapaDeAnulacion(p);
      etapas.set(e, (etapas.get(e) ?? 0) + 1);
      const q = p.anulado_por != null ? p.anulado_por.toString() : 'sin';
      quienes.set(q, (quienes.get(q) ?? 0) + 1);
    }
    const ids = [...quienes.keys()].filter((k) => k !== 'sin').map((k) => BigInt(k));
    const personas = ids.length
      ? await this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } })
      : [];
    const nombre = new Map(personas.map((x) => [x.party_id.toString(), `${x.nombres} ${x.apellidos ?? ''}`.trim()]));
    const n = anulados.length;
    return {
      n,
      porcentaje: porcentaje(n, totalPedidos),
      rechazados,
      minutos: resumirMinutos(anulados.map((p) => minutosEntre(p.creado_en, p.anulado_en))),
      motivos: [...motivos.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, MAX_MOTIVOS)
        .map((m) => ({ ...m, porcentaje: porcentaje(m.n, n) })),
      etapas: [...etapas.entries()].sort((a, b) => b[1] - a[1]).map(([etapa, c]) => ({ etapa, n: c, porcentaje: porcentaje(c, n) })),
      quienes: [...quienes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, c]) => ({ nombre: id === 'sin' ? 'Sin dato' : (nombre.get(id) ?? 'Sin dato'), n: c })),
    };
  }

  /** Comandas que están en cocina ahora, por área: cuántas, cuánto lleva la más antigua y semáforo contra la meta de cocina. */
  async vivo(ahora: Date = new Date()) {
    const [metas, areas, comandas] = await Promise.all([
      this.tiempos.metas(),
      this.prisma.areaCocina.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.comandaArea.findMany({
        where: {
          estado: 'EN_COCINA',
          llego_en: { gte: new Date(ahora.getTime() - HORAS_VENTANA_VIVO * 3_600_000) },
          pedido: { estado: { notIn: ['ANULADO', 'RECHAZADO', 'ENTREGADO'] } },
        },
        select: { area_id: true, llego_en: true },
        take: MAX_COMANDAS_VIVO,
      }),
    ]);
    const meta = metas.cocina;
    const filas = areas.map((a) => {
      const esperas = comandas.filter((c) => c.area_id === a.id).map((c) => Math.max(0, minutosEntre(c.llego_en, ahora) ?? 0));
      const r = resumirMinutos(esperas);
      return { nombre: a.nombre, enCola: r.n, masAntiguaMin: r.maximo, promedioMin: r.promedio, meta, semaforo: semaforoContraMeta(r.maximo, meta) };
    });
    return { generadoEn: ahora.toISOString(), meta, total: filas.reduce((s, f) => s + f.enCola, 0), areas: filas };
  }
}
