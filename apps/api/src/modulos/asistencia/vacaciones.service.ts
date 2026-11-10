import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { jornadaDe } from './asistencia.calculo';
import { AsistenciaService } from './asistencia.service';
import { redondear2 } from './planilla.calculo';
import { RegimenVacaciones, contarDiasHabiles, diasGanados, rangosSeCruzan, resumenSaldo } from './vacaciones.calculo';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTRATO_BYTES = 5 * 1024 * 1024;
const MAX_DIAS_RANGO = 120;

function fechaValida(f: unknown): string {
  const t = String(f ?? '');
  if (!FECHA.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha debe ser AAAA-MM-DD' });
  }
  return t;
}

function motivoValido(m: unknown, min = 3): string {
  const t = String(m ?? '').trim();
  if (t.length < min) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo' });
  return t;
}

/** Vínculo del personal (planilla o contrato temporal) y sus vacaciones. Solo ADMIN, salvo la lectura propia. Nunca mueve caja. */
@Injectable()
export class VacacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    private readonly archivos: ArchivosService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Vínculo
  // ---------------------------------------------------------------------------

  private filaVinculo(v: any) {
    return {
      id: Number(v.id),
      tipo: v.tipo as 'PLANILLA' | 'CONTRATO_TEMPORAL',
      fechaIngreso: isoDe(v.fecha_ingreso),
      fechaFin: v.fecha_fin ? isoDe(v.fecha_fin) : null,
      regimenVacaciones: (v.regimen_vacaciones ?? null) as RegimenVacaciones | null,
      tieneContrato: Boolean(v.contrato_archivo_id),
      notas: v.notas ?? null,
      vigenteDesde: v.vigente_desde.toISOString(),
      vigenteHasta: v.vigente_hasta ? v.vigente_hasta.toISOString() : null,
    };
  }

  private async vigente(partyId: bigint) {
    return this.prisma.vinculoPersonal.findFirst({ where: { party_id: partyId, vigente_hasta: null } });
  }

  /** Vínculo vigente, historial y (si es planilla) el resumen de vacaciones con sus movimientos. */
  async obtener(partyId: number, ahora = new Date()) {
    const id = BigInt(partyId);
    const filas = await this.prisma.vinculoPersonal.findMany({ where: { party_id: id }, orderBy: { vigente_desde: 'desc' } });
    const vigente = filas.find((f) => !f.vigente_hasta) ?? null;
    const vacaciones = vigente?.tipo === 'PLANILLA' ? await this.resumen(id, vigente, ahora, true) : null;
    return { vigente: vigente ? this.filaVinculo(vigente) : null, historial: filas.filter((f) => f.vigente_hasta).map((f) => this.filaVinculo(f)), vacaciones };
  }

  async guardarVinculo(
    partyId: number,
    dto: { tipo: 'PLANILLA' | 'CONTRATO_TEMPORAL'; fechaIngreso: string; fechaFin?: string | null; regimenVacaciones?: number; notas?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const id = BigInt(partyId);
    const persona = await this.prisma.userAccount.findUnique({ where: { party_id: id } });
    if (!persona) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    if (persona.rol === 'ADMIN') throw new BadRequestException({ codigo: 'ADMIN_SIN_PLANILLA', mensaje: 'El administrador no lleva planilla' });
    const ingreso = fechaValida(dto.fechaIngreso);
    const esPlanilla = dto.tipo === 'PLANILLA';
    const fin = !esPlanilla && dto.fechaFin ? fechaValida(dto.fechaFin) : null;
    if (fin && fin < ingreso) throw new BadRequestException({ codigo: 'FECHAS_INVALIDAS', mensaje: 'La fecha de fin no puede ser anterior al ingreso' });
    const regimen = esPlanilla ? (dto.regimenVacaciones ?? 30) : null;
    if (regimen !== null && regimen !== 30 && regimen !== 15) {
      throw new BadRequestException({ codigo: 'REGIMEN_INVALIDO', mensaje: 'El régimen de vacaciones es de 30 o 15 días al año' });
    }
    const notas = dto.notas?.trim() || null;
    const actual = await this.vigente(id);
    const datos = { fecha_ingreso: fechaDb(ingreso), fecha_fin: fin ? fechaDb(fin) : null, regimen_vacaciones: regimen, notas };
    let fila;
    if (actual && actual.tipo === dto.tipo) {
      // Mismo tipo: se corrigen los datos de la fila vigente
      fila = await this.prisma.vinculoPersonal.update({ where: { id: actual.id }, data: datos });
    } else {
      // Cambio de tipo: se cierra la vigente (historial) y se abre otra
      fila = await this.prisma.$transaction(async (tx) => {
        if (actual) await tx.vinculoPersonal.update({ where: { id: actual.id }, data: { vigente_hasta: new Date() } });
        return tx.vinculoPersonal.create({ data: { party_id: id, tipo: dto.tipo, ...datos, creado_por: usuario.partyId } });
      });
    }
    await this.auditar('CAMBIO', actual && actual.tipo === dto.tipo ? 'EDITAR_VINCULO' : 'CAMBIAR_VINCULO', usuario, ip, 'vinculo_personal', fila.id, {
      antes: actual ? this.filaVinculo(actual) : null,
      despues: this.filaVinculo(fila),
    });
    return this.filaVinculo(fila);
  }

  /** Adjunta el contrato firmado (PDF, máx. 5 MB) al vínculo vigente. Se guarda como archivo privado. */
  async subirContrato(partyId: number, file: Express.Multer.File | undefined, usuario: UsuarioAutenticado, ip?: string) {
    const id = BigInt(partyId);
    const actual = await this.vigente(id);
    if (!actual) throw new ConflictException({ codigo: 'SIN_VINCULO', mensaje: 'Primero guarda el vínculo de la persona' });
    if (!file?.buffer?.length) throw new BadRequestException({ codigo: 'ARCHIVO_REQUERIDO', mensaje: 'Adjunta el contrato en PDF' });
    if ((file.size || file.buffer.length) > MAX_CONTRATO_BYTES) {
      throw new HttpException({ codigo: 'ARCHIVO_GRANDE', mensaje: 'El contrato excede el tamaño máximo de 5 MB' }, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    // Tipo declarado y firma real del archivo (%PDF)
    if (file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new HttpException({ codigo: 'TIPO_NO_PERMITIDO', mensaje: 'El contrato debe ser un archivo PDF' }, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const subido = await this.archivos.subirArchivo(file, true, usuario, ip);
    await this.prisma.vinculoPersonal.update({ where: { id: actual.id }, data: { contrato_archivo_id: BigInt(subido.id) } });
    await this.auditar('CAMBIO', 'SUBIR_CONTRATO', usuario, ip, 'vinculo_personal', actual.id, { partyId, archivoId: subido.id });
    return { ok: true };
  }

  /** Archivo del contrato (vigente o de un vínculo del historial). La lectura queda auditada como lectura sensible. */
  async contrato(partyId: number, usuario: UsuarioAutenticado, ip?: string, dispositivo?: string, vinculoId?: number) {
    const v = vinculoId
      ? await this.prisma.vinculoPersonal.findFirst({ where: { id: BigInt(vinculoId), party_id: BigInt(partyId) } })
      : await this.vigente(BigInt(partyId));
    if (!v?.contrato_archivo_id) throw new NotFoundException({ codigo: 'SIN_CONTRATO', mensaje: 'Esta persona no tiene contrato adjunto' });
    return this.archivos.obtenerArchivoPrivado(v.contrato_archivo_id, usuario, ip, dispositivo);
  }

  // ---------------------------------------------------------------------------
  // Saldo y movimientos
  // ---------------------------------------------------------------------------

  private async resumen(id: bigint, vinculo: any, ahora: Date, conDinero: boolean) {
    const hoy = jornadaDe(ahora).jornada;
    const ingreso = isoDe(vinculo.fecha_ingreso);
    const hasta = vinculo.fecha_fin && isoDe(vinculo.fecha_fin) < hoy ? isoDe(vinculo.fecha_fin) : hoy;
    const regimen = (vinculo.regimen_vacaciones ?? 30) as RegimenVacaciones;
    const filas = await this.prisma.vacacionMovimiento.findMany({ where: { party_id: id, vinculo_id: vinculo.id }, orderBy: [{ fecha_desde: 'desc' }, { id: 'desc' }] });
    const movs = filas.map((m) => ({ tipo: m.tipo as 'TOMADAS' | 'PAGADAS' | 'AJUSTE', dias: Number(m.dias), anulado: Boolean(m.anulado_en) }));
    const r = resumenSaldo(diasGanados(ingreso, hasta, regimen), movs);
    return {
      regimen,
      ingreso,
      ...r,
      movimientos: filas.map((m) => ({
        id: Number(m.id),
        tipo: m.tipo,
        desde: isoDe(m.fecha_desde),
        hasta: isoDe(m.fecha_hasta),
        dias: Number(m.dias),
        ...(conDinero ? { monto: m.monto === null ? null : Number(m.monto), motivo: m.motivo, creadoEn: m.creado_en.toISOString(), anuladoMotivo: m.anulado_motivo } : {}),
        anulado: Boolean(m.anulado_en),
      })),
    };
  }

  /** Lo que ve la persona de sí misma: saldo y movimientos, sin dinero ni motivos. */
  async miVacaciones(partyId: bigint, ahora = new Date()) {
    const v = await this.vigente(partyId);
    if (!v || v.tipo !== 'PLANILLA') return { aplica: false as const };
    return { aplica: true as const, ...(await this.resumen(partyId, v, ahora, false)) };
  }

  /** Un período PAGADO queda congelado: no se toca ningún día de su rango. */
  private async exigirPeriodosAbiertos(partyId: bigint, desde: string, hasta: string) {
    const pagado = await this.prisma.planillaPeriodo.findFirst({
      where: { party_id: partyId, estado: 'PAGADO', desde: { lte: fechaDb(hasta) }, hasta: { gte: fechaDb(desde) } },
    });
    if (pagado) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para cambiarlo.' });
  }

  async registrar(
    dto: { partyId: number; tipo: 'TOMADAS' | 'PAGADAS' | 'AJUSTE'; desde: string; hasta?: string; dias?: number; monto?: number; motivo?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
  ) {
    const id = BigInt(dto.partyId);
    const v = await this.vigente(id);
    if (!v || v.tipo !== 'PLANILLA') {
      throw new ConflictException({ codigo: 'VINCULO_NO_PLANILLA', mensaje: 'Las vacaciones son solo para personal en planilla. Revisa el vínculo de la persona.' });
    }
    const desde = fechaValida(dto.desde);
    if (desde < isoDe(v.fecha_ingreso)) {
      throw new BadRequestException({ codigo: 'ANTES_DEL_INGRESO', mensaje: 'La fecha es anterior al ingreso de la persona' });
    }
    const { saldo } = (await this.resumen(id, v, ahora, false)) as { saldo: number };
    let hasta = desde;
    let dias = 0;
    let monto: number | null = null;
    let motivo: string | null = dto.motivo?.trim() || null;

    if (dto.tipo === 'TOMADAS') {
      hasta = fechaValida(dto.hasta ?? dto.desde);
      if (hasta < desde) throw new BadRequestException({ codigo: 'FECHAS_INVALIDAS', mensaje: 'La fecha final no puede ser anterior a la inicial' });
      const { dias: dd } = await this.asistencia.diasDePersona(id, desde, hasta, ahora);
      if (dd.length > MAX_DIAS_RANGO) throw new BadRequestException({ codigo: 'RANGO_LARGO', mensaje: `El rango no puede pasar de ${MAX_DIAS_RANGO} días` });
      dias = contarDiasHabiles(dd);
      if (dias === 0) throw new BadRequestException({ codigo: 'SIN_DIAS_HABILES', mensaje: 'En ese rango la persona no tiene jornadas programadas' });
      await this.exigirPeriodosAbiertos(id, desde, hasta);
      const otras = await this.prisma.vacacionMovimiento.findMany({ where: { party_id: id, tipo: 'TOMADAS', anulado_en: null, fecha_desde: { lte: fechaDb(hasta) }, fecha_hasta: { gte: fechaDb(desde) } } });
      if (otras.some((o) => rangosSeCruzan({ desde, hasta }, { desde: isoDe(o.fecha_desde), hasta: isoDe(o.fecha_hasta) }))) {
        throw new ConflictException({ codigo: 'VACACION_CRUZADA', mensaje: 'Esas fechas se cruzan con otras vacaciones ya registradas' });
      }
    } else if (dto.tipo === 'PAGADAS') {
      dias = redondear2(Number(dto.dias));
      monto = redondear2(Number(dto.monto));
      if (!(dias > 0)) throw new BadRequestException({ codigo: 'DIAS_INVALIDOS', mensaje: 'Los días deben ser mayores que cero' });
      if (!(monto > 0)) throw new BadRequestException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto debe ser mayor que cero' });
      // Entra al período de planilla que contiene la fecha: la persona debe tener sueldo y el período estar abierto
      if (!(await this.prisma.sueldoPersonal.findUnique({ where: { party_id: id } }))) {
        throw new NotFoundException({ codigo: 'SIN_SUELDO', mensaje: 'Esa persona todavía no tiene sueldo configurado' });
      }
      await this.exigirPeriodosAbiertos(id, desde, desde);
    } else {
      dias = redondear2(Number(dto.dias));
      if (!dias) throw new BadRequestException({ codigo: 'DIAS_INVALIDOS', mensaje: 'Escribe los días del ajuste (positivos suman, negativos restan)' });
      motivo = motivoValido(dto.motivo);
    }
    if (dto.tipo !== 'AJUSTE' && dias > saldo + 1e-9) {
      throw new ConflictException({ codigo: 'SALDO_INSUFICIENTE', mensaje: `Solo hay ${saldo} día(s) de saldo. Si corresponde, registra un ajuste con motivo.` });
    }
    const fila = await this.prisma.vacacionMovimiento.create({
      data: { party_id: id, vinculo_id: v.id, tipo: dto.tipo, fecha_desde: fechaDb(desde), fecha_hasta: fechaDb(hasta), dias, monto, motivo, creado_por: usuario.partyId },
    });
    await this.auditar('CAMBIO', `VACACIONES_${dto.tipo}`, usuario, ip, 'vacacion_movimiento', fila.id, { partyId: dto.partyId, desde, hasta, dias, monto }, motivo ?? undefined);
    return { ok: true, id: Number(fila.id), dias };
  }

  async anular(movId: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string) {
    const motivo = motivoValido(motivoTxt);
    const m = await this.prisma.vacacionMovimiento.findUnique({ where: { id: BigInt(movId) } });
    if (!m) throw new NotFoundException({ codigo: 'MOVIMIENTO_NO_ENCONTRADO', mensaje: 'Movimiento no encontrado' });
    if (m.anulado_en) throw new ConflictException({ codigo: 'YA_ANULADO', mensaje: 'Ese movimiento ya está anulado' });
    if (m.tipo !== 'AJUSTE') await this.exigirPeriodosAbiertos(m.party_id, isoDe(m.fecha_desde), isoDe(m.fecha_hasta));
    await this.prisma.vacacionMovimiento.update({ where: { id: m.id }, data: { anulado_en: new Date(), anulado_por: usuario.partyId, anulado_motivo: motivo } });
    await this.auditar('CAMBIO', 'ANULAR_VACACIONES', usuario, ip, 'vacacion_movimiento', m.id, { tipo: m.tipo, dias: Number(m.dias), monto: m.monto === null ? null : Number(m.monto) }, motivo);
    return { ok: true };
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
  ) {
    await this.auditoria?.registrar(
      { categoria: categoria as any, modulo: 'planilla', accion, resultado: 'OK', entidad, entidadId: Number(entidadId), despues, partyId: usuario.partyId, ip, motivo } as any,
    );
  }
}
