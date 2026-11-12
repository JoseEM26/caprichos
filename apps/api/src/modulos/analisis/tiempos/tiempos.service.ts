import { Injectable } from '@nestjs/common';
import { ETAPAS_TIEMPOS, semaforoContraMeta, type CodigoEtapa } from '@caprichos/compartido';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { enTurno, resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';
import { minutosEntre, resumirMinutos } from '../comun/estadistica';
import { calcularEtapas, etapaActual, type PedidoParaTiempos } from './etapas';

/** Tope de pedidos leídos por consulta (92 días de un local mediano caben de sobra; si se pasa, se avisa). */
export const MAX_PEDIDOS_TIEMPOS = 5000;
const MAX_ATASCADOS = 30;
const HORAS_VENTANA_ATASCADOS = 24;

const SELECCION = {
  id: true,
  codigo: true,
  estado: true,
  modalidad: true,
  canal: true,
  pago_estado: true,
  creado_en: true,
  pago_coordinado_en: true,
  pasa_cocina_en: true,
  listo_en: true,
  entregado_mesa_en: true,
  entregado_en: true,
  anulado_en: true,
  tomado_en: true,
  salio_en: true,
  despachado_en: true,
  llego_en: true,
  cliente_nombre: true,
  mesa_nombre: true,
  comandas: { select: { area_id: true, estado: true, despejada_en: true, area: { select: { nombre: true } } } },
  lineas: { select: { despachado_en: true } },
  cobros: {
    where: { anulado_en: null },
    orderBy: { en: 'desc' as const },
    take: 1,
    select: { en: true, caja: { select: { cerrada_en: true } } },
  },
} as const;

/** A dónde lleva el enlace de cada etapa (pantalla donde se destraba el pedido). */
const PANTALLA_DE_ETAPA: Record<CodigoEtapa, string> = {
  aprobacion: '/admin/caja',
  a_cocina: '/admin/caja',
  cocina: '/admin/cocina',
  espera_despacho: '/admin/cocina',
  armado: '/admin/cocina',
  entrega_mesa: '/admin/caja',
  recojo: '/admin/caja',
  reparto_espera: '/admin/repartos',
  reparto_salida: '/admin/repartos',
  reparto_ruta: '/admin/repartos',
  reparto_entrega: '/admin/repartos',
  cobro: '/admin/caja',
  cierre: '/admin/cierre',
};

@Injectable()
export class TiemposService {
  constructor(private readonly prisma: PrismaService) {}

  /** Metas vigentes en minutos por etapa: lo guardado en Configuración o el valor por defecto. */
  async metas(): Promise<Record<string, number>> {
    const filas = await this.prisma.parametro.findMany({ where: { clave: { in: ETAPAS_TIEMPOS.map((e) => e.clave) } } });
    const guardado = new Map(filas.map((f) => [f.clave, Number(f.valor)]));
    return Object.fromEntries(
      ETAPAS_TIEMPOS.map((e) => {
        const v = guardado.get(e.clave);
        return [e.codigo, v != null && Number.isFinite(v) && v > 0 ? v : e.metaDefecto];
      }),
    );
  }

  /** Resumen del pipeline en el rango y filtros pedidos. */
  async resumen(filtros: FiltrosAnalisis, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const [metas, filas] = await Promise.all([
      this.metas(),
      this.prisma.pedido.findMany({
        where: {
          creado_en: { gte: rango.inicio, lt: rango.fin },
          ...(rango.modalidad ? { modalidad: rango.modalidad } : {}),
          ...(rango.canal ? { canal: rango.canal } : {}),
        },
        select: SELECCION,
        orderBy: { creado_en: 'desc' },
        take: MAX_PEDIDOS_TIEMPOS + 1,
      }),
    ]);
    const truncado = filas.length > MAX_PEDIDOS_TIEMPOS;
    const pedidos = (truncado ? filas.slice(0, MAX_PEDIDOS_TIEMPOS) : filas).filter((p) => !rango.turno || enTurno(p.creado_en, rango.turno));

    const anulados = pedidos.filter((p) => p.estado === 'ANULADO');
    const vigentes = pedidos.filter((p) => p.estado !== 'ANULADO');
    const calculos = vigentes.map((p) => calcularEtapas(p as unknown as PedidoParaTiempos));

    const etapas = ETAPAS_TIEMPOS.map((e) => {
      const r = resumirMinutos(calculos.map((c) => c.minutos[e.codigo]));
      const meta = metas[e.codigo];
      return {
        codigo: e.codigo,
        paso: e.paso,
        nombre: e.nombre,
        detalle: e.detalle,
        modalidades: e.modalidades ?? null,
        compite: e.compite,
        meta,
        ...r,
        sinDato: r.n === 0,
        semaforo: semaforoContraMeta(r.promedio, meta),
      };
    });
    const mas = etapas.filter((e) => e.compite && e.promedio != null).sort((a, b) => (b.promedio as number) - (a.promedio as number))[0];

    // Comparativo de las áreas de cocina (todas las que hayan tenido comandas en el rango)
    const porArea = new Map<string, Array<number | null>>();
    for (const c of calculos) for (const a of c.areas) porArea.set(a.nombre, [...(porArea.get(a.nombre) ?? []), a.minutos]);
    const metaCocina = metas.cocina;
    const areas = [...porArea.entries()]
      .map(([nombre, v]) => {
        const r = resumirMinutos(v);
        return { nombre, ...r, meta: metaCocina, semaforo: semaforoContraMeta(r.promedio, metaCocina) };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const minAnulado = resumirMinutos(anulados.map((p) => minutosEntre(p.creado_en, p.anulado_en)));
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      filtros: { modalidad: rango.modalidad, canal: rango.canal, turno: rango.turno },
      truncado,
      limite: MAX_PEDIDOS_TIEMPOS,
      pedidos: {
        entran: pedidos.length,
        considerados: vigentes.length,
        enCurso: vigentes.filter((p) => p.estado !== 'ENTREGADO').length,
      },
      anulados: { n: anulados.length, minutosPromedio: minAnulado.promedio, minutosMediana: minAnulado.mediana },
      etapaMasLenta: mas ? mas.codigo : null,
      etapas,
      areas,
    };
  }

  /** Pedidos que llevan en su etapa actual más minutos que la meta (ventana: últimas 24 horas). */
  async atascados(ahora: Date = new Date()) {
    const desde = new Date(ahora.getTime() - HORAS_VENTANA_ATASCADOS * 3_600_000);
    const [metas, filas] = await Promise.all([
      this.metas(),
      this.prisma.pedido.findMany({
        where: {
          creado_en: { gte: desde },
          OR: [{ estado: { in: ['COLA', 'NUEVO', 'PREPARANDO', 'LISTO', 'EN_CAMINO'] } }, { estado: 'ENTREGADO', pago_estado: { not: 'PAGADO' } }],
        },
        select: SELECCION,
        orderBy: { creado_en: 'asc' },
        take: 300,
      }),
    ]);
    const nombres = new Map<string, string>(ETAPAS_TIEMPOS.map((e) => [e.codigo, e.nombre]));
    const items = filas
      .map((p) => {
        const act = etapaActual(p as unknown as PedidoParaTiempos);
        if (!act) return null;
        const minutos = Math.max(0, Math.round(((ahora.getTime() - act.desde.getTime()) / 60000) * 10) / 10);
        const meta = metas[act.codigo];
        return {
          id: p.id.toString(),
          codigo: p.codigo,
          modalidad: p.modalidad,
          mesa: p.mesa_nombre ?? null,
          etapa: act.codigo,
          etapaNombre: nombres.get(act.codigo) ?? act.codigo,
          areasPendientes: act.areasPendientes ?? [],
          desde: act.desde.toISOString(),
          minutos,
          meta,
          veces: Math.round((minutos / meta) * 10) / 10,
          semaforo: semaforoContraMeta(minutos, meta),
          enlace: act.codigo === 'cierre' ? PANTALLA_DE_ETAPA.cierre : `${PANTALLA_DE_ETAPA[act.codigo]}${PANTALLA_DE_ETAPA[act.codigo] === '/admin/caja' ? `?pedido=${p.id}` : ''}`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.minutos > x.meta)
      .sort((a, b) => b.veces - a.veces);
    return { generadoEn: ahora.toISOString(), total: items.length, items: items.slice(0, MAX_ATASCADOS) };
  }
}
