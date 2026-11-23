import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { aHoraTexto, jornadaDe, sumarDias } from './asistencia.calculo';
import { rolEfectivo } from './asistencia.interpretacion';
import { AsistenciaService } from './asistencia.service';
import {
  CATEGORIAS_DESCUENTO,
  DIAS_MES_DEFECTO,
  ESTADOS_PENDIENTES,
  HORAS_DIA_DEFECTO,
  METODOS_VALOR_HORA,
  MULTIPLICADOR_EXTRA_DEFECTO,
  PENALIDAD_TARDANZA_PCT_DEFECTO,
  MetodoValorHora,
  Modalidad,
  ReglaTarifaEspecial,
  aplicarTarifaEspecial,
  calcularDiaPlanilla,
  calcularPlanilla,
  horasYMinutos,
  pagoDia,
  pagoPorDiaPersona,
  periodoDe,
  redondear2,
  resumenTarifaEspecial,
  sueldoEquivalente,
  validarReglaTarifa,
  valorHoraPersona,
} from './planilla.calculo';
import { aplicarVacaciones, fechasDelRango } from './vacaciones.calculo';
import { TarifaEspecialDto } from './dto/planilla.dto';
import { PrestamoCalc, cuotaDelPeriodo, descuentoPersonalDelPeriodo, interesDeCuota, saldoPrestamo } from './prestamos.calculo';

export const MEDIOS_PAGO = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'] as const;
/** Lo que se descarta del pago de este período: cuotas de préstamo y descuentos recurrentes (ids) que NO se cobran. */
/** `incluirAnteriores`: consumos de períodos anteriores que SÍ se cobran en este pago (por defecto pasan al siguiente). */
export interface OmitirPeriodo {
  cuotas?: string[];
  recurrentes?: string[];
  incluirAnteriores?: string[];
  /** Rango libre (solo consulta, no se paga): sueldo prorrateado por días y sin cuotas ni descuentos automáticos del período. */
  rangoLibre?: boolean;
}
export const TIPOS_SELECCION = ['CONSUMO_EXCLUIDO', 'CONSUMO_ANTERIOR_INCLUIDO', 'CUOTA_OMITIDA', 'RECURRENTE_OMITIDO'] as const;
export type TipoSeleccion = (typeof TIPOS_SELECCION)[number];

/**
 * Une lo que llega por query con las selecciones guardadas. Cada tipo tiene un solo sentido (excluir, omitir o incluir),
 * así que la unión nunca se contradice; desmarcar una selección la borra de la tabla.
 */
export function unirSelecciones(
  excluir: string[],
  omitir: OmitirPeriodo,
  guardadas: Array<{ tipo: string; ref_id: string }>,
): { excluir: string[]; omitir: OmitirPeriodo } {
  const de = (t: TipoSeleccion) => guardadas.filter((g) => g.tipo === t).map((g) => g.ref_id);
  const unir = (a: string[] = [], b: string[]) => [...new Set([...a, ...b])];
  return {
    excluir: unir(excluir, de('CONSUMO_EXCLUIDO')),
    omitir: {
      ...omitir,
      cuotas: unir(omitir.cuotas, de('CUOTA_OMITIDA')),
      recurrentes: unir(omitir.recurrentes, de('RECURRENTE_OMITIDO')),
      incluirAnteriores: unir(omitir.incluirAnteriores, de('CONSUMO_ANTERIOR_INCLUIDO')),
    },
  };
}

