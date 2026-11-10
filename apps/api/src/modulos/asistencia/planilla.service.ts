import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { jornadaDe } from './asistencia.calculo';
import { AsistenciaService } from './asistencia.service';
import {
  ESTADOS_PENDIENTES,
  Modalidad,
  calcularDiaPlanilla,
  calcularPlanilla,
  pagoDia,
  periodoDe,
  redondear2,
  sueldoEquivalente,
} from './planilla.calculo';
import { aplicarVacaciones, fechasDelRango } from './vacaciones.calculo';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const horas = (min: number) => Math.round((min / 60) * 100) / 100;

function fechaValida(f: string): string {
  if (!FECHA.test(f) || Number.isNaN(Date.parse(`${f}T00:00:00Z`))) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha debe ser AAAA-MM-DD' });
  }
  return f;
}

function motivoValido(m: unknown, min = 3): string {
  const t = String(m ?? '').trim();
  if (t.length < min) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo' });
  return t;
}

@Injectable()
export class PlanillaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Sueldo por persona
  // ---------------------------------------------------------------------------

  async obtenerSueldo(partyId: number) {
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: BigInt(partyId) } });
    return { sueldo: s ? { modalidad: s.modalidad as Modalidad, semanal: Number(s.monto_semanal), mensual: Number(s.monto_mensual) } : null };
  }

  async guardarSueldo(partyId: number, dto: { modalidad: Modalidad; monto: number }, usuario: UsuarioAutenticado, ip?: string) {
    const id = BigInt(partyId);
    const persona = await this.prisma.userAccount.findUnique({ where: { party_id: id } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    if (persona.rol === 'ADMIN') {
      throw new BadRequestException({ codigo: 'ADMIN_SIN_PLANILLA', mensaje: 'El administrador no lleva planilla' });
    }
    const eq = sueldoEquivalente(dto.modalidad, dto.monto);
    const antes = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } });
    const datos = { modalidad: dto.modalidad, monto_semanal: eq.semanal, monto_mensual: eq.mensual, actualizado_en: new Date(), actualizado_por: usuario.partyId };
    await this.prisma.sueldoPersonal.upsert({ where: { party_id: id }, create: { party_id: id, ...datos }, update: datos });
    await this.auditar('CAMBIO', 'GUARDAR_SUELDO', usuario, ip, 'party', id, {
      antes: antes ? { modalidad: antes.modalidad, semanal: Number(antes.monto_semanal), mensual: Number(antes.monto_mensual) } : null,
      despues: { modalidad: dto.modalidad, ...eq },
    });
    return { partyId, modalidad: dto.modalidad, ...eq };
  }

  // ---------------------------------------------------------------------------
  // Lista y detalle
  // ---------------------------------------------------------------------------

  /** Una fila por persona activa (sin ADMIN) con el período que contiene la fecha según su modalidad. */
  async listar(fecha?: string, ahora = new Date()) {
    const ref = fecha ? fechaValida(fecha) : jornadaDe(ahora).jornada;
    const cuentas = await this.prisma.userAccount.findMany({ where: { activo: true, rol: { not: 'ADMIN' } }, select: { party_id: true } });
    const ids = cuentas.map((c) => c.party_id);
    const [sueldos, personas, vinculos] = await Promise.all([
      this.prisma.sueldoPersonal.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.person.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.vinculoPersonal.findMany({ where: { party_id: { in: ids }, vigente_hasta: null } }),
    ]);
    const vinculoDe = new Map(vinculos.map((v) => [v.party_id, { tipo: v.tipo, fechaIngreso: isoDe(v.fecha_ingreso), fechaFin: v.fecha_fin ? isoDe(v.fecha_fin) : null }]));
    const nombre = new Map(personas.map((p) => [p.party_id, [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
    const filas = [];
    for (const id of ids) {
      const s = sueldos.find((x) => x.party_id === id);
      const base = { partyId: Number(id), nombre: nombre.get(id) ?? `Persona ${id}`, vinculo: vinculoDe.get(id) ?? null };
      if (!s) {
        filas.push({ ...base, sueldo: null });
        continue;
      }
      const d = await this.detalle(Number(id), ref, [], ahora);
      filas.push({
        ...base,
        sueldo: d.sueldo,
        periodo: d.periodo,
        estado: d.estado,
        programadasH: d.resumen.programadasH,
        trabajadasH: d.resumen.trabajadasH,
        ganado: d.resultado.ganado,
        consumos: d.resultado.consumosCobrados,
        descuentos: d.resultado.descuentos,
        adelantos: d.resultado.adelantos,
        neto: d.resultado.neto,
        pendientes: d.pendientes,
      });
    }
    return { fecha: ref, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  }

  /**
   * Planilla de una persona en el período de `fecha`. Pagado: devuelve las cifras congeladas, sin recalcular.
   * `excluirConsumoIds` = consumos que pasan al siguiente período (los demás se cobran en este pago).
   */
  async detalle(partyId: number, fecha: string, excluirConsumoIds: string[] = [], ahora = new Date()): Promise<any> {
    fechaValida(fecha);
    const id = BigInt(partyId);
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } });
    if (!s) throw new NotFoundException({ codigo: 'SIN_SUELDO', mensaje: 'Esa persona todavía no tiene sueldo configurado' });
    const modalidad = s.modalidad as Modalidad;
    const periodo = periodoDe(modalidad, fecha);
    const sueldo = { modalidad, semanal: Number(s.monto_semanal), mensual: Number(s.monto_mensual) };

    const pagado = await this.prisma.planillaPeriodo.findFirst({ where: { party_id: id, estado: 'PAGADO', desde: fechaDb(periodo.desde) } });
    if (pagado) {
      return { ...(pagado.detalle as object), sueldo, estado: 'PAGADO', periodoId: Number(pagado.id), pagadoEn: pagado.pagado_en.toISOString(), pagadoPor: Number(pagado.pagado_por) };
    }
    const calc = await this.calcular(id, sueldo, periodo, new Set(excluirConsumoIds), ahora);
    return { ...calc, sueldo, estado: 'ABIERTO', periodoId: null };
  }

  private async vacacionesDelPeriodo(id: bigint, periodo: { desde: string; hasta: string }) {
    const vacs = await this.prisma.vacacionMovimiento.findMany({
      where: { party_id: id, anulado_en: null, tipo: { in: ['TOMADAS', 'PAGADAS'] }, fecha_desde: { lte: fechaDb(periodo.hasta) }, fecha_hasta: { gte: fechaDb(periodo.desde) } },
      orderBy: { fecha_desde: 'asc' },
    });
    const fechasVac = new Set(vacs.filter((v) => v.tipo === 'TOMADAS').flatMap((v) => fechasDelRango(isoDe(v.fecha_desde), isoDe(v.fecha_hasta))));
    const vacPagadas = vacs.filter((v) => v.tipo === 'PAGADAS' && isoDe(v.fecha_desde) >= periodo.desde && isoDe(v.fecha_desde) <= periodo.hasta);
    return { fechasVac, vacPagadas };
  }

  private async calcular(
    id: bigint,
    sueldo: { modalidad: Modalidad; semanal: number; mensual: number },
    periodo: { desde: string; hasta: string },
    excluidos: Set<string>,
    ahora: Date,
  ) {
    const { dias, cfg } = await this.asistencia.diasDePersona(id, periodo.desde, periodo.hasta, ahora);
    // Vacaciones del período (vínculo y vacaciones): tomadas = jornada programada pagada normal; pagadas = línea de ingreso
    const { fechasVac, vacPagadas } = await this.vacacionesDelPeriodo(id, periodo);
    const diasBase = aplicarVacaciones(dias.map((d) => calcularDiaPlanilla(d, cfg.toleranciaMin)), fechasVac);
    const [extras, ajustes, consumosBd, persona, feriadosBd] = await Promise.all([
      this.prisma.planillaExtraAprobada.findMany({ where: { party_id: id, jornada: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } } }),
      this.prisma.planillaAjuste.findMany({
        where: { party_id: id, fecha: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } },
        orderBy: { creado_en: 'asc' },
      }),
      // Pendientes hasta el fin del período (incluye los que otro período dejó pasar)
      this.prisma.consumoPersonal.findMany({
        where: { party_id: id, pagado_en: null, fecha: { lte: fechaDb(periodo.hasta) }, pedido: { estado: { notIn: ['ANULADO', 'RECHAZADO'] } } },
        include: { pedido: { select: { codigo: true } } },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.person.findUnique({ where: { party_id: id } }),
      this.prisma.feriado.findMany({ where: { activo: true, fecha: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } } }),
    ]);
    // Feriado activo: las horas trabajadas de esa jornada se pagan a valor hora × recargo (ver pagoDia en planilla.calculo).
    const feriados = new Map(feriadosBd.map((f) => [isoDe(f.fecha), { nombre: f.nombre, recargo: Number(f.recargo) }]));
    const diasCalc = diasBase.map((c) => {
      const f = feriados.get(c.jornada);
      // un día de vacación tomada se paga normal (sin recargo)
      return f && f.recargo !== 1 && c.estado !== 'VACACIONES' ? { ...c, recargo: f.recargo } : c;
    });
    const vigentes = ajustes.filter((a) => !a.anulado_en);
    const consumos = consumosBd.map((c) => ({
      id: c.id.toString(),
      fecha: isoDe(c.fecha),
      pedido: c.pedido?.codigo ?? `P-${c.pedido_id}`,
      monto: Number(c.monto),
      cobrar: !excluidos.has(c.id.toString()),
    }));
    const extrasSet = new Set(extras.map((e) => isoDe(e.jornada)));
    const sueldoPeriodo = sueldo.modalidad === 'SEMANAL' ? sueldo.semanal : sueldo.mensual;
    const resultado = calcularPlanilla({
      modalidad: sueldo.modalidad,
      sueldoPeriodo,
      dias: diasCalc,
      pctTardanza: cfg.pagoTardanzaPct,
      extrasAprobadas: extrasSet,
      consumos,
      descuentos: vigentes.filter((a) => a.tipo === 'DESCUENTO').map((a) => Number(a.monto)),
      adelantos: vigentes.filter((a) => a.tipo === 'ADELANTO').map((a) => Number(a.monto)),
      vacacionesPagadas: vacPagadas.map((v) => Number(v.monto ?? 0)),
    });
    const porDia = new Map(extras.map((e) => [isoDe(e.jornada), e]));
    return {
      partyId: Number(id),
      nombre: persona ? [persona.nombres, persona.apellidos].filter(Boolean).join(' ') : `Persona ${id}`,
      periodo,
      toleranciaMin: cfg.toleranciaMin,
      pctTardanza: cfg.pagoTardanzaPct,
      resultado,
      resumen: { programadasH: horas(resultado.programadaMin), trabajadasH: horas(resultado.trabajadaMin) },
      pendientes: diasCalc.filter((d) => (ESTADOS_PENDIENTES as readonly string[]).includes(d.estado)).length,
      vacaciones: {
        diasTomados: diasCalc.filter((d) => d.estado === 'VACACIONES').length,
        pagadas: vacPagadas.map((v) => ({ id: Number(v.id), fecha: isoDe(v.fecha_desde), dias: Number(v.dias), monto: Number(v.monto ?? 0) })),
      },
      dias: diasCalc.map((d) => ({
        ...d,
        programadaH: horas(d.programadaMin),
        trabajadaH: horas(d.trabajadaMin),
        feriado: feriados.get(d.jornada)?.nombre ?? null,
        ganado: redondear2(pagoDia(d, resultado.valorHora, cfg.pagoTardanzaPct, porDia.has(d.jornada))),
        extraAprobada: porDia.has(d.jornada),
        extraAprobadaPor: porDia.has(d.jornada) ? Number(porDia.get(d.jornada)!.aprobado_por) : null,
        extraAprobadaEn: porDia.has(d.jornada) ? porDia.get(d.jornada)!.aprobado_en.toISOString() : null,
      })),
      consumos,
      ajustes: ajustes.map((a) => ({
        id: Number(a.id),
        tipo: a.tipo,
        fecha: isoDe(a.fecha),
        monto: Number(a.monto),
        motivo: a.motivo,
        creadoEn: a.creado_en.toISOString(),
        anulado: Boolean(a.anulado_en),
        anuladoMotivo: a.anulado_motivo,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Pagar y reabrir
  // ---------------------------------------------------------------------------

  /** Marca el período como pagado: congela las cifras y deja los consumos cobrados como PLANILLA (sin mover caja). */
  async pagar(partyId: number, fecha: string, excluirConsumoIds: string[], usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const id = BigInt(partyId);
    const d = await this.detalle(partyId, fecha, excluirConsumoIds, ahora);
    if (d.estado === 'PAGADO') throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Ese período ya está pagado' });
    if (d.pendientes > 0) {
      throw new ConflictException({
        codigo: 'JORNADAS_PENDIENTES',
        mensaje: `Hay ${d.pendientes} jornada(s) incompletas o por revisar. Corrígelas en Asistencia antes de pagar.`,
      });
    }
    const aCobrar: string[] = d.consumos.filter((c: any) => c.cobrar).map((c: any) => c.id);
    const detalle = { ...d, consumosCobradosIds: aCobrar, pagadoPor: Number(usuario.partyId) };
    const motivo = `Planilla ${d.periodo.desde} a ${d.periodo.hasta}`;
    const periodoId = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.planillaPeriodo.create({
        data: {
          party_id: id,
          modalidad: d.sueldo.modalidad,
          desde: fechaDb(d.periodo.desde),
          hasta: fechaDb(d.periodo.hasta),
          neto: d.resultado.neto,
          detalle: detalle as any,
          pagado_por: usuario.partyId,
        },
      });
      if (aCobrar.length) {
        const r = await tx.consumoPersonal.updateMany({
          where: { id: { in: aCobrar.map((c) => BigInt(c)) }, pagado_en: null },
          data: { pagado_en: new Date(), pagado_por: usuario.partyId, pago_modo: 'PLANILLA', pago_medio: 'PLANILLA', pago_motivo: motivo },
        });
        if (r.count !== aCobrar.length) {
          throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Alguno de los consumos ya estaba cobrado. Vuelve a abrir la planilla.' });
        }
      }
      await this.auditar('CAMBIO', 'PAGAR_PLANILLA', usuario, ip, 'planilla_periodo', fila.id, { periodo: d.periodo, resultado: d.resultado, consumos: aCobrar }, undefined, tx);
      return fila.id;
    });
    return { ok: true, periodoId: Number(periodoId), neto: d.resultado.neto };
  }

  /** Reabre un período pagado (queda REABIERTO, con motivo) y devuelve a pendientes los consumos que cobró. */
  async reabrir(periodoId: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string) {
    const motivo = motivoValido(motivoTxt, 10);
    const p = await this.prisma.planillaPeriodo.findUnique({ where: { id: BigInt(periodoId) } });
    if (!p) throw new NotFoundException({ codigo: 'PERIODO_NO_ENCONTRADO', mensaje: 'Período no encontrado' });
    if (p.estado !== 'PAGADO') throw new ConflictException({ codigo: 'NO_ESTA_PAGADO', mensaje: 'Ese período ya está reabierto' });
    const ids: string[] = ((p.detalle as any)?.consumosCobradosIds ?? []) as string[];
    await this.prisma.$transaction(async (tx) => {
      await tx.planillaPeriodo.update({
        where: { id: p.id },
        data: { estado: 'REABIERTO', reabierto_en: new Date(), reabierto_por: usuario.partyId, reabierto_motivo: motivo },
      });
      if (ids.length) {
        await tx.consumoPersonal.updateMany({
          where: { id: { in: ids.map((i) => BigInt(i)) }, pago_modo: 'PLANILLA', movimiento_caja_id: null },
          data: { pagado_en: null, pagado_por: null, pago_modo: null, pago_medio: null, pago_motivo: null },
        });
      }
      await this.auditar('CAMBIO', 'REABRIR_PLANILLA', usuario, ip, 'planilla_periodo', p.id, { periodo: { desde: isoDe(p.desde), hasta: isoDe(p.hasta) }, neto: Number(p.neto), consumos: ids }, motivo, tx);
    });
    return { ok: true };
  }

  /** Historial de pagos de una persona (pagados y reabiertos), con sus cifras congeladas. */
  async historial(partyId: number) {
    const filas = await this.prisma.planillaPeriodo.findMany({ where: { party_id: BigInt(partyId) }, orderBy: { desde: 'desc' }, take: 60 });
    return filas.map((f) => ({
      id: Number(f.id),
      desde: isoDe(f.desde),
      hasta: isoDe(f.hasta),
      estado: f.estado,
      neto: Number(f.neto),
      pagadoEn: f.pagado_en.toISOString(),
      pagadoPor: Number(f.pagado_por),
      reabiertoEn: f.reabierto_en?.toISOString() ?? null,
      reabiertoMotivo: f.reabierto_motivo,
    }));
  }

  // ---------------------------------------------------------------------------
  // Ajustes (adelantos y descuentos) y horas extra aprobadas
  // ---------------------------------------------------------------------------

  private async exigirPeriodoAbierto(partyId: bigint, fecha: string) {
    const pagado = await this.prisma.planillaPeriodo.findFirst({
      where: { party_id: partyId, estado: 'PAGADO', desde: { lte: fechaDb(fecha) }, hasta: { gte: fechaDb(fecha) } },
    });
    if (pagado) {
      throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiarlo.' });
    }
  }

  async crearAjuste(
    tipo: 'ADELANTO' | 'DESCUENTO',
    dto: { partyId: number; fecha: string; monto: number; motivo: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = BigInt(dto.partyId);
    const fecha = fechaValida(dto.fecha);
    const motivo = motivoValido(dto.motivo);
    const monto = redondear2(Number(dto.monto));
    if (!(monto > 0)) throw new BadRequestException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto debe ser mayor que cero' });
    if (!(await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } }))) {
      throw new NotFoundException({ codigo: 'SIN_SUELDO', mensaje: 'Esa persona todavía no tiene sueldo configurado' });
    }
    await this.exigirPeriodoAbierto(id, fecha);
    const a = await this.prisma.planillaAjuste.create({
      data: { party_id: id, tipo, fecha: fechaDb(fecha), monto, motivo, creado_por: usuario.partyId },
    });
    await this.auditar('CAMBIO', tipo === 'ADELANTO' ? 'CREAR_ADELANTO' : 'CREAR_DESCUENTO', usuario, ip, 'planilla_ajuste', a.id, { partyId: dto.partyId, fecha, monto }, motivo);
    return { ok: true, id: Number(a.id) };
  }

  async anularAjuste(ajusteId: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string) {
    const motivo = motivoValido(motivoTxt);
    const a = await this.prisma.planillaAjuste.findUnique({ where: { id: BigInt(ajusteId) } });
    if (!a) throw new NotFoundException({ codigo: 'AJUSTE_NO_ENCONTRADO', mensaje: 'Ajuste no encontrado' });
    if (a.anulado_en) throw new ConflictException({ codigo: 'YA_ANULADO', mensaje: 'Ese ajuste ya está anulado' });
    await this.exigirPeriodoAbierto(a.party_id, isoDe(a.fecha));
    await this.prisma.planillaAjuste.update({
      where: { id: a.id },
      data: { anulado_en: new Date(), anulado_por: usuario.partyId, anulado_motivo: motivo },
    });
    await this.auditar('CAMBIO', 'ANULAR_AJUSTE', usuario, ip, 'planilla_ajuste', a.id, { tipo: a.tipo, monto: Number(a.monto) }, motivo);
    return { ok: true };
  }

  /** Aprueba (o quita la aprobación de) las horas extra de una jornada. */
  async aprobarExtra(partyId: number, jornada: string, aprobada: boolean, usuario: UsuarioAutenticado, ip?: string) {
    const id = BigInt(partyId);
    fechaValida(jornada);
    await this.exigirPeriodoAbierto(id, jornada);
    if (aprobada) {
      await this.prisma.planillaExtraAprobada.upsert({
        where: { party_id_jornada: { party_id: id, jornada: fechaDb(jornada) } },
        create: { party_id: id, jornada: fechaDb(jornada), aprobado_por: usuario.partyId },
        update: {},
      });
    } else {
      await this.prisma.planillaExtraAprobada.deleteMany({ where: { party_id: id, jornada: fechaDb(jornada) } });
    }
    await this.auditar('CAMBIO', aprobada ? 'APROBAR_EXTRA' : 'QUITAR_EXTRA', usuario, ip, 'party', id, { jornada });
    return { ok: true, aprobada };
  }

  // ---------------------------------------------------------------------------
  // Mi resumen (sin dinero): lo ve cada persona de su propio período
  // ---------------------------------------------------------------------------

  async miResumen(partyId: bigint, ahora = new Date()) {
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: partyId } });
    const modalidad: Modalidad = (s?.modalidad as Modalidad) ?? 'MENSUAL';
    const hoy = jornadaDe(ahora).jornada;
    const periodo = periodoDe(modalidad, hoy);
    const { dias, cfg } = await this.asistencia.diasDePersona(partyId, periodo.desde, periodo.hasta, ahora);
    const { fechasVac } = await this.vacacionesDelPeriodo(partyId, periodo);
    const calc = aplicarVacaciones(dias.map((d) => calcularDiaPlanilla(d, cfg.toleranciaMin)), fechasVac);
    const suma = (f: (d: (typeof calc)[number]) => number) => calc.reduce((a, d) => a + f(d), 0);
    return {
      modalidad,
      periodo,
      programadasH: horas(suma((d) => d.programadaMin)),
      trabajadasH: horas(suma((d) => d.trabajadaMin)),
      tardanzas: calc.filter((d) => d.tardanzaMin > 0).length,
      tardanzaMin: suma((d) => d.tardanzaMin),
      faltas: calc.filter((d) => d.estado === 'FALTA').length,
      jornadasPorRevisar: calc.filter((d) => (ESTADOS_PENDIENTES as readonly string[]).includes(d.estado)).length,
    };
  }

  /**
   * Lo que llevo ganado, por día y acumulado, del período actual de MI sueldo. Reutiliza `detalle` (misma fórmula
   * que la planilla del admin; pagado = cifras congeladas). Solo expone horas, ganado bruto y neto propio: nunca
   * consumos ni ajustes de otros ni el detalle de consumos.
   */
  async miGanado(partyId: bigint, ahora = new Date()) {
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: partyId } });
    if (!s) return { conSueldo: false };
    const hoy = jornadaDe(ahora).jornada;
    const d = await this.detalle(Number(partyId), hoy, [], ahora);
    return {
      conSueldo: true,
      modalidad: d.sueldo.modalidad as Modalidad,
      periodo: d.periodo,
      estado: d.estado === 'PAGADO' ? 'PAGADO' : 'ESTIMADO',
      dias: (d.dias as any[]).map((x) => ({
        jornada: x.jornada,
        trabajadaH: x.trabajadaH,
        ganado: x.ganado ?? 0,
        feriado: x.feriado ?? null,
        recargo: x.recargo ?? 1,
      })),
      acumulado: d.resultado.ganado,
      neto: d.estado === 'PAGADO' ? d.resultado.neto : null,
    };
  }

  private async auditar(
    categoria: string,
    accion: string,
    usuario: UsuarioAutenticado,
    ip: string | undefined,
    entidad: string,
    entidadId: bigint | number,
    despues: Record<string, unknown>,
    motivo?: string,
    db?: any,
  ) {
    await this.auditoria?.registrar(
      { categoria: categoria as any, modulo: 'planilla', accion, resultado: 'OK', entidad, entidadId: Number(entidadId), despues, partyId: usuario.partyId, ip, motivo } as any,
      db,
    );
  }
}
