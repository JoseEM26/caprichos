import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { jornadaDe } from './asistencia.calculo';
import { AsistenciaService } from './asistencia.service';
import { redondear2 } from './planilla.calculo';
import { planCuotas, saldoPrestamo } from './prestamos.calculo';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Préstamos al personal (cuotas fijas por período, con saldo) y descuentos recurrentes (Netflix y otros).
 * Solo definen QUÉ se descuenta; el descuento entra a la planilla desde PlanillaService (nada mueve caja).
 */
@Injectable()
export class PrestamosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  private async exigirPersona(partyId: number) {
    const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: BigInt(partyId) } });
    if (!cuenta) throw new NotFoundException({ codigo: 'PERSONA_NO_ENCONTRADA', mensaje: 'Persona no encontrada' });
    if (cuenta.rol === 'ADMIN') throw new BadRequestException({ codigo: 'ADMIN_SIN_PLANILLA', mensaje: 'El administrador no lleva planilla' });
  }

  /** Préstamos (con plan y saldo) y descuentos recurrentes de una persona. */
  async listar(partyId: number) {
    const id = BigInt(partyId);
    const [prestamos, recurrentes, cfg] = await Promise.all([
      this.prisma.prestamoPersonal.findMany({ where: { party_id: id }, include: { cuotas: true }, orderBy: { id: 'desc' } }),
      this.prisma.descuentoRecurrentePersonal.findMany({ where: { party_id: id }, orderBy: { id: 'asc' } }),
      this.asistencia.obtenerConfig(),
    ]);
    return {
      netflixSemanalDefecto: cfg.netflixSemanal,
      prestamos: prestamos.map((p) => {
        const cuotas = [...p.cuotas].sort((a, b) => a.numero - b.numero).map((c) => ({
          id: Number(c.id),
          numero: c.numero,
          monto: Number(c.monto),
          estado: c.estado,
          periodoDesde: c.periodo_desde ? isoDe(c.periodo_desde) : null,
          periodoHasta: c.periodo_hasta ? isoDe(c.periodo_hasta) : null,
          reprogramada: c.reprogramada_de !== null,
        }));
        return {
          id: Number(p.id),
          monto: Number(p.monto),
          numCuotas: p.num_cuotas,
          periodicidad: p.periodicidad,
          montoCuota: Number(p.monto_cuota),
          fechaInicio: isoDe(p.fecha_inicio),
          estado: p.estado,
          motivo: p.motivo,
          anuladoMotivo: p.anulado_motivo,
          saldo: p.estado === 'ANULADO' ? 0 : saldoPrestamo(Number(p.monto), cuotas),
          cuotas,
        };
      }),
      recurrentes: recurrentes.map((r) => ({ id: Number(r.id), tipo: r.tipo, nombre: r.nombre, monto: Number(r.monto), activo: r.activo, desde: isoDe(r.desde) })),
    };
  }

  async crear(
    dto: { partyId: number; monto: number; numCuotas: number; periodicidad: 'SEMANAL' | 'MENSUAL'; fechaInicio?: string; motivo?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
  ) {
    await this.exigirPersona(dto.partyId);
    const monto = redondear2(Number(dto.monto));
    if (!(monto > 0)) throw new BadRequestException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto debe ser mayor que cero' });
    const plan = planCuotas(monto, dto.numCuotas);
    if (plan.some((c) => c <= 0)) throw new BadRequestException({ codigo: 'CUOTAS_INVALIDAS', mensaje: 'Demasiadas cuotas para ese monto' });
    const inicio = dto.fechaInicio ?? jornadaDe(ahora).jornada;
    const id = await this.prisma.$transaction(async (tx) => {
      const p = await tx.prestamoPersonal.create({
        data: {
          party_id: BigInt(dto.partyId),
          monto,
          num_cuotas: plan.length,
          periodicidad: dto.periodicidad,
          monto_cuota: plan[0],
          fecha_inicio: fechaDb(inicio),
          motivo: dto.motivo?.trim() || null,
          creado_por: usuario.partyId,
        },
      });
      await tx.prestamoCuota.createMany({ data: plan.map((m, i) => ({ prestamo_id: p.id, numero: i + 1, monto: m })) });
      await this.auditar('CREAR_PRESTAMO', usuario, ip, 'prestamo_personal', p.id, { partyId: dto.partyId, monto, cuotas: plan.length, periodicidad: dto.periodicidad }, dto.motivo, tx);
      return p.id;
    });
    return { ok: true, id: Number(id), cuotas: plan };
  }

  /** Anula el préstamo (con motivo): deja de descontar. Los períodos ya pagados no cambian. */
  async anular(prestamoId: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string) {
    const motivo = String(motivoTxt ?? '').trim();
    if (motivo.length < 3) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo' });
    const p = await this.prisma.prestamoPersonal.findUnique({ where: { id: BigInt(prestamoId) } });
    if (!p) throw new NotFoundException({ codigo: 'PRESTAMO_NO_ENCONTRADO', mensaje: 'Préstamo no encontrado' });
    if (p.estado === 'ANULADO') throw new ConflictException({ codigo: 'YA_ANULADO', mensaje: 'Ese préstamo ya está anulado' });
    await this.prisma.prestamoPersonal.update({ where: { id: p.id }, data: { estado: 'ANULADO', anulado_motivo: motivo } });
    await this.auditar('ANULAR_PRESTAMO', usuario, ip, 'prestamo_personal', p.id, { partyId: Number(p.party_id), monto: Number(p.monto) }, motivo);
    return { ok: true };
  }

  async crearRecurrente(
    dto: { partyId: number; tipo: 'NETFLIX' | 'OTRO'; nombre?: string; monto?: number; desde?: string },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
  ) {
    await this.exigirPersona(dto.partyId);
    const nombre = dto.tipo === 'NETFLIX' ? 'Netflix' : String(dto.nombre ?? '').trim();
    if (nombre.length < 2) throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe el nombre del descuento' });
    const monto = redondear2(dto.monto ?? (dto.tipo === 'NETFLIX' ? (await this.asistencia.obtenerConfig()).netflixSemanal : 0));
    if (!(monto > 0)) throw new BadRequestException({ codigo: 'MONTO_INVALIDO', mensaje: 'El monto debe ser mayor que cero' });
    const r = await this.prisma.descuentoRecurrentePersonal.create({
      data: { party_id: BigInt(dto.partyId), tipo: dto.tipo, nombre, monto, desde: fechaDb(dto.desde ?? jornadaDe(ahora).jornada), creado_por: usuario.partyId },
    });
    await this.auditar('CREAR_RECURRENTE', usuario, ip, 'descuento_recurrente_personal', r.id, { partyId: dto.partyId, tipo: dto.tipo, monto });
    return { ok: true, id: Number(r.id) };
  }

  /** Cambia el monto semanal o la casilla «cobrar» (activo). */
  async editarRecurrente(id: number, dto: { monto?: number; activo?: boolean }, usuario: UsuarioAutenticado, ip?: string) {
    const r = await this.prisma.descuentoRecurrentePersonal.findUnique({ where: { id: BigInt(id) } });
    if (!r) throw new NotFoundException({ codigo: 'RECURRENTE_NO_ENCONTRADO', mensaje: 'Descuento no encontrado' });
    const data: Record<string, unknown> = {};
    if (dto.monto !== undefined) data.monto = redondear2(dto.monto);
    if (dto.activo !== undefined) data.activo = dto.activo;
    await this.prisma.descuentoRecurrentePersonal.update({ where: { id: r.id }, data });
    await this.auditar('EDITAR_RECURRENTE', usuario, ip, 'descuento_recurrente_personal', r.id, { partyId: Number(r.party_id), ...data });
    return { ok: true };
  }

  private async auditar(accion: string, usuario: UsuarioAutenticado, ip: string | undefined, entidad: string, entidadId: bigint, despues: Record<string, unknown>, motivo?: string, db?: any) {
    await this.auditoria?.registrar(
      { categoria: 'CAMBIO', modulo: 'planilla', accion, resultado: 'OK', entidad, entidadId: Number(entidadId), despues, partyId: usuario.partyId, ip, motivo } as any,
      db,
    );
  }
}