/** Confirmaciones del admin al pagar, que quedan en el pago y en la auditoría. */
export interface ConfirmacionesPago {
  /** «Pagar igual»: motivo (mín. 10 caracteres) para pagar con jornadas pendientes. Solo ADMIN. */
  pagarIgualMotivo?: string;
  /** Confirmó pagar sin descontar los créditos de períodos anteriores que siguen sin cobrar. */
  sinDescontarAnteriores?: boolean;
}

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
/** Fecha de inicio de un sueldo que rige «desde siempre» (el de antes de llevar historial). */
const DESDE_SIEMPRE = '1900-01-01';
const pagoDe = (s: any) => ({ celular: (s.pago_celular as string | null) ?? null, medio: (s.pago_medio as string | null) ?? null });

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ETIQUETA_DESCUENTO: Record<string, string> = { CONSUMO: 'Consumo', MERMA: 'Merma', DANO: 'Daño', PRESTAMO: 'Préstamo', NETFLIX: 'Netflix', OTRO: 'Otro' };
const ETIQUETA_PERIODICIDAD_API: Record<string, string> = { SEMANAL: 'cada semana', MENSUAL: 'cada mes', UNICA: 'una sola vez' };
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const horas = (min: number) => Math.round((min / 60) * 100) / 100;
const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutosDeHora = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** Fila de tarifa_especial_persona → forma de la API (fechas ISO, hora HH:MM). */
const tarifaDeFila = (f: any) => ({
  id: Number(f.id),
  diaSemana: f.dia_semana as number,
  desdeHora: aHoraTexto(f.desde_minutos as number),
  tarifaHora: Number(f.tarifa_hora),
  vigenteDesde: isoDe(f.vigente_desde),
  vigenteHasta: f.vigente_hasta ? isoDe(f.vigente_hasta) : null,
  activa: f.activa as boolean,
  nota: (f.nota as string | null) ?? null,
});
const reglaDeFila = (f: any): ReglaTarifaEspecial => ({
  diaSemana: f.dia_semana,
  desdeMin: f.desde_minutos,
  tarifaHora: Number(f.tarifa_hora),
  vigenteDesde: isoDe(f.vigente_desde),
  vigenteHasta: f.vigente_hasta ? isoDe(f.vigente_hasta) : null,
  activa: f.activa,
});

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
    // Sugerencia para «Celular de pago»: el celular activo de la persona (9 dígitos). Dato personal: solo aquí, nunca en listas ni en auditoría.
    const c = await this.prisma.contactMechanism.findFirst({
      where: { party_id: BigInt(partyId), tipo: { in: ['TELEFONO', 'WHATSAPP'] }, activo: true },
      orderBy: [{ principal: 'desc' }, { id: 'asc' }],
      select: { valor: true },
    });
    const digitos = (c?.valor ?? '').replace(/\D/g, '');
    const celularUsuario = digitos.length >= 9 ? digitos.slice(-9) : null;
    const filas = await this.prisma.sueldoVigencia.findMany({ where: { party_id: BigInt(partyId) }, orderBy: { vigente_desde: 'desc' } });
    // Historial del sueldo: «vigenteDesde» vacío = desde siempre (el sueldo que ya tenía antes de llevar historial)
    const historial = filas.map((f) => ({ ...sueldoDe(f), vigenteDesde: isoDe(f.vigente_desde) === DESDE_SIEMPRE ? null : isoDe(f.vigente_desde), creadoEn: f.creado_en.toISOString() }));
    return { sueldo: s ? sueldoDe(s) : null, pago: s ? pagoDe(s) : null, historial, ...(celularUsuario ? { celularUsuario } : {}) };
  }

  async guardarSueldo(
    partyId: number,
    dto: { modalidad: Modalidad; monto: number; vigenteDesde?: string; metodo?: MetodoValorHora; diasMes?: number | null; horasDia?: number | null; tarifaHora?: number | null; pagoCelular?: string | null; pagoMedio?: string | null },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
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
    // Sueldo con vigencia: un cambio en las cifras es una fila nueva con su fecha de inicio (hoy por defecto); no se pisa el historial.
    const hoy = jornadaDe(ahora).jornada;
    // Sin fecha: rige desde el inicio del período abierto (no desde hoy: si no, la semana en curso mezclaba la tarifa vieja
    // en los días anteriores y parecía que el cambio no se guardaba). Nunca antes del día siguiente al último período pagado.
    let desde = dto.vigenteDesde ? fechaValida(dto.vigenteDesde) : DESDE_SIEMPRE;
    if (!dto.vigenteDesde && antes) {
      const ultimoPagado = await this.prisma.planillaPeriodo.findFirst({ where: { party_id: id, estado: 'PAGADO' }, orderBy: { hasta: 'desc' } });
      const trasPagado = ultimoPagado ? sumarDias(isoDe(ultimoPagado.hasta), 1) : '';
      const inicio = periodoDe(dto.modalidad, hoy).desde;
      desde = trasPagado > inicio ? trasPagado : inicio;
      if (desde > hoy) desde = hoy;
    }
    if (desde > hoy) throw new BadRequestException({ codigo: 'FECHA_FUTURA', mensaje: 'El sueldo nuevo puede regir desde hoy o desde un día pasado, no desde el futuro' });
    const nuevo = { modalidad: dto.modalidad, monto_semanal: eq.semanal, monto_mensual: eq.mensual, metodo_valor_hora: metodo,
      dias_mes: dto.diasMes !== undefined ? dto.diasMes : antes?.dias_mes ?? null, horas_dia: dto.horasDia !== undefined ? dto.horasDia : antes?.horas_dia ?? null,
      tarifa_hora: dto.tarifaHora !== undefined ? dto.tarifaHora : antes?.tarifa_hora ?? null };
    const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
    const cambioCifras = !antes || (['modalidad', 'metodo_valor_hora'] as const).some((k) => antes[k] !== nuevo[k])
      || (['monto_semanal', 'monto_mensual', 'dias_mes', 'horas_dia', 'tarifa_hora'] as const).some((k) => num(antes[k]) !== num(nuevo[k]));
    let esUltima = true;
    if (cambioCifras) {
      const pagadoDespues = antes ? await this.prisma.planillaPeriodo.findFirst({ where: { party_id: id, estado: 'PAGADO', hasta: { gte: fechaDb(desde) } } }) : null;
      if (pagadoDespues) {
        throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Hay un período pagado desde esa fecha. Elige una fecha posterior al último período pagado o reábrelo (con motivo).' });
      }
      const filas = await this.prisma.sueldoVigencia.findMany({ where: { party_id: id }, orderBy: { vigente_desde: 'asc' } });
      // Persona con sueldo anterior al historial: primero se guarda lo que tenía «desde siempre» (para no perderlo)
      if (antes && filas.length === 0) {
        await this.prisma.sueldoVigencia.create({ data: { party_id: id, vigente_desde: fechaDb(DESDE_SIEMPRE), modalidad: antes.modalidad, monto_semanal: antes.monto_semanal, monto_mensual: antes.monto_mensual,
          metodo_valor_hora: antes.metodo_valor_hora, dias_mes: antes.dias_mes, horas_dia: antes.horas_dia, tarifa_hora: antes.tarifa_hora, creado_por: antes.actualizado_por } });
      }
      esUltima = !filas.length || filas.every((f) => isoDe(f.vigente_desde) <= desde);
      const fila = { ...nuevo, creado_en: new Date(), creado_por: usuario.partyId };
      await this.prisma.sueldoVigencia.upsert({ where: { party_id_vigente_desde: { party_id: id, vigente_desde: fechaDb(desde) } }, create: { party_id: id, vigente_desde: fechaDb(desde), ...fila }, update: fila });
    }
    // sueldo_personal = el sueldo de hoy: solo cambian sus cifras si la fila nueva es la más reciente
    const soloPago = { ...(celular !== undefined ? { pago_celular: celular } : {}), ...(dto.pagoMedio !== undefined ? { pago_medio: dto.pagoMedio || null } : {}) };
    await this.prisma.sueldoPersonal.upsert({ where: { party_id: id }, create: { party_id: id, ...datos }, update: esUltima ? datos : soloPago });
    // El celular es dato personal: la auditoría solo dice si cambió, nunca su valor.
    await this.auditar('CAMBIO', 'GUARDAR_SUELDO', usuario, ip, 'party', id, {
      antes: antes ? { modalidad: antes.modalidad, semanal: Number(antes.monto_semanal), mensual: Number(antes.monto_mensual), metodo: sueldoDe(antes).metodo } : null,
      despues: { modalidad: dto.modalidad, ...eq, metodo, vigenteDesde: cambioCifras ? desde : null, tarifaHora: dto.tarifaHora ?? null, diasMes: dto.diasMes ?? null, horasDia: dto.horasDia ?? null, pagoMedio: dto.pagoMedio ?? null, cambioCelular: celular !== undefined },
    });
    return { partyId, modalidad: dto.modalidad, ...eq, metodo };
  }

  // ---------------------------------------------------------------------------
  // Tarifas especiales por persona (p. ej. domingos desde las 19:00 a S/ 15 la hora)
  // ---------------------------------------------------------------------------

  async listarTarifasEspeciales(partyId: number) {
    const filas = await this.prisma.tarifaEspecialPersona.findMany({ where: { party_id: BigInt(partyId) }, orderBy: [{ vigente_desde: 'desc' }, { id: 'desc' }] });
    return { reglas: filas.map(tarifaDeFila) };
  }

  async crearTarifaEspecial(dto: TarifaEspecialDto, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    if (dto.partyId === undefined) throw new BadRequestException({ codigo: 'PERSONA_REQUERIDA', mensaje: 'Indica la persona' });
    const id = BigInt(dto.partyId);
    if (!(await this.prisma.userAccount.findUnique({ where: { party_id: id } }))) {
      throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    }
    if (dto.diaSemana === undefined || dto.desdeHora === undefined || dto.tarifaHora === undefined) {
      throw new BadRequestException({ codigo: 'DATOS_INCOMPLETOS', mensaje: 'Indica el día, la hora desde y la tarifa por hora' });
    }
    const datos = await this.datosTarifaValidos(id, {
      diaSemana: dto.diaSemana, desdeHora: dto.desdeHora, tarifaHora: dto.tarifaHora,
      vigenteDesde: dto.vigenteDesde ?? jornadaDe(ahora).jornada, vigenteHasta: dto.vigenteHasta || null,
      activa: dto.activa ?? true, nota: dto.nota?.trim() || null,
    }, null);
    const r = await this.prisma.tarifaEspecialPersona.create({ data: { ...datos, party_id: id, creado_por: usuario.partyId } });
    await this.auditar('CAMBIO', 'CREAR_TARIFA_ESPECIAL', usuario, ip, 'tarifa_especial_persona', r.id, {
      partyId: dto.partyId, diaSemana: datos.dia_semana, desdeHora: dto.desdeHora, tarifaHora: datos.tarifa_hora, vigenteDesde: dto.vigenteDesde ?? null, vigenteHasta: datos.vigente_hasta ? isoDe(datos.vigente_hasta) : null, activa: datos.activa,
    });
    return { ok: true, id: Number(r.id) };
  }

  /** Edita una regla o la desactiva (activa = false). Lo que no llega se conserva. */
  async editarTarifaEspecial(id: number, dto: TarifaEspecialDto, usuario: UsuarioAutenticado, ip?: string) {
    const f: any = await this.prisma.tarifaEspecialPersona.findUnique({ where: { id: BigInt(id) } });
    if (!f) throw new NotFoundException({ codigo: 'TARIFA_NO_ENCONTRADA', mensaje: 'Tarifa especial no encontrada' });
    const actual = tarifaDeFila(f);
    const datos = await this.datosTarifaValidos(f.party_id, {
      diaSemana: dto.diaSemana ?? actual.diaSemana,
      desdeHora: dto.desdeHora ?? actual.desdeHora,
      tarifaHora: dto.tarifaHora ?? actual.tarifaHora,
      vigenteDesde: dto.vigenteDesde ?? actual.vigenteDesde,
      vigenteHasta: dto.vigenteHasta !== undefined ? dto.vigenteHasta || null : actual.vigenteHasta,
      activa: dto.activa ?? actual.activa,
      nota: dto.nota !== undefined ? dto.nota.trim() || null : actual.nota,
    }, f.id);
    await this.prisma.tarifaEspecialPersona.update({ where: { id: f.id }, data: datos });
    await this.auditar('CAMBIO', dto.activa === false ? 'DESACTIVAR_TARIFA_ESPECIAL' : 'EDITAR_TARIFA_ESPECIAL', usuario, ip, 'tarifa_especial_persona', f.id, {
      partyId: Number(f.party_id), diaSemana: datos.dia_semana, desdeHora: aHoraTexto(datos.desde_minutos), tarifaHora: datos.tarifa_hora, vigenteDesde: isoDe(datos.vigente_desde), vigenteHasta: datos.vigente_hasta ? isoDe(datos.vigente_hasta) : null, activa: datos.activa,
    });
    return { ok: true };
  }

  /** Valida una regla completa (fechas, hora, tarifa y solapes con las activas de la persona) y devuelve sus columnas. */
  private async datosTarifaValidos(
    id: bigint,
    d: { diaSemana: number; desdeHora: string; tarifaHora: number; vigenteDesde: string; vigenteHasta: string | null; activa: boolean; nota: string | null },
    excluirId: bigint | null,
  ) {
    fechaValida(d.vigenteDesde);
    if (d.vigenteHasta) fechaValida(d.vigenteHasta);
    if (!HORA_HHMM.test(d.desdeHora)) throw new BadRequestException({ codigo: 'HORA_INVALIDA', mensaje: 'La hora «desde» debe ser HH:MM' });
    const tarifa = { dia_semana: d.diaSemana, desde_minutos: minutosDeHora(d.desdeHora), tarifa_hora: redondear2(d.tarifaHora), vigente_desde: fechaDb(d.vigenteDesde), vigente_hasta: d.vigenteHasta ? fechaDb(d.vigenteHasta) : null, activa: d.activa, nota: d.nota };
    const otras = await this.prisma.tarifaEspecialPersona.findMany({ where: { party_id: id, activa: true, ...(excluirId !== null ? { id: { not: excluirId } } : {}) } });
    const motivo = validarReglaTarifa({ diaSemana: d.diaSemana, desdeMin: tarifa.desde_minutos, tarifaHora: tarifa.tarifa_hora, vigenteDesde: d.vigenteDesde, vigenteHasta: d.vigenteHasta, activa: d.activa }, otras.map(reglaDeFila));
    if (motivo) throw new BadRequestException({ codigo: 'TARIFA_INVALIDA', mensaje: motivo });
    return tarifa;
  }

  // ---------------------------------------------------------------------------
  // Lista y detalle
  // ---------------------------------------------------------------------------

  /**
   * Una fila por persona activa (sin ADMIN). Sin `modo`: el período de cada persona según su modalidad (comportamiento clásico).
   * Con `modo` (SEMANA lunes–domingo | MES calendario) y la fecha, la regla cuando NO coincide con la modalidad de la persona es:
   *  - MES + persona SEMANAL: suma de sus semanas cuyo domingo cae en ese mes (cada semana con su propio estado; las pagadas
   *    salen congeladas). `semanas` lista cada una para abrirla/pagarla por separado.
   *  - SEMANA + persona MENSUAL: se muestra su mes (el que contiene el domingo de la semana) como referencia, con aviso
   *    «se paga por mes» y FUERA de los totales (si no, se contaría dos veces el sueldo del mes).
   */
  async listar(fecha?: string, ahora = new Date(), modo?: 'SEMANA' | 'MES' | 'RANGO', rango?: { desde?: string; hasta?: string }) {
    if (modo === 'RANGO') return this.listarRango(rango?.desde, rango?.hasta, ahora);
    const ref = fecha ? fechaValida(fecha) : jornadaDe(ahora).jornada;
    const cuentas = await this.prisma.userAccount.findMany({ where: { activo: true, rol: { not: 'ADMIN' } }, select: { party_id: true, rol: true } });
    const ids = cuentas.map((c) => c.party_id);
    const rolDe = new Map(cuentas.map((c) => [c.party_id, c.rol as string]));
    const [sueldos, personas, vinculos] = await Promise.all([
      this.prisma.sueldoPersonal.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.person.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.vinculoPersonal.findMany({ where: { party_id: { in: ids }, vigente_hasta: null } }),
    ]);
    const vinculoDe = new Map(vinculos.map((v) => [v.party_id, { tipo: v.tipo, fechaIngreso: isoDe(v.fecha_ingreso), fechaFin: v.fecha_fin ? isoDe(v.fecha_fin) : null }]));
    const nombre = new Map(personas.map((p) => [p.party_id, [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
    const vista = modo ? periodoDe(modo === 'SEMANA' ? 'SEMANAL' : 'MENSUAL', ref) : null;
    const filas: any[] = [];
    for (const id of ids) {
      const s = sueldos.find((x) => x.party_id === id);
      const base = { partyId: Number(id), nombre: nombre.get(id) ?? `Persona ${id}`, rol: rolDe.get(id) ?? null, vinculo: vinculoDe.get(id) ?? null };
      if (!s) {
        filas.push({ ...base, sueldo: null });
        continue;
      }
      const modalidad = s.modalidad as Modalidad;
      let ds: any[];
      let extra: Record<string, unknown> = {};
      if (!vista || (modo === 'SEMANA') === (modalidad === 'SEMANAL')) {
        ds = [await this.detalle(Number(id), vista ? vista.desde : ref, [], ahora)];
      } else if (modo === 'MES') {
        // semanas (lunes–domingo) cuyo domingo cae dentro del mes
        const semanas: string[] = [];
        for (let d = periodoDe('SEMANAL', vista!.desde).desde; d <= vista!.hasta; d = sumarDias(d, 7)) {
          const domingo = sumarDias(d, 6);
          if (domingo >= vista!.desde && domingo <= vista!.hasta) semanas.push(d);
        }
        ds = [];
        for (const d of semanas) ds.push(await this.detalle(Number(id), d, [], ahora));
        extra = { aviso: `Se paga por semana: suma de ${ds.length} semanas del mes` };
      } else {
        ds = [await this.detalle(Number(id), sumarDias(vista!.desde, 6), [], ahora)];
        extra = { fueraDeModalidad: true, aviso: 'Se paga por mes: se muestra su mes (no suma en los totales de la semana)' };
      }
      filas.push({ ...base, ...this.filaDeDetalles(ds), ...extra });
    }
    const enTotales = filas.filter((f) => f.sueldo && !f.fueraDeModalidad);
    const sum = (g: (f: any) => number) => redondear2(enTotales.reduce((a, f) => a + (g(f) || 0), 0));
    const totales = {
      personas: enTotales.length,
      aPagar: sum((f) => f.neto),
      pagado: sum((f) => f.netoPagado),
      pendiente: sum((f) => f.netoPendiente),
      pagados: enTotales.filter((f) => f.estado === 'PAGADO').length,
    };
    return { fecha: ref, modo: modo ?? null, vista, totales, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  }

  /**
   * Rango libre «desde / hasta» (máx. 93 días): horas, ganado, penalidad, bonos, descuentos y adelantos manuales y consumos de TODO el
   * rango, por persona. Es una consulta (estimado): no se paga aquí; el pago sigue siendo por la semana o el mes de cada persona
   * (cuotas y descuentos automáticos se aplican al pagar su período). El sueldo para PROGRAMADAS se prorratea por días.
   */
  async listarRango(desde: string | undefined, hasta: string | undefined, ahora = new Date()) {
    const d = fechaValida(desde ?? jornadaDe(ahora).jornada);
    const h = fechaValida(hasta ?? d);
    if (h < d) throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: 'La fecha «hasta» no puede ser anterior a «desde»' });
    if (fechasDelRango(d, h).length > 93) throw new BadRequestException({ codigo: 'RANGO_LARGO', mensaje: 'El rango no puede pasar de 93 días' });
    const cuentas = await this.prisma.userAccount.findMany({ where: { activo: true, rol: { not: 'ADMIN' } }, select: { party_id: true, rol: true } });
    const ids = cuentas.map((c) => c.party_id);
    const rolDe = new Map(cuentas.map((c) => [c.party_id, c.rol as string]));
    const [sueldos, personas, vinculos] = await Promise.all([
      this.prisma.sueldoPersonal.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.person.findMany({ where: { party_id: { in: ids } } }),
      this.prisma.vinculoPersonal.findMany({ where: { party_id: { in: ids }, vigente_hasta: null } }),
    ]);
    const nombre = new Map(personas.map((p) => [p.party_id, [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
    const filas: any[] = [];
    for (const id of ids) {
      const s = sueldos.find((x) => x.party_id === id);
      const v = vinculos.find((x) => x.party_id === id);
      const base = { partyId: Number(id), nombre: nombre.get(id) ?? `Persona ${id}`, rol: rolDe.get(id) ?? null, vinculo: v ? { tipo: v.tipo, fechaIngreso: isoDe(v.fecha_ingreso), fechaFin: v.fecha_fin ? isoDe(v.fecha_fin) : null } : null };
      if (!s) { filas.push({ ...base, sueldo: null }); continue; }
      const calc = await this.calcular(id, sueldoDe(s), { desde: d, hasta: h }, new Set(), ahora, { rangoLibre: true });
      filas.push({
        ...base,
        ...this.filaDeDetalles([{ ...calc, sueldo: sueldoDe(s), pago: pagoDe(s), estado: 'ABIERTO' }]),
        estado: 'ABIERTO',
        estimado: true,
        aviso: 'Rango libre: estimado. Para pagar abre su semana o su mes.',
      });
    }
    const sum = (g: (f: any) => number) => redondear2(filas.filter((f) => f.sueldo).reduce((a, f) => a + (g(f) || 0), 0));
    const totales = { personas: filas.filter((f) => f.sueldo).length, aPagar: sum((f) => f.neto), pagado: 0, pendiente: sum((f) => f.neto), pagados: 0 };
    return { fecha: d, modo: 'RANGO' as const, vista: { desde: d, hasta: h }, totales, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  }

  /** Une 1..n detalles semanales (o uno solo) en la fila que ve la lista. Los períodos pagados ya vienen congelados. */
  private filaDeDetalles(ds: any[]) {
    const r = (g: (d: any) => number) => redondear2(ds.reduce((a, d) => a + (g(d) || 0), 0));
    const primero = ds[0];
    const porCat: Record<string, number> = {};
    for (const d of ds) for (const [c, m] of Object.entries(d.resultado.descuentosPorCategoria ?? {})) porCat[c] = redondear2((porCat[c] ?? 0) + (m as number));
    const minTot = ds.reduce((a, d) => a + (d.excel.horasLaboradas * 60 + d.excel.minutosLaborados), 0);
    const neto = r((d) => d.resultado.neto);
    const netoPagado = r((d) => (d.estado === 'PAGADO' ? d.resultado.neto : 0));
    const todosPagados = ds.every((d) => d.estado === 'PAGADO');
    const abrir = ds.find((d) => d.estado !== 'PAGADO') ?? primero;
    return {
      sueldo: primero.sueldo,
      pago: primero.pago,
      periodo: { desde: ds[0].periodo.desde, hasta: ds[ds.length - 1].periodo.hasta },
      /** Fecha con la que se abre el panel (la primera semana sin pagar). */
      abrirFecha: abrir.periodo.desde,
      estado: todosPagados ? 'PAGADO' : 'ABIERTO',
      semanas: ds.length > 1 ? ds.map((d) => ({ desde: d.periodo.desde, hasta: d.periodo.hasta, estado: d.estado, neto: d.resultado.neto, pendientes: d.pendientes })) : undefined,
      excel: {
        ...primero.excel,
        pagoPorDia: ds.length > 1 ? null : primero.excel.pagoPorDia,
        horasLaboradas: Math.floor(minTot / 60),
        minutosLaborados: minTot % 60,
        horasExtra: r((d) => d.excel.horasExtra),
        total: r((d) => d.resultado.ganado),
        adicional: r((d) => d.resultado.adicional),
        descuentos: r((d) => d.excel.descuentos),
        penalidadTardanza: r((d) => d.resultado.penalidadTardanza),
        descuentosPorCategoria: porCat,
        netoAPagar: r((d) => d.resultado.netoAPagar),
        adelanto: r((d) => d.resultado.adelantos),
        diferencia: neto,
      },
      programadasH: r((d) => d.resumen.programadasH),
      trabajadasH: r((d) => d.resumen.trabajadasH),
      ganado: r((d) => d.resultado.ganado),
      consumos: r((d) => d.resultado.consumosCobrados),
      consumosAnterioresPendiente: ds[0].consumosAnterioresPendiente ?? 0,
      adicional: r((d) => d.resultado.adicional),
      netoAPagar: r((d) => d.resultado.netoAPagar),
      descuentosPorCategoria: porCat,
      descuentos: r((d) => d.resultado.descuentos),
      adelantos: r((d) => d.resultado.adelantos),
      neto,
      netoPagado,
      netoPendiente: redondear2(neto - netoPagado),
      pendientes: ds.reduce((a, d) => a + (d.pendientes ?? 0), 0),
    };
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
    // Lo marcado en pantallas anteriores queda guardado por persona y período; el pago usa la misma unión
    const guardadas = omitir.rangoLibre
      ? []
      : await this.prisma.planillaSeleccion.findMany({ where: { party_id: id, periodo_desde: fechaDb(periodo.desde) } });
    const u = unirSelecciones(excluirConsumoIds, omitir, guardadas);
    const calc = await this.calcular(id, sueldo, periodo, new Set(u.excluir), ahora, u.omitir);
    return { ...calc, sueldo, pago, estado: 'ABIERTO', periodoId: null };
  }

  /**
   * Guarda (o quita) una selección del pago de un período abierto: consumos, cuotas y descuentos personalizados.
   * Los pagos ya hechos no cambian; reabrir el período vuelve a usar las selecciones guardadas.
   */
  async seleccionar(partyId: number, fecha: string, tipo: TipoSeleccion, refId: string, activo: boolean, usuario: UsuarioAutenticado, ip?: string) {
    const id = BigInt(partyId);
    fechaValida(fecha);
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } });
    if (!s) throw new NotFoundException({ codigo: 'SIN_SUELDO', mensaje: 'Esa persona todavía no tiene sueldo configurado' });
    const periodo = periodoDe(s.modalidad as Modalidad, fecha);
    await this.exigirPeriodoAbierto(id, fecha);
    const clave = { party_id: id, periodo_desde: fechaDb(periodo.desde), tipo, ref_id: refId };
    if (activo) {
      await this.prisma.planillaSeleccion.upsert({
        where: { party_id_periodo_desde_tipo_ref_id: clave },
        create: { ...clave, creado_por: usuario.partyId },
        update: {},
      });
    } else {
      await this.prisma.planillaSeleccion.deleteMany({ where: clave });
    }
    await this.auditar('CAMBIO', activo ? 'MARCAR_SELECCION_PLANILLA' : 'QUITAR_SELECCION_PLANILLA', usuario, ip, 'party', id, { periodo: periodo.desde, tipo, refId });
    return { ok: true, activo };
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
    const [extras, ajustes, consumosBd, persona, feriadosBd, prestamosBd, recurrentesBd, tarifasBd] = await Promise.all([
      this.prisma.planillaExtraAprobada.findMany({ where: { party_id: id, jornada: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } } }),
      this.prisma.planillaAjuste.findMany({
        where: { party_id: id, fecha: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } },
        orderBy: { creado_en: 'asc' },
      }),
      // Pendientes hasta el fin del período (incluye los que otro período dejó pasar)
      this.prisma.consumoPersonal.findMany({
        where: { party_id: id, pagado_en: null, fecha: { lte: fechaDb(periodo.hasta) }, pedido: { estado: { notIn: ['ANULADO', 'RECHAZADO'] } } },
        include: { pedido: { select: { codigo: true, lineas: { select: { cantidad: true, nombre: true, tamano: true, linea_combo_id: true } } } } },
        orderBy: { fecha: 'asc' },
      }),
      this.prisma.person.findUnique({ where: { party_id: id } }),
      tercerizado ? Promise.resolve([] as any[]) : this.prisma.feriado.findMany({ where: { activo: true, fecha: { gte: fechaDb(periodo.desde), lte: fechaDb(periodo.hasta) } } }),
      omitir.rangoLibre ? Promise.resolve([] as any[]) : this.prisma.prestamoPersonal.findMany({ where: { party_id: id, estado: 'ACTIVO' }, include: { cuotas: true }, orderBy: { id: 'asc' } }),
      omitir.rangoLibre ? Promise.resolve([] as any[]) : this.prisma.descuentoRecurrentePersonal.findMany({ where: { party_id: id, activo: true }, orderBy: { id: 'asc' } }),
      this.prisma.tarifaEspecialPersona.findMany({ where: { party_id: id, activa: true } }),
    ]);
    // Feriado activo: las horas trabajadas de esa jornada se pagan a valor hora × recargo (ver pagoDia en planilla.calculo).
    const feriados = new Map(feriadosBd.map((f) => [isoDe(f.fecha), { nombre: f.nombre, recargo: Number(f.recargo) }]));
    // Tarifa especial de la persona (regla por día de la semana y vigencia): reemplaza el feriado ese día (sin recargo).
    const reglasEsp = tarifasBd.map(reglaDeFila);
    const diasCalc = diasBase.map((c) => {
      const f = feriados.get(c.jornada);
      const conTarifa = aplicarTarifaEspecial(c, reglasEsp);
      // un día de vacación tomada se paga normal (sin recargo)
      return f && f.recargo !== 1 && c.estado !== 'VACACIONES' && !conTarifa.tarifaEspecial ? { ...conTarifa, recargo: f.recargo } : conTarifa;
    });
    const vigentes = ajustes.filter((a) => !a.anulado_en);
    // Mismo origen que Admin › Créditos (consumo_personal sin pagado_en). Los del período se cobran salvo que se excluyan;
    // los de períodos anteriores quedan sin cobrar salvo que el admin los marque (`incluirAnteriores`).
    const incluirAnt = new Set(omitir.incluirAnteriores ?? []);
    const consumos = consumosBd.map((c) => {
      const anterior = isoDe(c.fecha) < periodo.desde;
      const idc = c.id.toString();
      return {
        id: idc,
        fecha: isoDe(c.fecha),
        pedido: c.pedido?.codigo ?? `P-${c.pedido_id}`,
        // productos (las partes de un combo no se listan: va solo la madre, como en Créditos)
        productos: (c.pedido?.lineas ?? []).filter((l: any) => l.linea_combo_id == null).map((l: any) => `${l.cantidad} × ${l.nombre}${l.tamano ? ` (${l.tamano})` : ''}`),
        monto: Number(c.monto),
        anterior,
        cobrar: anterior ? incluirAnt.has(idc) : !excluidos.has(idc),
      };
    });
    const consumosAnterioresPendiente = redondear2(consumos.filter((c) => c.anterior && !c.cobrar).reduce((a, c) => a + c.monto, 0));
    const extrasSet = new Set(extras.map((e) => isoDe(e.jornada)));
    const sueldoCompleto = sueldo.modalidad === 'SEMANAL' ? sueldo.semanal : sueldo.mensual;
    // Rango libre: el sueldo del período se prorratea por días (solo afecta al método PROGRAMADAS; los demás usan valor hora fijo).
    const diasRango = fechasDelRango(periodo.desde, periodo.hasta).length;
    const diasPeriodoCompleto = sueldo.modalidad === 'SEMANAL' ? 7 : fechasDelRango(periodoDe('MENSUAL', periodo.desde).desde, periodoDe('MENSUAL', periodo.desde).hasta).length;
    const sueldoPeriodo = omitir.rangoLibre ? redondear2((sueldoCompleto * diasRango) / diasPeriodoCompleto) : sueldoCompleto;
    // Valor hora de la persona: DIAS_HORAS y TARIFA_HORA fijan uno propio; PROGRAMADAS usa sueldo ÷ horas programadas.
    const parametros = {
      metodo: sueldo.metodo,
      sueldoMensual: sueldo.mensual,
      diasMes: sueldo.diasMes ?? cfg.diasMesDefecto ?? DIAS_MES_DEFECTO,
      horasDia: sueldo.horasDia ?? cfg.horasDiaDefecto ?? HORAS_DIA_DEFECTO,
      tarifaHora: sueldo.tarifaHora ?? 0,
    };
    const vhFijo = valorHoraPersona(parametros);
    // Sueldo con vigencia: cada día se paga con el valor hora del sueldo vigente ese día (solo si hubo cambios de sueldo).
    const vigencias = await this.prisma.sueldoVigencia.findMany({ where: { party_id: id }, orderBy: { vigente_desde: 'asc' } });
    if (vigencias.length > 1) {
      for (const d of diasCalc) {
        const fila = [...vigencias].reverse().find((v) => isoDe(v.vigente_desde) <= d.jornada) ?? vigencias[0];
        const sd = sueldoDe(fila);
        const vh = valorHoraPersona({ metodo: sd.metodo, sueldoMensual: sd.mensual, diasMes: sd.diasMes ?? cfg.diasMesDefecto ?? DIAS_MES_DEFECTO, horasDia: sd.horasDia ?? cfg.horasDiaDefecto ?? HORAS_DIA_DEFECTO, tarifaHora: sd.tarifaHora ?? 0 });
        if (vh !== null) d.valorHora = vh;
      }
    }
    const multExtra = sueldo.metodo === 'PROGRAMADAS' ? 1 : cfg.multiplicadorExtra ?? MULTIPLICADOR_EXTRA_DEFECTO;
    // Penalidad por tardanza: factor % del valor del tiempo no pagado. Contrato temporal (sin subordinación): sin penalidad
    // (el tiempo tarde igual no se paga, porque solo se pagan las horas trabajadas).
    const penalidadTardanzaPct = tercerizado ? 0 : cfg.tardanzaPenalidadPct ?? PENALIDAD_TARDANZA_PCT_DEFECTO;
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
        ? [{
            id: c.id,
            prestamoId: c.prestamoId,
            numero: c.numero,
            numCuotas: p.cuotas.filter((x: any) => !x.reprogramada_de).length,
            monto: c.monto,
            // Desglose (interés simple mensual opcional): capital = monto − interés; saldo = capital + interés − cuotas ya descontadas
            interesPctMensual: Number(p.interes_pct_mensual ?? 0),
            interesCuota: interesDeCuota(c.monto, Number(p.monto), Number(p.interes_monto ?? 0)),
            capitalCuota: redondear2(c.monto - interesDeCuota(c.monto, Number(p.monto), Number(p.interes_monto ?? 0))),
            saldo: saldoPrestamo(Number(p.monto) + Number(p.interes_monto ?? 0), calc.cuotas),
            motivo: (p.motivo as string | null) ?? null, cobrar: !omitC.has(c.id) }]
        : [];
    });
    // Descuentos y bonos personalizados: solo los que corresponden a este período (vigencia, única vez, semanal o mensual)
    const recurrentes = recurrentesBd.flatMap((r: any) => {
      const monto = descuentoPersonalDelPeriodo(
        { valor: Number(r.monto), valorTipo: r.valor_tipo === 'PORCENTAJE' ? 'PORCENTAJE' : 'MONTO', periodicidad: (r.periodicidad ?? 'SEMANAL') as 'SEMANAL' | 'MENSUAL' | 'UNICA', desde: r.desde ? isoDe(r.desde) : '1900-01-01', hasta: r.hasta ? isoDe(r.hasta) : null },
        sueldo.modalidad, periodo, { semanal: sueldo.semanal, mensual: sueldo.mensual },
      );
      return monto === null ? [] : [{
        id: r.id.toString(),
        tipo: r.tipo as string,
        nombre: r.nombre as string,
        periodicidad: (r.periodicidad ?? 'SEMANAL') as 'SEMANAL' | 'MENSUAL' | 'UNICA',
        signo: (r.signo === 'BONO' ? 'BONO' : 'DESCUENTO') as 'BONO' | 'DESCUENTO',
        valorTipo: (r.valor_tipo === 'PORCENTAJE' ? 'PORCENTAJE' : 'MONTO') as 'MONTO' | 'PORCENTAJE',
        valor: Number(r.monto),
        desde: r.desde ? isoDe(r.desde) : '1900-01-01',
        hasta: r.hasta ? isoDe(r.hasta) : null,
        monto,
        cobrar: !omitR.has(r.id.toString()),
      }];
    });
    const lineasDescuento = [
      ...vigentes.filter((a) => a.tipo === 'DESCUENTO').map((a) => ({ categoria: (CATEGORIAS_DESCUENTO as readonly string[]).includes(a.categoria) ? a.categoria : 'OTRO', monto: Number(a.monto) })),
      ...cuotas.filter((c) => c.cobrar).map((c) => ({ categoria: 'PRESTAMO', monto: c.monto })),
      ...recurrentes.filter((r) => r.cobrar && r.signo === 'DESCUENTO').map((r) => ({ categoria: r.tipo === 'NETFLIX' ? 'NETFLIX' : 'OTRO', monto: r.monto })),
    ];
    // Descuentos personalizados que NO caen en este período (empiezan después o ya terminaron): se explica en pantalla
    const recurrentesFueraDePeriodo = recurrentesBd.flatMap((r: any) => {
      const desde = r.desde ? isoDe(r.desde) : '1900-01-01';
      const hasta = r.hasta ? isoDe(r.hasta) : null;
      const empieza = desde > periodo.hasta;
      if (!empieza && !(hasta && hasta < periodo.desde)) return [];
      const proximoPeriodo: { desde: string; hasta: string } | null = empieza ? periodoDe(sueldo.modalidad as Modalidad, desde) : null;
      return [{
        id: r.id.toString(),
        nombre: r.nombre as string,
        signo: (r.signo === 'BONO' ? 'BONO' : 'DESCUENTO') as 'BONO' | 'DESCUENTO',
        periodicidad: (r.periodicidad ?? 'SEMANAL') as 'SEMANAL' | 'MENSUAL' | 'UNICA',
        valorTipo: (r.valor_tipo === 'PORCENTAJE' ? 'PORCENTAJE' : 'MONTO') as 'MONTO' | 'PORCENTAJE',
        valor: Number(r.monto),
        estado: (empieza ? 'EMPIEZA' : 'TERMINO') as 'EMPIEZA' | 'TERMINO',
        desde,
        hasta,
        proximoPeriodo,
      }];
    });
    const bonosPersonales = recurrentes.filter((r) => r.cobrar && r.signo === 'BONO').map((r) => r.monto);
    const resultado = calcularPlanilla({
      valorHora: vhFijo ?? undefined,
      multiplicadorExtra: multExtra,
      lineasDescuento,
      bonos: [...vigentes.filter((a) => a.tipo === 'BONO').map((a) => Number(a.monto)), ...bonosPersonales],
      modalidad: sueldo.modalidad,
      sueldoPeriodo,
      dias: diasCalc,
      penalidadTardanzaPct,
      extrasAprobadas: extrasSet,
      consumos,
      descuentos: [],
      adelantos: vigentes.filter((a) => a.tipo === 'ADELANTO').map((a) => Number(a.monto)),
      vacacionesPagadas: vacPagadas.map((v) => Number(v.monto ?? 0)),
    });
    // Desglose legible de cada parte del neto (mismas cifras que resultado; el neto no cambia)
    const desglose: Array<{ grupo: 'TARDANZA' | 'CONSUMO' | 'ADELANTO' | 'DESCUENTO' | 'PRESTAMO' | 'RECURRENTE' | 'BONO'; concepto: string; monto: number; detalle?: string }> = [
      ...(resultado.penalidadTardanza > 0 ? [{ grupo: 'TARDANZA' as const, concepto: `Tardanza (${resultado.tardanzaMin} min)`, monto: resultado.penalidadTardanza, detalle: 'La hora tarde no se paga y además se descuenta su penalidad' }] : []),
      ...(resultado.consumosCobrados > 0 ? [{ grupo: 'CONSUMO' as const, concepto: `Consumos del personal (${consumos.filter((c) => c.cobrar).length})`, monto: resultado.consumosCobrados }] : []),
      ...vigentes.filter((a) => a.tipo === 'ADELANTO').map((a) => ({ grupo: 'ADELANTO' as const, concepto: 'Adelanto', monto: Number(a.monto), detalle: a.motivo as string })),
      ...vigentes.filter((a) => a.tipo === 'DESCUENTO').map((a) => ({ grupo: 'DESCUENTO' as const, concepto: ETIQUETA_DESCUENTO[(CATEGORIAS_DESCUENTO as readonly string[]).includes(a.categoria) ? a.categoria : 'OTRO'], monto: Number(a.monto), detalle: a.motivo as string })),
      ...cuotas.filter((c) => c.cobrar).map((c) => ({ grupo: 'PRESTAMO' as const, concepto: `Cuota ${c.numero} de ${c.numCuotas} del préstamo`, monto: c.monto })),
      ...recurrentes.filter((r) => r.cobrar && r.signo === 'DESCUENTO').map((r) => ({ grupo: 'RECURRENTE' as const, concepto: r.nombre, monto: r.monto, detalle: ETIQUETA_PERIODICIDAD_API[r.periodicidad] })),
      ...vigentes.filter((a) => a.tipo === 'BONO').map((a) => ({ grupo: 'BONO' as const, concepto: 'Bono', monto: Number(a.monto), detalle: a.motivo as string })),
      ...recurrentes.filter((r) => r.cobrar && r.signo === 'BONO').map((r) => ({ grupo: 'BONO' as const, concepto: r.nombre, monto: r.monto, detalle: ETIQUETA_PERIODICIDAD_API[r.periodicidad] })),
    ];
    const porDia = new Map(extras.map((e) => [isoDe(e.jornada), e]));
    // Pendiente = jornada que bloquea el pago. Un descanso trabajado que el admin ya aprobó deja de bloquear.
    const diasPendientes = diasCalc.filter((d) => (ESTADOS_PENDIENTES as readonly string[]).includes(d.estado) && !(d.descansoTrabajado && porDia.has(d.jornada)));
    const crudo = new Map(dias.map((d) => [d.jornada, d]));
    return {
      partyId: Number(id),
      nombre: persona ? [persona.nombres, persona.apellidos].filter(Boolean).join(' ') : `Persona ${id}`,
      periodo,
      toleranciaMin: cfg.toleranciaMin,
      penalidadTardanzaPct,
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
        descuentos: redondear2(resultado.descuentos + resultado.consumosCobrados + resultado.penalidadTardanza),
        penalidadTardanza: resultado.penalidadTardanza,
        descuentosPorCategoria: resultado.descuentosPorCategoria,
        netoAPagar: resultado.netoAPagar,
        adelanto: resultado.adelantos,
        diferencia: resultado.neto,
      },
      cuotas,
      recurrentes,
      recurrentesFueraDePeriodo,
      desglose,
      pendientes: diasPendientes.length,
      /** Jornadas que bloquean «Marcar pagado» (para el banner y su enlace al día). */
      jornadasPorRevisar: diasPendientes.map((d) => d.jornada),
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
        ganado: redondear2(pagoDia(d, resultado.valorHoraExacto, porDia.has(d.jornada), multExtra)),
        extraAprobada: porDia.has(d.jornada),
        extraAprobadaPor: porDia.has(d.jornada) ? Number(porDia.get(d.jornada)!.aprobado_por) : null,
        extraAprobadaEn: porDia.has(d.jornada) ? porDia.get(d.jornada)!.aprobado_en.toISOString() : null,
        tarifaEspecial: resumenTarifaEspecial(d, porDia.has(d.jornada)),
      })),
      consumos,
      consumosAnterioresPendiente,
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
  async pagar(partyId: number, fecha: string, excluirConsumoIds: string[], usuario: UsuarioAutenticado, ip?: string, ahora = new Date(), omitir: OmitirPeriodo = {}, confirma: ConfirmacionesPago = {}) {
    const id = BigInt(partyId);
    const d = await this.detalle(partyId, fecha, excluirConsumoIds, ahora, omitir);
    if (d.estado === 'PAGADO') throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Ese período ya está pagado' });
    let pagarIgual: { motivo: string; jornadas: string[] } | null = null;
    if (d.pendientes > 0 && confirma.pagarIgualMotivo !== undefined) {
      if (![usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
        throw new ForbiddenException({ codigo: 'SOLO_ADMIN_PAGA_IGUAL', mensaje: 'Solo el administrador puede pagar con jornadas pendientes.' });
      }
      pagarIgual = { motivo: motivoValido(confirma.pagarIgualMotivo, 10), jornadas: d.jornadasPorRevisar ?? [] };
    }
    if (d.pendientes > 0 && !pagarIgual) {
      throw new ConflictException({
        codigo: 'JORNADAS_PENDIENTES',
        mensaje: `Hay ${d.pendientes} jornada(s) incompletas o por revisar. Corrígelas en Asistencia antes de pagar.`,
      });
    }
    const aCobrar: string[] = d.consumos.filter((c: any) => c.cobrar).map((c: any) => c.id);
    // Lo que el admin confirmó queda en el pago congelado y en la auditoría
    const sinDescontar = confirma.sinDescontarAnteriores && d.consumosAnterioresPendiente > 0 ? { monto: d.consumosAnterioresPendiente } : null;
    const detalle = { ...d, consumosCobradosIds: aCobrar, pagadoPor: Number(usuario.partyId), ...(pagarIgual ? { pagarIgual } : {}), ...(sinDescontar ? { sinDescontarAnteriores: sinDescontar } : {}) };
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
          data: { pagado_en: new Date(), pagado_por: usuario.partyId, pago_modo: 'PLANILLA', pago_medio: 'PLANILLA', pago_motivo: motivo, planilla_periodo_id: fila.id },
        });
        if (r.count !== aCobrar.length) {
          throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Alguno de los consumos ya estaba cobrado. Vuelve a abrir la planilla.' });
        }
      }
      await this.auditar('CAMBIO', 'PAGAR_PLANILLA', usuario, ip, 'planilla_periodo', fila.id, { periodo: d.periodo, resultado: d.resultado, consumos: aCobrar, cuotas: (d.cuotas ?? []).map((c: any) => ({ id: c.id, cobrar: c.cobrar })), ...(pagarIgual ? { pagarIgual: { jornadasPendientes: pagarIgual.jornadas } } : {}), ...(sinDescontar ? { sinDescontarAnteriores: sinDescontar.monto } : {}) }, pagarIgual?.motivo, tx);
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
          data: { pagado_en: null, pagado_por: null, pago_modo: null, pago_medio: null, pago_motivo: null, planilla_periodo_id: null },
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
    const quienes = await this.prisma.person.findMany({ where: { party_id: { in: [...new Set(filas.map((f) => f.pagado_por))] } } });
    const nombreDe = new Map(quienes.map((p) => [Number(p.party_id), [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
    return filas.map((f) => ({
      id: Number(f.id),
      desde: isoDe(f.desde),
      hasta: isoDe(f.hasta),
      estado: f.estado,
      neto: Number(f.neto),
      pagadoEn: f.pagado_en.toISOString(),
      pagadoPor: Number(f.pagado_por),
      pagadoPorNombre: nombreDe.get(Number(f.pagado_por)) ?? null,
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
        tarifaEspecial: x.tarifaEspecial ?? null,
      })),
      acumulado: d.resultado.ganado,
      neto: d.estado === 'PAGADO' ? d.resultado.neto : null,
    };
  }

  /**
   * Mi planilla (el trabajador ve SU pago): mismas cifras que `detalle` (pagado = congeladas), armadas explícitamente
   * para no filtrar nada ajeno: sin celular/medio de pago, sin totales generales, sin quién aprobó ni notas internas.
   * `partyId` sale siempre del token. Período futuro = el actual.
   */
  async miPlanilla(partyId: bigint | null | undefined, periodoFecha?: string, ahora = new Date()) {
    const hoy = jornadaDe(ahora).jornada;
    // Sin vínculo con una persona (cuenta sin ficha): estado útil, nunca un error.
    if (partyId == null) return { conSueldo: false, sinVinculo: true, hoy };
    const ref = periodoFecha ? (fechaValida(periodoFecha) > hoy ? hoy : periodoFecha) : hoy;
    const s = await this.prisma.sueldoPersonal.findUnique({ where: { party_id: partyId } });
    if (!s) return { conSueldo: false, sinVinculo: false, hoy };
    const d = await this.detalle(Number(partyId), ref, [], ahora);
    const r = d.resultado;
    const tipo = d.sueldo.modalidad as Modalidad;
    const [prestamos, servicios, cfg, vinculo, tarifasFilas] = await Promise.all([
      this.prisma.prestamoPersonal.findMany({ where: { party_id: partyId, estado: { not: 'ANULADO' } }, include: { cuotas: true }, orderBy: { id: 'desc' } }),
      this.prisma.descuentoRecurrentePersonal.findMany({ where: { party_id: partyId }, orderBy: { id: 'asc' } }),
      this.asistencia.obtenerConfig(),
      this.prisma.vinculoPersonal.findMany({ where: { party_id: partyId, vigente_hasta: null } }),
      this.prisma.tarifaEspecialPersona.findMany({ where: { party_id: partyId, activa: true }, orderBy: { id: 'asc' } }),
    ]);
    const tarifas = tarifasFilas.map(reglaDeFila);
    const tercerizado = vinculo[0]?.tipo === 'CONTRATO_TEMPORAL';
    const ajustes = ((d.ajustes ?? []) as any[]).filter((a) => !a.anulado);
    const descuentos = [
      ...((d.consumos ?? []) as any[]).filter((c) => c.cobrar).map((c) => ({ id: `consumo-${c.id}`, fecha: c.fecha as string, etiqueta: 'CONSUMO', concepto: `Consumo ${c.pedido}`, monto: c.monto as number })),
      ...ajustes
        .filter((a) => a.tipo === 'DESCUENTO')
        .map((a) => ({ id: `ajuste-${a.id}`, fecha: a.fecha as string, etiqueta: (CATEGORIAS_DESCUENTO as readonly string[]).includes(a.categoria) ? (a.categoria as string) : 'OTRO', concepto: a.motivo as string, monto: a.monto as number })),
      ...((d.cuotas ?? []) as any[]).filter((c) => c.cobrar).map((c) => ({ id: `cuota-${c.id}`, fecha: d.periodo.hasta as string, etiqueta: 'PRESTAMO', concepto: `Cuota ${c.numero} de ${c.numCuotas} del préstamo`, monto: c.monto as number })),
      ...((d.recurrentes ?? []) as any[]).filter((x) => x.cobrar && x.signo !== 'BONO').map((x) => ({ id: `servicio-${x.id}`, fecha: d.periodo.hasta as string, etiqueta: x.tipo === 'NETFLIX' ? 'NETFLIX' : 'OTRO', concepto: x.nombre as string, monto: x.monto as number, periodicidad: x.periodicidad as string })),
    ];
    const dias = (d.dias ?? []) as any[];
    // Aditivo: para que la pantalla explique el período en curso y el neto (suma − descuento = neto, cuadra al centavo).
    const seSuma = Math.round((r.ganado + r.adicional) * 100) / 100;
    return {
      conSueldo: true,
      hoy,
      periodo: { desde: d.periodo.desde as string, hasta: d.periodo.hasta as string, tipo },
      enCurso: (d.periodo.desde as string) <= hoy && hoy <= (d.periodo.hasta as string),
      resumen: { seSuma, seDescuenta: Math.round((seSuma - r.neto) * 100) / 100 },
      // Detalle para que el empleado vea de dónde sale cada cifra (solo lo propio).
      reglas: {
        metodo: d.sueldo.metodo as string,
        valorHora: r.valorHora as number,
        toleranciaMin: cfg.toleranciaMin,
        penalidadTardanzaPct: tercerizado ? 0 : cfg.tardanzaPenalidadPct,
        multiplicadorExtra: d.sueldo.metodo === 'PROGRAMADAS' ? 1 : cfg.multiplicadorExtra,
        tercerizado,
        // Solo las activas: lo que la persona ve en «Reglas de descuento y pago»
        tarifasEspeciales: tarifas.filter((t) => t.activa).map((t) => ({ diaSemana: t.diaSemana, desdeHora: aHoraTexto(t.desdeMin), tarifaHora: t.tarifaHora, vigenteDesde: t.vigenteDesde, vigenteHasta: t.vigenteHasta })),
      },
      consumos: ((d.consumos ?? []) as any[]).map((c) => ({ fecha: c.fecha as string, pedido: c.pedido as string, productos: (c.productos ?? []) as string[], monto: c.monto as number, anterior: !!c.anterior, cobrar: !!c.cobrar })),
      bonosManuales: ajustes.filter((a) => a.tipo === 'BONO').map((a) => ({ id: a.id as number, fecha: a.fecha as string, monto: a.monto as number, motivo: (a.motivo ?? null) as string | null })),
      dias: dias.map((x) => ({
        fecha: x.jornada as string,
        estado: x.estado as string,
        trabajadaMin: (x.trabajadaMin ?? 0) as number,
        tardanzaMin: (x.tardanzaMin ?? 0) as number,
        extraMin: (x.extraMin ?? 0) as number,
        extraAprobada: !!x.extraAprobada,
        ganado: (x.ganado ?? 0) as number,
        tarifaEspecial: (x.tarifaEspecial ?? null) as { desdeHora: string; tarifaHora: number; horasEspecialesH: number; ganadoEspecial: number } | null,
        feriado: (x.feriado ?? null) as string | null,
        vacacion: !!x.vacacion,
        penalidadTardanza: ((r.penalidadTardanzaDetalle ?? []) as Array<{ fecha: string; monto: number }>).find((p) => p.fecha === x.jornada)?.monto ?? 0,
      })),
      base: {
        sueldo: tipo === 'SEMANAL' ? d.sueldo.semanal : d.sueldo.mensual,
        tarifaHora: d.sueldo.metodo === 'TARIFA_HORA' ? d.sueldo.tarifaHora : null,
        valorHora: r.valorHora,
      },
      horas: {
        trabajadasMin: r.trabajadaMin,
        extraAprobadaMin: r.extraAprobadaMin,
        extraPendienteMin: r.extraMin - r.extraAprobadaMin,
        // ponytail: hoy solo existe «aprobada»; quitar la aprobación deja la extra pendiente. Sin tabla de rechazos → 0.
        extraRechazadaMin: 0,
      },
      ganado: { bruto: r.ganado, extras: r.pagoExtra, bonos: r.adicional },
      descuentos,
      adelantos: ajustes.filter((a) => a.tipo === 'ADELANTO').map((a) => ({ id: a.id as number, fecha: a.fecha as string, monto: a.monto as number, motivo: a.motivo as string })),
      penalidadTardanza: { total: r.penalidadTardanza ?? 0, detalle: (r.penalidadTardanzaDetalle ?? []) as Array<{ fecha: string; minutos: number; monto: number }> },
      prestamos: prestamos.map((p) => {
        const capital = Number(p.monto);
        const interes = Number(p.interes_monto);
        return {
          id: Number(p.id),
          capital,
          interesPctMensual: Number(p.interes_pct_mensual),
          interes,
          cuota: Number(p.monto_cuota),
          saldo: saldoPrestamo(capital + interes, p.cuotas.map((c) => ({ monto: Number(c.monto), estado: c.estado }))),
          cuotasPagadas: p.cuotas.filter((c) => c.estado === 'DESCONTADA').length,
          cuotasTotales: p.num_cuotas,
          estado: p.estado,
        };
      }),
      serviciosExtra: servicios.map((x) => ({ nombre: x.nombre, monto: Number(x.monto), periodicidad: x.periodicidad, activo: x.activo })),
      feriadosPagados: dias.filter((x) => x.feriado && x.trabajadaMin > 0).map((x) => ({ fecha: x.jornada as string, nombre: x.feriado as string, recargo: (x.recargo ?? 1) as number, trabajadaH: x.trabajadaH as number, ganado: (x.ganado ?? 0) as number })),
      vacaciones: d.vacaciones && (d.vacaciones.diasTomados > 0 || d.vacaciones.pagadas.length > 0) ? { diasTomados: d.vacaciones.diasTomados as number, pagadas: d.vacaciones.pagadas.map((v: any) => ({ fecha: v.fecha, dias: v.dias, monto: v.monto })) } : null,
      neto: r.neto,
      estadoPago: d.estado === 'PAGADO' ? 'PAGADO' : 'PENDIENTE',
      pagadoEn: d.estado === 'PAGADO' ? (d.pagadoEn as string) : null,
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
