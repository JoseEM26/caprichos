import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { aHoraTexto, jornadaDe } from './asistencia.calculo';
import { rolEfectivo } from './asistencia.interpretacion';
import { AsistenciaService } from './asistencia.service';
import {
  CATEGORIAS_DESCUENTO,
  DIAS_MES_DEFECTO,
  ESTADOS_PENDIENTES,
  HORAS_DIA_DEFECTO,
  METODOS_VALOR_HORA,
  MULTIPLICADOR_EXTRA_DEFECTO,
  MetodoValorHora,
  Modalidad,
  calcularDiaPlanilla,
  calcularPlanilla,
  horasYMinutos,
  pagoDia,
  pagoPorDiaPersona,
  periodoDe,
  redondear2,
  sueldoEquivalente,
  valorHoraPersona,
} from './planilla.calculo';
import { aplicarVacaciones, fechasDelRango } from './vacaciones.calculo';
import { PrestamoCalc, cuotaDelPeriodo, montoRecurrenteDelPeriodo } from './prestamos.calculo';

export const MEDIOS_PAGO = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'] as const;
/** Lo que se descarta del pago de este período: cuotas de préstamo y descuentos recurrentes (ids) que NO se cobran. */
export interface OmitirPeriodo { cuotas?: string[]; recurrentes?: string[] }

