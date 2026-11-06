import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { AsistenciaService } from '../asistencia/asistencia.service';
import { PropinasService } from './propinas.service';
import { diaLima } from './propinas.util';
import { EstadoReparto, MEDIOS_PAGO_PROPINA, firmaReparto, repartirPorHoras } from './propinas-reparto.util';

/** Rol que no participa del reparto salvo excepción fijada por el ADMIN (person.participa_propinas). */
const ROL_SIN_PROPINA = 'ADMIN';

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
 */
@Injectable()
export class PropinasRepartoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propinas: PropinasService,
    private readonly asistencia: AsistenciaService,
    private readonly auditoria: AuditoriaService,
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

  /** Calcula (o recalcula) el BORRADOR del mes. Un reparto ya aprobado o pagado no se vuelve a calcular. */
  async calcular(anio: number, mes: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    validarMes(anio, mes);
    this.exigirMesTerminado(anio, mes, ahora);
    const actual = await this.vigente(anio, mes);
    if (actual && actual.estado !== 'BORRADOR') {
      throw new ConflictException({
        codigo: 'REPARTO_YA_APROBADO',
        mensaje: `El reparto de ${mes}/${anio} ya está ${actual.estado}. Anúlalo con motivo para volver a calcularlo.`,
      });
    }
    const previa = await this.previa(anio, mes, ahora);
    if (previa.error) throw new BadRequestException(previa.error);

    let reparto;
    try {
      reparto = await this.prisma.$transaction(async (tx) => {
        const datos = {
          total_propinas: previa.totalPropinas,
          total_horas: previa.totalHoras,
          calculado_en: ahora,
          calculado_por: usuario.partyId,
        };
        let r;
        if (actual) {
          await tx.propinaRepartoDetalle.deleteMany({ where: { reparto_id: actual.id } });
          r = await tx.propinaReparto.update({ where: { id: actual.id }, data: datos });
        } else {
          r = await tx.propinaReparto.create({ data: { anio, mes, estado: 'BORRADOR', ...datos } });
        }
        if (previa.filas.length) {
          await tx.propinaRepartoDetalle.createMany({
            data: previa.filas.map((f) => ({
              reparto_id: r.id,
              party_id: BigInt(f.partyId),
              horas: f.horas,
              porcentaje: f.porcentaje,
              monto: f.monto,
            })),
          });
        }
        return r;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException({ codigo: 'REPARTO_EN_CURSO', mensaje: 'Otro usuario está calculando este mes. Recarga la vista.' });
      throw e;
    }
    await this.auditar('CALCULAR_REPARTO', { anio, mes, totalPropinas: previa.totalPropinas, totalHoras: previa.totalHoras, personas: previa.filas.length }, usuario.partyId, ip, reparto.id);
    return { ok: true, id: Number(reparto.id) };
  }

  /** Aprueba el BORRADOR: exige que las cifras no hayan cambiado desde el cálculo. Congela el reparto. */
  async aprobar(anio: number, mes: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    validarMes(anio, mes);
    this.exigirMesTerminado(anio, mes, ahora);
    const r = await this.exigirVigente(anio, mes);
    if (r.estado !== 'BORRADOR') {
      throw new ConflictException({ codigo: 'NO_ES_BORRADOR', mensaje: `Solo se aprueba un borrador (ahora está ${r.estado}).` });
    }
    const previa = await this.previa(anio, mes, ahora);
    if (previa.error) throw new BadRequestException(previa.error);
    const guardada = firmaReparto(dec(r.total_propinas), r.detalle.map((d) => ({ partyId: Number(d.party_id), horas: dec(d.horas), monto: dec(d.monto) })));
    if (guardada !== previa.firma) {
      throw new ConflictException({ codigo: 'CIFRAS_CAMBIARON', mensaje: 'Las horas o las propinas cambiaron desde el borrador. Vuelve a calcular antes de aprobar.' });
    }
    await this.prisma.propinaReparto.update({
      where: { id: r.id },
      data: { estado: 'APROBADO', aprobado_en: ahora, aprobado_por: usuario.partyId },
    });
    await this.auditar('APROBAR_REPARTO', { anio, mes, totalPropinas: previa.totalPropinas }, usuario.partyId, ip, r.id);
    return { ok: true };
  }

  /** Marca pagado a todas (o a las indicadas) las personas de un reparto aprobado. Al pagar a todas, el reparto pasa a PAGADO. */
  async pagar(
    anio: number,
    mes: number,
    dto: { medio: string; fecha?: string; nota?: string; partyIds?: number[] },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
  ) {
    validarMes(anio, mes);
    const r = await this.exigirVigente(anio, mes);
    if (r.estado !== 'APROBADO') {
      throw new ConflictException({ codigo: 'NO_APROBADO', mensaje: `Solo se paga un reparto aprobado (ahora está ${r.estado}).` });
    }
    if (!(MEDIOS_PAGO_PROPINA as readonly string[]).includes(dto.medio)) {
      throw new BadRequestException({ codigo: 'MEDIO_INVALIDO', mensaje: 'Medio de pago no válido' });
    }
    const cuando = dto.fecha ? new Date(dto.fecha) : ahora;
    if (Number.isNaN(cuando.getTime())) throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha de pago no es válida' });
    const sel = dto.partyIds ? new Set(dto.partyIds.map(BigInt)) : null;
    const pendientes = r.detalle.filter((d) => !d.pagado_en);
    const aPagar = pendientes.filter((d) => !sel || sel.has(d.party_id));
    if (!aPagar.length) {
      throw new BadRequestException({ codigo: 'SIN_PENDIENTES', mensaje: 'No hay personas pendientes de pago en la selección' });
    }
    const quedan = pendientes.length - aPagar.length;
    await this.prisma.$transaction(async (tx) => {
      await tx.propinaRepartoDetalle.updateMany({
        where: { reparto_id: r.id, party_id: { in: aPagar.map((d) => d.party_id) } },
        data: { pagado_en: cuando, pagado_medio: dto.medio, ...(dto.nota?.trim() ? { nota: dto.nota.trim() } : {}) },
      });
      if (quedan === 0) {
        await tx.propinaReparto.update({ where: { id: r.id }, data: { estado: 'PAGADO', pagado_en: cuando, pagado_por: usuario.partyId } });
      }
    });
    await this.auditar('PAGAR_REPARTO', { anio, mes, medio: dto.medio, personas: aPagar.length, completo: quedan === 0 }, usuario.partyId, ip, r.id);
    return { ok: true, pagadas: aPagar.length, completo: quedan === 0 };
  }

  /** Anula el reparto vigente con motivo. No se anula si ya hay pagos registrados. */
  async anular(anio: number, mes: number, motivo: string, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    validarMes(anio, mes);
    const r = await this.exigirVigente(anio, mes);
    if (r.estado === 'PAGADO' || r.detalle.some((d) => d.pagado_en)) {
      throw new ConflictException({ codigo: 'TIENE_PAGOS', mensaje: 'Hay pagos registrados en este reparto: no se puede anular.' });
    }
    await this.prisma.propinaReparto.update({
      where: { id: r.id },
      data: { estado: 'ANULADO', anulado_en: ahora, anulado_por: usuario.partyId, motivo_anulacion: motivo.trim() },
    });
    await this.auditar('ANULAR_REPARTO', { anio, mes, estadoAnterior: r.estado }, usuario.partyId, ip, r.id, motivo.trim());
    return { ok: true };
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

  /** CSV del reparto vigente del mes. */
  async csv(anio: number, mes: number) {
    validarMes(anio, mes);
    const r = await this.exigirVigente(anio, mes);
    const serie = await this.serializar(r);
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cab = ['persona', 'horas', 'porcentaje', 'monto', 'pagado_en', 'medio_pago', 'nota'];
    const lineas = [cab.join(',')];
    for (const f of serie.filas) {
      lineas.push([f.nombre, f.horas, f.porcentaje, f.monto, f.pagadoEn ?? '', f.pagadoMedio ?? '', f.nota ?? ''].map(esc).join(','));
    }
    return {
      csv: lineas.join('\n') + '\n',
      nombre: `propinas-${anio}-${String(mes).padStart(2, '0')}.csv`,
    };
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
      const esAdmin = !!c && (c.rol === ROL_SIN_PROPINA || c.rolesExtra.some((x) => x.rol === ROL_SIN_PROPINA));
      const excepcion = p?.participa_propinas ?? null;
      if (!(excepcion ?? !esAdmin)) {
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

  private async exigirVigente(anio: number, mes: number) {
    const r = await this.vigente(anio, mes);
    if (!r) throw new NotFoundException({ codigo: 'SIN_REPARTO', mensaje: `No hay reparto vigente de ${mes}/${anio}` });
    return r;
  }

  private exigirMesTerminado(anio: number, mes: number, ahora: Date) {
    if (!mesTerminado(anio, mes, ahora)) {
      throw new BadRequestException({
        codigo: 'MES_EN_CURSO',
        mensaje: 'El reparto se calcula y aprueba cuando termina el mes (a partir del día 1 del mes siguiente). Por ahora solo ves la vista previa.',
      });
    }
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
