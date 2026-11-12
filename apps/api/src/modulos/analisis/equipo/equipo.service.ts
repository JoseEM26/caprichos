import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AsistenciaCorreccionesService, AsistenciaService } from '../../asistencia';
import { CierreService } from '../../cierre';
import { pedidoDebeEstarCobrado } from '../../pedidos';
import { resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';
import { minutosEntre, resumirMinutos } from '../comun/estadistica';
import { jornadasDelRango } from './jornadas';

export const MAX_PEDIDOS_EQUIPO = 5000;
/** Filas que muestra cada lista del tablero de huecos (el total real va aparte). */
export const MAX_FILAS_HUECOS = 50;
const DIAS_ENTREGADOS_SIN_COBRAR = 92;

const r2 = (n: number) => Math.round(n * 100) / 100;

type Grupo = Map<string, { n: number; monto: number; min: Array<number | null> }>;

@Injectable()
export class EquipoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    private readonly correcciones: AsistenciaCorreccionesService,
    private readonly cierre: CierreService,
  ) {}

  private async nombres(ids: bigint[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const personas = await this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } });
    return new Map(personas.map((p) => [String(p.party_id), [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
  }

  /** Asistencia, puntualidad y productividad del rango. `esAdmin` decide si se incluyen las filas por persona. */
  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const [{ jornadas, truncado: jornadasTruncadas }, atendidos, cobros] = await Promise.all([
      jornadasDelRango(this.asistencia, this.correcciones, rango.desde, rango.hasta, ahora),
      this.prisma.pedido.findMany({
        where: { canal: 'MOZO', estado: { not: 'ANULADO' }, creado_en: { gte: rango.inicio, lt: rango.fin } },
        select: {
          total: true,
          creado_en: true,
          entregado_mesa_en: true,
          entregado_en: true,
          historial: { where: { estado_anterior: null }, take: 1, select: { por_party_id: true } },
        },
        orderBy: { creado_en: 'desc' },
        take: MAX_PEDIDOS_EQUIPO + 1,
      }),
      this.prisma.cobro.findMany({
        where: { anulado_en: null, en: { gte: rango.inicio, lt: rango.fin } },
        select: { cobrado_por: true, total: true, en: true, pedido: { select: { creado_en: true } } },
        orderBy: { en: 'desc' },
        take: MAX_PEDIDOS_EQUIPO + 1,
      }),
    ]);
    const truncado = atendidos.length > MAX_PEDIDOS_EQUIPO || cobros.length > MAX_PEDIDOS_EQUIPO;
    const pedidosMozo = atendidos.slice(0, MAX_PEDIDOS_EQUIPO);
    const cobrosOk = cobros.slice(0, MAX_PEDIDOS_EQUIPO);

    // Asistencia por día (agregado: lo ven ADMIN y SUPERVISOR)
    const porDia = new Map<string, { fecha: string; programadas: number; presentes: number; tardanzas: number; faltas: number; minutosTarde: number }>();
    for (const j of jornadas) {
      const d = porDia.get(j.fecha) ?? { fecha: j.fecha, programadas: 0, presentes: 0, tardanzas: 0, faltas: 0, minutosTarde: 0 };
      if (j.programada) d.programadas++;
      if (j.presente) d.presentes++;
      if (j.estado === 'TARDANZA') {
        d.tardanzas++;
        d.minutosTarde += j.tardanzaMin;
      }
      if (j.estado === 'FALTA') d.faltas++;
      porDia.set(j.fecha, d);
    }
    const dias = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const presentes = dias.reduce((s, d) => s + d.presentes, 0);
    const tardanzas = dias.reduce((s, d) => s + d.tardanzas, 0);
    const faltas = dias.reduce((s, d) => s + d.faltas, 0);

    // Productividad: quién registró el pedido (mozo) y quién cobró (caja)
    const mozos: Grupo = new Map();
    for (const p of pedidosMozo) {
      const quien = p.historial[0]?.por_party_id;
      if (quien == null) continue;
      const k = String(quien);
      const m = mozos.get(k) ?? { n: 0, monto: 0, min: [] };
      m.n++;
      m.monto += Number(p.total);
      m.min.push(minutosEntre(p.creado_en, p.entregado_mesa_en ?? p.entregado_en));
      mozos.set(k, m);
    }
    const cajeros: Grupo = new Map();
    for (const c of cobrosOk) {
      const k = String(c.cobrado_por);
      const m = cajeros.get(k) ?? { n: 0, monto: 0, min: [] };
      m.n++;
      m.monto += Number(c.total);
      m.min.push(minutosEntre(c.pedido.creado_en, c.en));
      cajeros.set(k, m);
    }
    const resumenGrupo = (g: Grupo) => {
      const n = [...g.values()].reduce((s, x) => s + x.n, 0);
      const monto = [...g.values()].reduce((s, x) => s + x.monto, 0);
      const t = resumirMinutos([...g.values()].flatMap((x) => x.min));
      return { personas: g.size, pedidos: n, ticketPromedio: n ? r2(monto / n) : null, minutosPromedio: t.promedio, minutosMediana: t.mediana };
    };

    let personas: unknown = null;
    if (esAdmin) {
      const ids = new Set<string>([...mozos.keys(), ...cajeros.keys(), ...jornadas.map((j) => String(j.pid))]);
      const nom = await this.nombres([...ids].map((i) => BigInt(i)));
      const nombre = (id: string) => nom.get(id) ?? `Persona ${id}`;
      const asis = new Map<string, { dias: number; tardanzas: number; minutosTarde: number; faltas: number }>();
      for (const j of jornadas) {
        const k = String(j.pid);
        const a = asis.get(k) ?? { dias: 0, tardanzas: 0, minutosTarde: 0, faltas: 0 };
        if (j.presente) a.dias++;
        if (j.estado === 'TARDANZA') {
          a.tardanzas++;
          a.minutosTarde += j.tardanzaMin;
        }
        if (j.estado === 'FALTA') a.faltas++;
        asis.set(k, a);
      }
      const prod = (g: Grupo) =>
        [...g.entries()]
          .map(([id, x]) => ({ id, nombre: nombre(id), pedidos: x.n, ticketPromedio: x.n ? r2(x.monto / x.n) : null, minutosPromedio: resumirMinutos(x.min).promedio }))
          .sort((a, b) => b.pedidos - a.pedidos);
      personas = {
        asistencia: [...asis.entries()].map(([id, a]) => ({ id, nombre: nombre(id), ...a })).sort((a, b) => b.minutosTarde - a.minutosTarde),
        mozos: prod(mozos),
        cajeros: prod(cajeros),
      };
    }

    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      porPersonaVisible: esAdmin,
      truncado: truncado || jornadasTruncadas,
      limite: MAX_PEDIDOS_EQUIPO,
      asistencia: {
        porDia: dias,
        totales: {
          presentes,
          tardanzas,
          faltas,
          puntualidadPct: presentes ? Math.round(((presentes - tardanzas) / presentes) * 1000) / 10 : null,
          minutosTarde: dias.reduce((s, d) => s + d.minutosTarde, 0),
        },
      },
      productividad: { mozos: resumenGrupo(mozos), cajeros: resumenGrupo(cajeros) },
      personas,
    };
  }

  /**
   * Tablero permanente de huecos (sin rango de fechas):
   *  - sinCobrar: pendientes de cobro de cualquier día (misma lista que el Cierre).
   *  - sinTerminar: estado distinto de ENTREGADO/ANULADO (misma lista que bloquea el Cierre).
   *  - entregadosSinCobrar: ENTREGADO que según la regla de cobro debía estar cobrado y no lo está (últimos 92 días).
   */
  async huecos(ahora: Date = new Date()) {
    const desde = new Date(ahora.getTime() - DIAS_ENTREGADOS_SIN_COBRAR * 86_400_000);
    const [sinCobrar, sinTerminar, entregados] = await Promise.all([
      this.cierre.listarPendientesDeCobro(),
      this.cierre.pedidosSinTerminar(),
      this.prisma.pedido.findMany({
        where: { estado: 'ENTREGADO', pago_estado: { not: 'PAGADO' }, creado_en: { gte: desde }, cobros: { none: { anulado_en: null } } },
        orderBy: { creado_en: 'asc' },
        take: 500,
        select: { id: true, codigo: true, canal: true, modalidad: true, estado: true, pago_estado: true, pago_metodo: true, es_personal: true, total: true, creado_en: true, planPago: { select: { medio: true, monto: true } } },
      }),
    ]);
    const entregadosSinCobrar = entregados
      .filter((p) => pedidoDebeEstarCobrado(p))
      .map((p) => ({ id: Number(p.id), codigo: p.codigo, canal: p.canal, modalidad: p.modalidad, estado: p.estado, pagoEstado: p.pago_estado, total: Number(p.total), fecha: p.creado_en }));
    const lista = <T extends { fecha: Date }>(xs: T[]) => ({
      total: xs.length,
      antiguo: xs.length ? xs.reduce((a, x) => (x.fecha < a ? x.fecha : a), xs[0].fecha) : null,
      items: xs.slice(0, MAX_FILAS_HUECOS),
    });
    return {
      generadoEn: ahora.toISOString(),
      limiteFilas: MAX_FILAS_HUECOS,
      sinCobrar: lista(sinCobrar),
      sinTerminar: lista(sinTerminar),
      entregadosSinCobrar: lista(entregadosSinCobrar),
    };
  }
}