/** Sueldo y método de valor hora de la persona, tal como lo usa el cálculo. */
export interface SueldoCalc {
  modalidad: Modalidad;
  semanal: number;
  mensual: number;
  metodo: MetodoValorHora;
  diasMes: number | null;
  horasDia: number | null;
  tarifaHora: number | null;
}
const sueldoDe = (s: any): SueldoCalc => ({
  modalidad: s.modalidad as Modalidad,
  semanal: Number(s.monto_semanal),
  mensual: Number(s.monto_mensual),
  metodo: (METODOS_VALOR_HORA as readonly string[]).includes(s.metodo_valor_hora) ? (s.metodo_valor_hora as MetodoValorHora) : 'PROGRAMADAS',
  diasMes: s.dias_mes ?? null,
  horasDia: s.horas_dia !== null && s.horas_dia !== undefined ? Number(s.horas_dia) : null,
  tarifaHora: s.tarifa_hora !== null && s.tarifa_hora !== undefined ? Number(s.tarifa_hora) : null,
});
const pagoDe = (s: any) => ({ celular: (s.pago_celular as string | null) ?? null, medio: (s.pago_medio as string | null) ?? null });

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
    return { sueldo: s ? sueldoDe(s) : null, pago: s ? pagoDe(s) : null };
  }

  async guardarSueldo(
    partyId: number,
    dto: { modalidad: Modalidad; monto: number; metodo?: MetodoValorHora; diasMes?: number | null; horasDia?: number | null; tarifaHora?: number | null; pagoCelular?: string | null; pagoMedio?: string | null },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = BigInt(partyId);
    const persona = await this.prisma.userAccount.findUnique({ where: { party_id: id } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    if (persona.rol === 'ADMIN') {
      throw new BadRequestException({ codigo: 'ADMIN_SIN_PLANILLA', mensaje: 'El administrador no lleva planilla' });
    }
    const antes = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } });
    // Persona nueva: DIAS_HORAS; ya con sueldo: conserva su método salvo que se indique otro.
    const metodo: MetodoValorHora = dto.metodo ?? (antes ? sueldoDe(antes).metodo : 'DIAS_HORAS');
    if (metodo === 'TARIFA_HORA' && !(Number(dto.tarifaHora ?? (antes ? sueldoDe(antes).tarifaHora : 0)) > 0)) {
      throw new BadRequestException({ codigo: 'TARIFA_REQUERIDA', mensaje: 'Indica la tarifa por hora' });
    }
    const eq = sueldoEquivalente(dto.modalidad, metodo === 'TARIFA_HORA' ? 0 : dto.monto);
    const celular = dto.pagoCelular === undefined ? undefined : (String(dto.pagoCelular ?? '').replace(/[^\d+]/g, '') || null);
    if (dto.pagoMedio && !(MEDIOS_PAGO as readonly string[]).includes(dto.pagoMedio)) {
      throw new BadRequestException({ codigo: 'MEDIO_PAGO_INVALIDO', mensaje: 'Medio de pago no válido' });
    }
    const opc: Record<string, unknown> = {};
    if (dto.diasMes !== undefined) opc.dias_mes = dto.diasMes;
    if (dto.horasDia !== undefined) opc.horas_dia = dto.horasDia;
    if (dto.tarifaHora !== undefined) opc.tarifa_hora = dto.tarifaHora;
    if (celular !== undefined) opc.pago_celular = celular;
    if (dto.pagoMedio !== undefined) opc.pago_medio = dto.pagoMedio || null;
    const datos = { modalidad: dto.modalidad, monto_semanal: eq.semanal, monto_mensual: eq.mensual, metodo_valor_hora: metodo, ...opc, actualizado_en: new Date(), actualizado_por: usuario.partyId };
    await this.prisma.sueldoPersonal.upsert({ where: { party_id: id }, create: { party_id: id, ...datos }, update: datos });
    // El celular es dato personal: la auditoría solo dice si cambió, nunca su valor.
    await this.auditar('CAMBIO', 'GUARDAR_SUELDO', usuario, ip, 'party', id, {
      antes: antes ? { modalidad: antes.modalidad, semanal: Number(antes.monto_semanal), mensual: Number(antes.monto_mensual), metodo: sueldoDe(antes).metodo } : null,
      despues: { modalidad: dto.modalidad, ...eq, metodo, tarifaHora: dto.tarifaHora ?? null, diasMes: dto.diasMes ?? null, horasDia: dto.horasDia ?? null, pagoMedio: dto.pagoMedio ?? null, cambioCelular: celular !== undefined },
    });
    return { partyId, modalidad: dto.modalidad, ...eq, metodo };
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
        pago: d.pago,
        excel: d.excel,
        periodo: d.periodo,
        estado: d.estado,
        programadasH: d.resumen.programadasH,
        trabajadasH: d.resumen.trabajadasH,
        ganado: d.resultado.ganado,
        consumos: d.resultado.consumosCobrados,
        adicional: d.resultado.adicional,
        netoAPagar: d.resultado.netoAPagar,
        descuentosPorCategoria: d.resultado.descuentosPorCategoria,
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
  async detalle(partyId: number, fecha: string, excluirConsumoIds: string[] = [], ahora = new Date(), omitir: OmitirPeriodo = {}): Promise<any> {
    fechaValida(fecha);
    const id = BigInt(partyId);
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } });
    if (!s) throw new NotFoundException({ codigo: 'SIN_SUELDO', mensaje: 'Esa persona todavía no tiene sueldo configurado' });
    const modalidad = s.modalidad as Modalidad;
    const periodo = periodoDe(modalidad, fecha);
    const sueldo = sueldoDe(s);
    const pago = pagoDe(s);

    const pagado = await this.prisma.planillaPeriodo.findFirst({ where: { party_id: id, estado: 'PAGADO', desde: fechaDb(periodo.desde) } });
    if (pagado) {
      return { ...(pagado.detalle as object), sueldo, pago, estado: 'PAGADO', periodoId: Number(pagado.id), pagadoEn: pagado.pagado_en.toISOString(), pagadoPor: Number(pagado.pagado_por) };
    }
    const calc = await this.calcular(id, sueldo, periodo, new Set(excluirConsumoIds), ahora, omitir);
    return { ...calc, sueldo, pago, estado: 'ABIERTO', periodoId: null };
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
    sueldo: SueldoCalc,
    periodo: { desde: string; hasta: string },
    excluidos: Set<string>,
    ahora: Date,
    omitir: OmitirPeriodo = {},
  ) {
    const { dias, cfg } = await this.asistencia.diasDePersona(id, periodo.desde, periodo.hasta, ahora);
    // Tercerizado (contrato temporal): sin vacaciones ni recargo de feriado. Sin vínculo registrado = planilla.
    const vinculo = (await this.prisma.vinculoPersonal.findMany({ where: { party_id: id, vigente_hasta: null } }))[0];
    const tercerizado = vinculo?.tipo === 'CONTRATO_TEMPORAL';
    // Vacaciones del período (vínculo y vacaciones): tomadas = jornada programada pagada normal; pagadas = línea de ingreso
    const { fechasVac, vacPagadas } = tercerizado
      ? { fechasVac: new Set<string>(), vacPagadas: [] as Array<{ id: bigint; fecha_desde: Date; dias: unknown; monto: unknown }> }
      : await this.vacacionesDelPeriodo(id, periodo);
    const diasBase = aplicarVacaciones(dias.map((d) => calcularDiaPlanilla(d, cfg.toleranciaMin)), fechasVac);
    const [extras, ajustes, consumosBd, persona, feriadosBd, prestamosBd, recurrentesBd] = await Promise.all([
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
      tercerizado ? Promise.resolve([] as any[]) : this.prisma.feriado.findMany({ where: { activo: true, fecha: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } } }),
      this.prisma.prestamoPersonal.findMany({ where: { party_id: id, estado: 'ACTIVO' }, include: { cuotas: true }, orderBy: { id: 'asc' } }),
      this.prisma.descuentoRecurrentePersonal.findMany({ where: { party_id: id, activo: true, desde: { lte: fechaDb(periodo.hasta) } }, orderBy: { id: 'asc' } }),
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
    // Valor hora de la persona: DIAS_HORAS y TARIFA_HORA fijan uno propio; PROGRAMADAS usa sueldo ÷ horas programadas.
    const parametros = {
      metodo: sueldo.metodo,
      sueldoMensual: sueldo.mensual,
      diasMes: sueldo.diasMes ?? cfg.diasMesDefecto ?? DIAS_MES_DEFECTO,
      horasDia: sueldo.horasDia ?? cfg.horasDiaDefecto ?? HORAS_DIA_DEFECTO,
      tarifaHora: sueldo.tarifaHora ?? 0,
    };
    const vhFijo = valorHoraPersona(parametros);
    const multExtra = sueldo.metodo === 'PROGRAMADAS' ? 1 : cfg.multiplicadorExtra ?? MULTIPLICADOR_EXTRA_DEFECTO;
    const pctTardanza = cfg.pagoTardanzaPct ?? 0;
    // Descuentos automáticos del período: cuota de cada préstamo y recurrentes (Netflix...), con check para omitirlos
    const omitC = new Set(omitir.cuotas ?? []);
    const omitR = new Set(omitir.recurrentes ?? []);
    const cuotas = prestamosBd.flatMap((p: any) => {
      const calc: PrestamoCalc = {
        id: p.id.toString(),
        periodicidad: p.periodicidad,
        fechaInicio: isoDe(p.fecha_inicio),
        estado: p.estado,
        cuotas: p.cuotas.map((c: any) => ({ id: c.id.toString(), prestamoId: p.id.toString(), numero: c.numero, monto: Number(c.monto), estado: c.estado, periodoHasta: c.periodo_hasta ? isoDe(c.periodo_hasta) : null })),
      };
      const c = cuotaDelPeriodo(calc, sueldo.modalidad, periodo);
      return c
        ? [{ id: c.id, prestamoId: c.prestamoId, numero: c.numero, numCuotas: p.cuotas.filter((x: any) => !x.reprogramada_de).length, monto: c.monto, motivo: (p.motivo as string | null) ?? null, cobrar: !omitC.has(c.id) }]
        : [];
    });
    const recurrentes = recurrentesBd.map((r: any) => ({
      id: r.id.toString(),
      tipo: r.tipo as string,
      nombre: r.nombre as string,
      monto: montoRecurrenteDelPeriodo(Number(r.monto), sueldo.modalidad),
      cobrar: !omitR.has(r.id.toString()),
    }));
    const lineasDescuento = [
      ...vigentes.filter((a) => a.tipo === 'DESCUENTO').map((a) => ({ categoria: (CATEGORIAS_DESCUENTO as readonly string[]).includes(a.categoria) ? a.categoria : 'OTRO', monto: Number(a.monto) })),
      ...cuotas.filter((c) => c.cobrar).map((c) => ({ categoria: 'PRESTAMO', monto: c.monto })),
      ...recurrentes.filter((r) => r.cobrar).map((r) => ({ categoria: r.tipo === 'NETFLIX' ? 'NETFLIX' : 'OTRO', monto: r.monto })),
    ];
    const resultado = calcularPlanilla({
      valorHora: vhFijo ?? undefined,
      multiplicadorExtra: multExtra,
      lineasDescuento,
      bonos: vigentes.filter((a) => a.tipo === 'BONO').map((a) => Number(a.monto)),
      modalidad: sueldo.modalidad,
      sueldoPeriodo,
      dias: diasCalc,
      pctTardanza,
      extrasAprobadas: extrasSet,
      consumos,
      descuentos: [],
      adelantos: vigentes.filter((a) => a.tipo === 'ADELANTO').map((a) => Number(a.monto)),
      vacacionesPagadas: vacPagadas.map((v) => Number(v.monto ?? 0)),
    });
    const porDia = new Map(extras.map((e) => [isoDe(e.jornada), e]));
    const crudo = new Map(dias.map((d) => [d.jornada, d]));
    return {
      partyId: Number(id),
      nombre: persona ? [persona.nombres, persona.apellidos].filter(Boolean).join(' ') : `Persona ${id}`,
      periodo,
      toleranciaMin: cfg.toleranciaMin,
      pctTardanza,
      resultado,
      tercerizado,
      metodoValorHora: sueldo.metodo,
      multiplicadorExtra: multExtra,
      resumen: { programadasH: horas(resultado.programadaMin), trabajadasH: horas(resultado.trabajadaMin) },
      // Columnas del Excel (se muestran tal cual, sin recalcular en el front)
      excel: {
        pagoPorDia: pagoPorDiaPersona(parametros),
        valorHora: resultado.valorHora,
        horasLaboradas: horasYMinutos(resultado.trabajadaMin).horas,
        minutosLaborados: horasYMinutos(resultado.trabajadaMin).minutos,
        horasExtra: horas(resultado.extraAprobadaMin),
        total: resultado.ganado,
        adicional: resultado.adicional,
        descuentos: redondear2(resultado.descuentos + resultado.consumosCobrados),
        descuentosPorCategoria: resultado.descuentosPorCategoria,
        netoAPagar: resultado.netoAPagar,
        adelanto: resultado.adelantos,
        diferencia: resultado.neto,
      },
      cuotas,
      recurrentes,
      pendientes: diasCalc.filter((d) => (ESTADOS_PENDIENTES as readonly string[]).includes(d.estado)).length,
      /** Jornadas que bloquean «Marcar pagado» (para el banner y su enlace al día). */
      jornadasPorRevisar: diasCalc.filter((d) => (ESTADOS_PENDIENTES as readonly string[]).includes(d.estado)).map((d) => d.jornada),
      vacaciones: {
        diasTomados: diasCalc.filter((d) => d.estado === 'VACACIONES').length,
        pagadas: vacPagadas.map((v) => ({ id: Number(v.id), fecha: isoDe(v.fecha_desde), dias: Number(v.dias), monto: Number(v.monto ?? 0) })),
      },
      dias: diasCalc.map((d) => ({
        ...d,
        // Detalle del calendario: sale de la MISMA interpretación que calculó el pago (no se recalcula en el front)
        horario: crudo.get(d.jornada)?.turnoTexto ?? null,
        marcas: (crudo.get(d.jornada)?.interp?.marcas ?? []).map((m) => ({
          id: m.id ?? null,
          hora: aHoraTexto(m.minutos),
          rol: rolEfectivo(crudo.get(d.jornada)!.interp!, m),
          duplicada: m.duplicadaDe !== null,
          estado: m.estado,
        })),
        breakMin: crudo.get(d.jornada)?.breakMin ?? 0,
        alertas: crudo.get(d.jornada)?.alertas ?? [],
        extraPendiente: d.extraMin > 0 && !porDia.has(d.jornada),
        vacacion: d.estado === 'VACACIONES',
        programadaH: horas(d.programadaMin),
        trabajadaH: horas(d.trabajadaMin),
        feriado: feriados.get(d.jornada)?.nombre ?? null,
        ganado: redondear2(pagoDia(d, resultado.valorHoraExacto, pctTardanza, porDia.has(d.jornada), multExtra)),
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
        categoria: a.categoria ?? 'OTRO',
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Pagar y reabrir
  // ---------------------------------------------------------------------------

  /** Marca el período como pagado: congela las cifras y deja los consumos cobrados como PLANILLA (sin mover caja). */
  async pagar(partyId: number, fecha: string, excluirConsumoIds: string[], usuario: UsuarioAutenticado, ip?: string, ahora = new Date(), omitir: OmitirPeriodo = {}) {
    const id = BigInt(partyId);
    const d = await this.detalle(partyId, fecha, excluirConsumoIds, ahora, omitir);
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
      await this.cerrarCuotas(tx, d.cuotas ?? [], fila.id, d.periodo);
      if (aCobrar.length) {
        const r = await tx.consumoPersonal.updateMany({
          where: { id: { in: aCobrar.map((c) => BigInt(c)) }, pagado_en: null },
          data: { pagado_en: new Date(), pagado_por: usuario.partyId, pago_modo: 'PLANILLA', pago_medio: 'PLANILLA', pago_motivo: motivo },
        });
        if (r.count !== aCobrar.length) {
          throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Alguno de los consumos ya estaba cobrado. Vuelve a abrir la planilla.' });
        }
      }
      await this.auditar('CAMBIO', 'PAGAR_PLANILLA', usuario, ip, 'planilla_periodo', fila.id, { periodo: d.periodo, resultado: d.resultado, consumos: aCobrar, cuotas: (d.cuotas ?? []).map((c: any) => ({ id: c.id, cobrar: c.cobrar })) }, undefined, tx);
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
      await this.reabrirCuotas(tx, p.id);
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

  /**
   * Al pagar: las cuotas cobradas pasan a DESCONTADA; las omitidas a OMITIDA y se añade una nueva al final del plan
   * (el plan se recorre). Un préstamo sin cuotas pendientes queda SALDADO.
   */
  private async cerrarCuotas(tx: any, cuotas: Array<{ id: string; prestamoId: string; monto: number; cobrar: boolean }>, periodoId: bigint, periodo: { desde: string; hasta: string }) {
    const prestamos = new Set<string>();
    for (const c of cuotas) {
      prestamos.add(c.prestamoId);
      if (c.cobrar) {
        await tx.prestamoCuota.update({
          where: { id: BigInt(c.id) },
          data: { estado: 'DESCONTADA', periodo_desde: fechaDb(periodo.desde), periodo_hasta: fechaDb(periodo.hasta), planilla_periodo_id: periodoId },
        });
      } else {
        await tx.prestamoCuota.update({ where: { id: BigInt(c.id) }, data: { estado: 'OMITIDA', planilla_periodo_id: periodoId } });
        const ultima = await tx.prestamoCuota.findMany({ where: { prestamo_id: BigInt(c.prestamoId) }, orderBy: { numero: 'desc' }, take: 1 });
        await tx.prestamoCuota.create({
          data: { prestamo_id: BigInt(c.prestamoId), numero: (ultima[0]?.numero ?? 0) + 1, monto: c.monto, reprogramada_de: BigInt(c.id) },
        });
      }
    }
    for (const pid of prestamos) {
      const pendientes = await tx.prestamoCuota.count({ where: { prestamo_id: BigInt(pid), estado: 'PENDIENTE' } });
      if (pendientes === 0) await tx.prestamoPersonal.updateMany({ where: { id: BigInt(pid), estado: 'ACTIVO' }, data: { estado: 'SALDADO' } });
    }
  }

  /** Al reabrir: las cuotas del período vuelven a PENDIENTE y se retiran las añadidas por omisión. */
  private async reabrirCuotas(tx: any, periodoId: bigint) {
    const del = await tx.prestamoCuota.findMany({ where: { planilla_periodo_id: periodoId } });
    if (!del.length) return;
    const omitidas = del.filter((c: any) => c.estado === 'OMITIDA');
    if (omitidas.length) {
      const nuevas = await tx.prestamoCuota.findMany({ where: { reprogramada_de: { in: omitidas.map((c: any) => c.id) } } });
      if (nuevas.some((c: any) => c.estado !== 'PENDIENTE')) {
        throw new ConflictException({ codigo: 'CUOTA_POSTERIOR_PAGADA', mensaje: 'Una cuota reprogramada de este período ya se descontó después. Reabre primero los períodos posteriores.' });
      }
      await tx.prestamoCuota.deleteMany({ where: { id: { in: nuevas.map((c: any) => c.id) } } });
    }
    await tx.prestamoCuota.updateMany({ where: { planilla_periodo_id: periodoId }, data: { estado: 'PENDIENTE', periodo_desde: null, periodo_hasta: null, planilla_periodo_id: null } });
    await tx.prestamoPersonal.updateMany({ where: { id: { in: [...new Set(del.map((c: any) => c.prestamo_id))] as bigint[] }, estado: 'SALDADO' }, data: { estado: 'ACTIVO' } });
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
    tipo: 'ADELANTO' | 'DESCUENTO' | 'BONO',
    dto: { partyId: number; fecha: string; monto: number; motivo: string; categoria?: string },
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
    // La etiqueta solo aplica a descuentos; por defecto OTRO
    const categoria = tipo === 'DESCUENTO' ? (dto.categoria ?? 'OTRO') : 'OTRO';
    if (!(CATEGORIAS_DESCUENTO as readonly string[]).includes(categoria)) {
      throw new BadRequestException({ codigo: 'CATEGORIA_INVALIDA', mensaje: 'Etiqueta de descuento no válida' });
    }
    const a = await this.prisma.planillaAjuste.create({
      data: { party_id: id, tipo, fecha: fechaDb(fecha), monto, motivo, categoria, creado_por: usuario.partyId },
    });
    await this.auditar('CAMBIO', tipo === 'ADELANTO' ? 'CREAR_ADELANTO' : tipo === 'BONO' ? 'CREAR_BONO' : 'CREAR_DESCUENTO', usuario, ip, 'planilla_ajuste', a.id, { partyId: dto.partyId, fecha, monto, categoria }, motivo);
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
