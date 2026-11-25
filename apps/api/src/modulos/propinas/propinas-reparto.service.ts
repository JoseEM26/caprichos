import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AsistenciaService } from '../asistencia/asistencia.service';
import { PlanillaPropinasService } from '../asistencia/planilla-propinas.service';
import { PropinasService } from './propinas.service';
import { diaLima } from './propinas.util';
import { EstadoReparto, ROL_SIN_PROPINA, firmaReparto, participaEnPropinas, repartirPorHoras } from './propinas-reparto.util';

function validarMes(anio: number, mes: number) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new BadRequestException({ codigo: 'MES_INVALIDO', mensaje: 'Indica un año y un mes válidos' });
  }
}

/** Un mes está terminado a partir del día 1 del mes siguiente (día calendario de Lima). */
export function mesTerminado(anio: number, mes: number, ahora = new Date()): boolean {
  const [a, m] = diaLima(ahora).split('-').map(Number);
  return anio < a || (anio === a && mes < m);
}

const nombreDe = (p: { nombres: string; apellidos: string | null } | undefined, id: bigint) =>
  p ? [p.nombres, p.apellidos].filter(Boolean).join(' ') : `Persona ${id}`;

const dec = (v: unknown) => Number(v);
const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reparto mensual de propinas: las propinas del mes se reparten UNA VEZ, a fin de mes, entre el personal
 * en proporción a las horas trabajadas. Estados: BORRADOR (se recalcula) → APROBADO (congela) → PAGADO;
 * ANULADO con motivo (solo si no hay pagos). Un reparto vigente (no anulado) por mes.
 * Ya NO se paga aparte: las propinas se pagan en la planilla de cada persona, por día (ver `vistaDias`).
 */
