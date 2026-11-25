import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { PropinasService } from '../propinas/propinas.service';
import { participaEnPropinas } from '../propinas/propinas-reparto.util';
import { AsistenciaService } from './asistencia.service';
import { LineaPropina, lineasDePersona, repartirDias, totalLineas } from './planilla-propinas.calculo';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const sumarUnDia = (iso: string) => isoDe(new Date(fechaDb(iso).getTime() + 86_400_000));
const mesDeReparto = (r: { anio: number; mes: number }) => `${r.anio}-${String(r.mes).padStart(2, '0')}`;

/** Lo que se suma de propinas en la planilla de una persona en un período. */
export interface PropinasPeriodo {
  total: number;
  lineas: LineaPropina[];
}

/**
 * Propinas por día para la planilla: reparte la propina COBRADA de cada día de Lima entre quienes trabajaron ese
 * día (según sus horas netas; todos menos ADMIN salvo excepción). Registra lo pagado para no pagar dos veces.
 */
@Injectable()
export class PlanillaPropinasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propinas: PropinasService,
    private readonly asistencia: AsistenciaService,
  ) {}

  /** Reparto de cada día con propina (o con algo ya pagado) entre `desde` y `hasta`. */
  async repartoDelRango(desde: string, hasta: string, diasPagados: string[] = [], ahora = new Date()) {
    const totales = await this.propinas.totalesPorDia(desde, hasta);
    const mapa = new Set(totales.map((t) => t.fecha));
    // Un día ya pagado cuya propina bajó a 0 igual entra (con total 0) para poder restar lo pagado
    for (const f of diasPagados) if (!mapa.has(f) && f >= desde && f <= hasta) totales.push({ fecha: f, total: 0 });
    const conPropina = new Set(totales.filter((t) => t.total !== 0).map((t) => t.fecha));
    if (!conPropina.size) return repartirDias(totales, {});
    const horasDia = await this.asistencia.horasNetasPorDia(desde, hasta, conPropina, ahora);
    const ids = [...new Set(Object.values(horasDia).flatMap((l) => l.map((h) => h.partyId)))].map(BigInt);
    const [personas, cuentas] = await Promise.all([
      this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, participa_propinas: true } }),
      this.prisma.userAccount.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, rol: true, rolesExtra: { select: { rol: true } } } }),
    ]);
    const excepcion = new Map(personas.map((p) => [Number(p.party_id), p.participa_propinas]));
    const cuenta = new Map(cuentas.map((c) => [Number(c.party_id), c]));
    const participan: Record<string, Array<{ partyId: number; horas: number }>> = {};
    for (const [fecha, lista] of Object.entries(horasDia)) {
      participan[fecha] = lista.filter((h) => participaEnPropinas(cuenta.get(h.partyId), excepcion.get(h.partyId)));
    }
    return repartirDias(totales, participan);
  }

  /** Lo ya pagado a una persona: por día (planilla) y meses del reparto mensual antiguo ya pagados. */
  async yaPagado(partyId: bigint) {
    const [filas, repartos] = await Promise.all([
      this.prisma.planillaPropinaDia.findMany({ where: { party_id: partyId }, select: { fecha: true, monto_pagado: true } }),
      this.prisma.propinaRepartoDetalle.findMany({
        where: { party_id: partyId, pagado_en: { not: null }, reparto: { estado: { not: 'ANULADO' } } },
        select: { reparto: { select: { anio: true, mes: true } } },
      }),
    ]);
    const pagado = new Map<string, number>();
    for (const f of filas) pagado.set(isoDe(f.fecha), Math.round(((pagado.get(isoDe(f.fecha)) ?? 0) + Number(f.monto_pagado)) * 100) / 100);
    return { pagado, mesesPagados: new Set(repartos.map((r) => mesDeReparto(r.reparto))) };
  }

  /** Propinas que se suman a una persona en el período: sus días y los pendientes de períodos anteriores. */
  async dePersona(partyId: bigint, periodo: { desde: string; hasta: string }, ahora = new Date()): Promise<PropinasPeriodo> {
    const { pagado, mesesPagados } = await this.yaPagado(partyId);
    const desde = [...pagado.keys()].reduce((m, f) => (f < m ? f : m), periodo.desde);
    // ponytail: se recalcula todo el rango desde el día pagado más antiguo; si pesa, limitarlo a los últimos meses
    const dias = await this.repartoDelRango(desde, periodo.hasta, [...pagado.keys()], ahora);
    const lineas = lineasDePersona(dias, Number(partyId), periodo, pagado, mesesPagados);
    return { total: totalLineas(lineas), lineas };
  }

  /** Al pagar el período: deja registrado lo pagado de cada día (0 si no hubo), para no pagarlo otra vez. */
  async registrarPago(tx: any, partyId: bigint, periodoId: bigint, periodo: { desde: string; hasta: string }, lineas: LineaPropina[]) {
    const porFecha = new Map(lineas.map((l) => [l.fecha, l.monto]));
    const fechas = new Set<string>(porFecha.keys());
    for (let f = periodo.desde; f <= periodo.hasta; f = sumarUnDia(f)) fechas.add(f);
    await tx.planillaPropinaDia.createMany({
      data: [...fechas].map((f) => ({ party_id: partyId, fecha: fechaDb(f), monto_pagado: porFecha.get(f) ?? 0, planilla_periodo_id: periodoId })),
    });
  }

  /** Al reabrir el período: libera sus días. */
  liberarPago(tx: any, periodoId: bigint) {
    return tx.planillaPropinaDia.deleteMany({ where: { planilla_periodo_id: periodoId } });
  }
}
