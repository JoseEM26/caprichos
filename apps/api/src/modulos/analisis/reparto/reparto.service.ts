import { Injectable } from '@nestjs/common';
import { semaforoContraMeta } from '@caprichos/compartido';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AsistenciaCorreccionesService, AsistenciaService } from '../../asistencia';
import { efectivoDelRepartidor } from '../../caja';
import { enTurno, resolverFiltros, TURNOS, MAX_DIAS_ANALISIS, type FiltrosAnalisis } from '../comun/filtros';
import { minutosEntre, resumirMinutos } from '../comun/estadistica';
import { jornadasDelRango } from '../equipo/jornadas';

export const MAX_PEDIDOS_REPARTO = 5000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const centimos = (n: unknown) => Math.round(Number(n) * 100);

@Injectable()
export class RepartoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    private readonly correcciones: AsistenciaCorreccionesService,
  ) {}

  /**
   * Entregas por zona, productividad por repartidor y efectivo por rendir.
   * `esAdmin` false: sin filas por persona (solo totales).
   */
  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const [zonas, filas, jornadas] = await Promise.all([
      this.prisma.zonaReparto.findMany({ select: { id: true, codigo: true, tarifa: true, minutos_max: true, activa: true }, orderBy: { codigo: 'asc' }, take: 200 }),
      this.prisma.pedido.findMany({
        where: { modalidad: 'DELIVERY', estado: { not: 'ANULADO' }, creado_en: { gte: rango.inicio, lt: rango.fin }, ...(rango.canal ? { canal: rango.canal } : {}) },
        select: { zona_id: true, estado: true, creado_en: true, entregado_en: true, salio_en: true, llego_en: true, repartidor_party_id: true },
        orderBy: { creado_en: 'desc' },
        take: MAX_PEDIDOS_REPARTO + 1,
      }),
      jornadasDelRango(this.asistencia, this.correcciones, rango.desde, rango.hasta, ahora),
    ]);
    const truncado = filas.length > MAX_PEDIDOS_REPARTO;
    const pedidos = (truncado ? filas.slice(0, MAX_PEDIDOS_REPARTO) : filas).filter((p) => !rango.turno || enTurno(p.creado_en, rango.turno));

    // --- Zonas: pedidos, tiempo total (pedido → entregado) y calor por turno
    const turnos = [...TURNOS];
    const zonaDe = new Map(zonas.map((z) => [String(z.id), z]));
    const acum = new Map<string, { pedidos: number; entregados: number; min: Array<number | null>; turnos: number[] }>();
    let sinZona = 0;
    for (const p of pedidos) {
      if (p.zona_id == null) {
        sinZona++;
        continue;
      }
      const k = String(p.zona_id);
      const a = acum.get(k) ?? { pedidos: 0, entregados: 0, min: [], turnos: turnos.map(() => 0) };
      a.pedidos++;
      if (p.estado === 'ENTREGADO') {
        a.entregados++;
        a.min.push(minutosEntre(p.creado_en, p.entregado_en));
      }
      const t = turnos.findIndex((x) => enTurno(p.creado_en, x));
      if (t >= 0) a.turnos[t]++;
      acum.set(k, a);
    }
    const zonasOut = [...acum.entries()]
      .map(([id, a]) => {
        const z = zonaDe.get(id);
        const r = resumirMinutos(a.min);
        const meta = z?.minutos_max ?? null;
        return {
          id,
          zona: z?.codigo ?? `Zona ${id}`,
          activa: z?.activa ?? false,
          tarifa: z ? Number(z.tarifa) : null,
          pedidos: a.pedidos,
          entregados: a.entregados,
          minutosPromedio: r.promedio,
          minutosMediana: r.mediana,
          minutosP90: r.p90,
          metaMin: meta,
          semaforo: meta ? semaforoContraMeta(r.promedio, meta) : 'sin_dato',
          porTurno: a.turnos,
        };
      })
      .sort((a, b) => b.pedidos - a.pedidos);

    // --- Repartidores: entregas, minutos por entrega (salida → entrega) y horas trabajadas (asistencia)
    const horas = new Map<string, number>();
    for (const j of jornadas.jornadas) horas.set(String(j.pid), (horas.get(String(j.pid)) ?? 0) + j.trabajadaMin);
    const porRep = new Map<string, { entregas: number; min: Array<number | null> }>();
    for (const p of pedidos) {
      if (p.estado !== 'ENTREGADO' || p.repartidor_party_id == null) continue;
      const k = String(p.repartidor_party_id);
      const a = porRep.get(k) ?? { entregas: 0, min: [] };
      a.entregas++;
      a.min.push(minutosEntre(p.salio_en, p.llego_en ?? p.entregado_en));
      porRep.set(k, a);
    }
    const entregasTotal = [...porRep.values()].reduce((s, a) => s + a.entregas, 0);
    const minTotal = resumirMinutos([...porRep.values()].flatMap((a) => a.min));
    const horasTotal = [...porRep.keys()].reduce((s, k) => s + (horas.get(k) ?? 0), 0) / 60;
    const porHora = (entregas: number, h: number) => (h > 0 ? Math.round((entregas / h) * 100) / 100 : null);

    let repartidores: unknown = null;
    if (esAdmin && porRep.size) {
      const ids = [...porRep.keys()].map((i) => BigInt(i));
      const personas = await this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } });
      const nom = new Map(personas.map((p) => [String(p.party_id), [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
      repartidores = [...porRep.entries()]
        .map(([id, a]) => {
          const h = (horas.get(id) ?? 0) / 60;
          return {
            id,
            nombre: nom.get(id) ?? `Repartidor ${id}`,
            entregas: a.entregas,
            minutosPorEntrega: resumirMinutos(a.min).promedio,
            horasTrabajadas: h > 0 ? r2(h) : null,
            entregasPorHora: porHora(a.entregas, h),
          };
        })
        .sort((a, b) => b.entregas - a.entregas);
    }

    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      porPersonaVisible: esAdmin,
      truncado,
      limite: MAX_PEDIDOS_REPARTO,
      turnos,
      totales: { pedidos: pedidos.length, sinZona, entregas: entregasTotal },
      zonas: zonasOut,
      productividad: {
        repartidores: porRep.size,
        entregas: entregasTotal,
        minutosPorEntrega: minTotal.promedio,
        horasTrabajadas: horasTotal > 0 ? r2(horasTotal) : null,
        entregasPorHora: porHora(entregasTotal, horasTotal),
        porPersona: repartidores,
      },
    };
  }

  /**
   * Efectivo por rendir (siempre «ahora»): efectivo contra entrega de los delivery entregados en los últimos 92 días
   * menos lo ya liquidado por el repartidor. «Desde cuándo» = entrega más antigua que sigue sin cubrirse (el repartidor
   * salda primero lo más viejo). Por persona solo para el ADMIN.
   */
  async porRendir(esAdmin: boolean, ahora: Date = new Date()) {
    const desde = new Date(ahora.getTime() - MAX_DIAS_ANALISIS * 86_400_000);
    const [pedidos, liquidaciones] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { modalidad: 'DELIVERY', estado: 'ENTREGADO', repartidor_party_id: { not: null }, entregado_en: { gte: desde } },
        select: {
          repartidor_party_id: true,
          entregado_en: true,
          total: true,
          pago_metodo: true,
          cobros: { select: { anulado_en: true, total: true } },
          planPago: { select: { medio: true, monto: true } },
        },
        orderBy: { entregado_en: 'asc' },
        take: MAX_PEDIDOS_REPARTO,
      }),
      this.prisma.liquidacion.findMany({ where: { en: { gte: desde } }, select: { repartidor_party_id: true, esperado: true }, take: MAX_PEDIDOS_REPARTO }),
    ]);
    const liquidado = new Map<string, number>();
    for (const l of liquidaciones) liquidado.set(String(l.repartidor_party_id), (liquidado.get(String(l.repartidor_party_id)) ?? 0) + centimos(l.esperado));

    const porRep = new Map<string, Array<{ c: number; en: Date | null }>>();
    for (const p of pedidos) {
      const c = efectivoDelRepartidor(p as never);
      if (c <= 0) continue;
      const k = String(p.repartidor_party_id);
      porRep.set(k, [...(porRep.get(k) ?? []), { c, en: p.entregado_en }]);
    }
    const filas: Array<{ id: string; pendiente: number; desde: Date | null; pedidos: number }> = [];
    for (const [id, lista] of porRep) {
      let saldado = liquidado.get(id) ?? 0;
      let pendiente = 0;
      let primero: Date | null = null;
      let n = 0;
      for (const x of lista) {
        const cubre = Math.min(saldado, x.c);
        saldado -= cubre;
        if (x.c - cubre > 0) {
          pendiente += x.c - cubre;
          n++;
          if (!primero) primero = x.en;
        }
      }
      if (pendiente > 0) filas.push({ id, pendiente: pendiente / 100, desde: primero, pedidos: n });
    }
    const total = r2(filas.reduce((s, f) => s + f.pendiente, 0));
    const masAntigua = filas.reduce<Date | null>((a, f) => (f.desde && (!a || f.desde < a) ? f.desde : a), null);

    let porPersona: unknown = null;
    if (esAdmin && filas.length) {
      const personas = await this.prisma.person.findMany({ where: { party_id: { in: filas.map((f) => BigInt(f.id)) } }, select: { party_id: true, nombres: true, apellidos: true } });
      const nom = new Map(personas.map((p) => [String(p.party_id), [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
      porPersona = filas
        .map((f) => ({ id: f.id, nombre: nom.get(f.id) ?? `Repartidor ${f.id}`, pendiente: f.pendiente, desde: f.desde, pedidos: f.pedidos }))
        .sort((a, b) => b.pendiente - a.pendiente);
    }
    return {
      generadoEn: ahora.toISOString(),
      ventanaDias: MAX_DIAS_ANALISIS,
      porPersonaVisible: esAdmin,
      total,
      repartidoresConSaldo: filas.length,
      pedidosPendientes: filas.reduce((s, f) => s + f.pedidos, 0),
      desde: masAntigua,
      porPersona,
    };
  }
}