@Injectable()
export class PropinasRepartoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propinas: PropinasService,
    private readonly asistencia: AsistenciaService,
    private readonly auditoria: AuditoriaService,
    private readonly porDia: PlanillaPropinasService,
  ) {}

  /** Vista de un mes: el reparto vigente (si existe) y la vista previa en vivo (solo lectura, no guarda). */
  async vista(anio: number, mes: number, ahora = new Date()) {
    validarMes(anio, mes);
    const [reparto, previa] = await Promise.all([this.vigente(anio, mes), this.previa(anio, mes, ahora)]);
    return {
      anio,
      mes,
      mesTerminado: mesTerminado(anio, mes, ahora),
      reparto: reparto ? await this.serializar(reparto) : null,
      previa,
    };
  }

  /**
   * Solo para ver: cómo se reparte la propina de cada día del mes entre quienes trabajaron ese día, y si cada parte
   * ya se pagó (en la planilla de qué período, o por el reparto mensual antiguo). Los días sin nadie con horas salen «sin repartir».
   */
  async vistaDias(anio: number, mes: number, ahora = new Date()) {
    validarMes(anio, mes);
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(Date.UTC(anio, mes, 0)).getUTCDate()).padStart(2, '0')}`;
    const dias = await this.porDia.repartoDelRango(desde, hasta, [], ahora);
    const ids = [...new Set([...dias.values()].flatMap((d) => d.filas.map((f) => BigInt(f.partyId))))];
    const [personas, pagos, repartos] = await Promise.all([
      this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } }),
      this.prisma.planillaPropinaDia.findMany({
        where: { party_id: { in: ids }, fecha: { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${hasta}T00:00:00Z`) } },
        select: { party_id: true, fecha: true, monto_pagado: true, periodo: { select: { desde: true, hasta: true } } },
      }),
      this.prisma.propinaRepartoDetalle.findMany({
        where: { party_id: { in: ids }, pagado_en: { not: null }, reparto: { anio, mes, estado: { not: 'ANULADO' } } },
        select: { party_id: true },
      }),
    ]);
    const nombres = new Map(personas.map((p) => [Number(p.party_id), nombreDe(p, p.party_id)]));
    const pagadoReparto = new Set(repartos.map((r) => Number(r.party_id)));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const lista = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((d) => ({
      fecha: d.fecha,
      total: d.total,
      sinRepartir: d.sinRepartir,
      personas: d.filas.map((f) => {
        const delDia = pagos.filter((x) => Number(x.party_id) === f.partyId && iso(x.fecha) === d.fecha);
        const periodo = (delDia.find((x) => Number(x.monto_pagado) !== 0) ?? delDia[0])?.periodo;
        return {
          partyId: f.partyId,
          nombre: nombres.get(f.partyId) ?? `Persona ${f.partyId}`,
          horas: f.horas,
          porcentaje: f.porcentaje,
          monto: f.monto,
          pagadoPlanilla: redondear2(delDia.reduce((a, x) => a + dec(x.monto_pagado), 0)),
          periodo: periodo ? { desde: iso(periodo.desde), hasta: iso(periodo.hasta) } : null,
          pagadoReparto: pagadoReparto.has(f.partyId),
        };
      }),
    }));
    return { anio, mes, sinRepartir: redondear2(lista.filter((d) => d.sinRepartir).reduce((a, d) => a + d.total, 0)), dias: lista };
  }

  /** Cambia la excepción de una persona: null = según su rol; true/false = forzado por el ADMIN. */
  async fijarParticipacion(partyId: number, participa: boolean | null, usuario: UsuarioAutenticado, ip?: string) {
    const id = BigInt(partyId);
    const persona = await this.prisma.person.findUnique({ where: { party_id: id }, select: { participa_propinas: true } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    await this.prisma.person.update({ where: { party_id: id }, data: { participa_propinas: participa } });
    await this.auditar('PARTICIPA_PROPINAS', { antes: persona.participa_propinas, despues: participa }, usuario.partyId, ip, partyId, undefined, 'party');
    return { ok: true, participa };
  }

  /** Historial de repartos (todos los estados), más recientes primero. */
  async historial() {
    const filas = await this.prisma.propinaReparto.findMany({
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { id: 'desc' }],
      take: 60,
    });
    return filas.map((r) => ({
      id: Number(r.id),
      anio: r.anio,
      mes: r.mes,
      estado: r.estado as EstadoReparto,
      totalPropinas: dec(r.total_propinas),
      totalHoras: dec(r.total_horas),
      calculadoEn: r.calculado_en.toISOString(),
      aprobadoEn: r.aprobado_en?.toISOString() ?? null,
      pagadoEn: r.pagado_en?.toISOString() ?? null,
      anuladoEn: r.anulado_en?.toISOString() ?? null,
      motivoAnulacion: r.motivo_anulacion,
    }));
  }

  /**
   * Lo que ve un trabajador de SUS repartos aprobados o pagados: solo su fila (sin montos ni horas de otros).
   */
  async miPropinas(partyId: bigint) {
    const filas = await this.prisma.propinaRepartoDetalle.findMany({
      where: { party_id: partyId, reparto: { estado: { in: ['APROBADO', 'PAGADO'] } } },
      include: { reparto: { select: { anio: true, mes: true, estado: true } } },
    });
    return filas
      .sort((a, b) => b.reparto.anio - a.reparto.anio || b.reparto.mes - a.reparto.mes)
      .map((d) => ({
        anio: d.reparto.anio,
        mes: d.reparto.mes,
        estado: d.reparto.estado,
        horas: dec(d.horas),
        porcentaje: dec(d.porcentaje),
        monto: dec(d.monto),
        pagadoEn: d.pagado_en?.toISOString() ?? null,
        pagadoMedio: d.pagado_medio,
      }));
  }

  // ---------------------------------------------------------------------------
  // Cálculo (sin guardar)
  // ---------------------------------------------------------------------------

  /**
   * Vista previa del reparto de un mes, sin guardar: participantes, horas, %, montos, excluidos y avisos.
   * `error` indica por qué no se puede calcular (propinas sin horas, sin participantes o negativas).
   */
  private async previa(anio: number, mes: number, ahora: Date) {
    const { total } = await this.propinas.resumenMes(anio, mes);
    const totalPropinas = redondear2(total);
    const horas = await this.asistencia.horasTrabajadasDelMes(anio, mes, ahora);
    const ids = horas.map((h) => BigInt(h.partyId));
    const [personas, cuentas] = await Promise.all([
      this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true, participa_propinas: true } }),
      this.prisma.userAccount.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, rol: true, rolesExtra: { select: { rol: true } } } }),
    ]);
    const mapaP = new Map(personas.map((p) => [Number(p.party_id), p]));
    const mapaC = new Map(cuentas.map((c) => [Number(c.party_id), c]));

    const excluidos: Array<{ partyId: number; nombre: string; motivo: string; participa: boolean | null }> = [];
    const participantes: Array<{ partyId: number; nombre: string; horas: number }> = [];
    const avisos: string[] = [];
    for (const h of horas) {
      const p = mapaP.get(h.partyId);
      const c = mapaC.get(h.partyId);
      const nombre = nombreDe(p, BigInt(h.partyId));
      const excepcion = p?.participa_propinas ?? null;
      if (!participaEnPropinas(c, excepcion)) {
        excluidos.push({ partyId: h.partyId, nombre, motivo: excepcion === false ? 'EXCLUIDO_POR_ADMIN' : ROL_SIN_PROPINA, participa: excepcion });
        continue;
      }
      participantes.push({ partyId: h.partyId, nombre, horas: h.horasTrabajadas });
      if (h.jornadasIncompletas) avisos.push(`${h.jornadasIncompletas} ${h.jornadasIncompletas === 1 ? 'jornada' : 'jornadas'} de ${nombre} están INCOMPLETO`);
      if (h.jornadasARevisar) avisos.push(`${h.jornadasARevisar} ${h.jornadasARevisar === 1 ? 'jornada' : 'jornadas'} de ${nombre} están A REVISAR`);
    }

    const conHoras = participantes.filter((p) => p.horas > 0);
    let error: { codigo: string; mensaje: string } | null = null;
    if (totalPropinas < 0) {
      error = { codigo: 'PROPINAS_NEGATIVAS', mensaje: 'Las devoluciones del mes superan las propinas: revisa Propinas antes de repartir.' };
    } else if (totalPropinas > 0 && participantes.length === 0) {
      error = { codigo: 'SIN_PARTICIPANTES', mensaje: 'Hay propinas en el mes, pero ninguna persona participa en el reparto.' };
    } else if (totalPropinas > 0 && conHoras.length === 0) {
      error = { codigo: 'SIN_HORAS', mensaje: 'Hay propinas en el mes, pero nadie tiene horas trabajadas evaluables.' };
    }

    const nombres = new Map(conHoras.map((p) => [p.partyId, p.nombre]));
    const filas = error
      ? []
      : repartirPorHoras(totalPropinas, conHoras).map((f) => ({ ...f, nombre: nombres.get(f.partyId) ?? '' }));
    const totalHoras = redondear2(conHoras.reduce((a, p) => a + p.horas, 0));
    return {
      totalPropinas,
      totalHoras,
      filas,
      excluidos,
      avisos,
      error,
      firma: firmaReparto(totalPropinas, filas),
    };
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private vigente(anio: number, mes: number) {
    return this.prisma.propinaReparto.findFirst({
      where: { anio, mes, estado: { not: 'ANULADO' } },
      include: { detalle: true },
    });
  }

  private async serializar(r: NonNullable<Awaited<ReturnType<PropinasRepartoService['vigente']>>>) {
    const ids = r.detalle.map((d) => d.party_id);
    const personas = ids.length
      ? await this.prisma.person.findMany({ where: { party_id: { in: ids } }, select: { party_id: true, nombres: true, apellidos: true } })
      : [];
    const mapa = new Map(personas.map((p) => [p.party_id, p]));
    return {
      id: Number(r.id),
      anio: r.anio,
      mes: r.mes,
      estado: r.estado as EstadoReparto,
      totalPropinas: dec(r.total_propinas),
      totalHoras: dec(r.total_horas),
      calculadoEn: r.calculado_en.toISOString(),
      aprobadoEn: r.aprobado_en?.toISOString() ?? null,
      pagadoEn: r.pagado_en?.toISOString() ?? null,
      nota: r.nota,
      filas: r.detalle
        .map((d) => ({
          partyId: Number(d.party_id),
          nombre: nombreDe(mapa.get(d.party_id), d.party_id),
          horas: dec(d.horas),
          porcentaje: dec(d.porcentaje),
          monto: dec(d.monto),
          pagadoEn: d.pagado_en?.toISOString() ?? null,
          pagadoMedio: d.pagado_medio,
          nota: d.nota,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  private async auditar(
    accion: string,
    despues: Record<string, unknown>,
    partyId: bigint | number,
    ip: string | undefined,
    entidadId: bigint | number,
    motivo?: string,
    entidad = 'propina_reparto',
  ) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'propinas',
      accion,
      resultado: 'OK',
      entidad,
      entidadId: BigInt(entidadId),
      despues,
      motivo,
      partyId: BigInt(partyId),
      ip,
    });
  }
}
