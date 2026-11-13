import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES } from '../acceso/permisos';
import { vigenciaRolExtra } from '../acceso/roles-usuario';
import { HORA_CIERRE_MIN, CoberturaFila, HorarioFila, ReemplazoFila, jornadaDe, minutosDeHora, resolverTurno, sumarDias } from './asistencia.calculo';
import { AsistenciaService } from './asistencia.service';
import { TURNOS_DIAS_ADELANTO_MAX, TURNOS_MAX_PEDIDOS_DIA } from './asistencia.config';
import { etiquetaDia, momentoDeHora } from './asistencia-correcciones.service';
import { CrearTurnoDto } from './dto/turnos.dto';

export const ESTADOS_TURNO = ['PENDIENTE_ACEPTA', 'PENDIENTE_APRUEBA', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'VENCIDA', 'SIN_MARCA'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];
const ACTIVAS: EstadoTurno[] = ['PENDIENTE_ACEPTA', 'PENDIENTE_APRUEBA'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const horaDb = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const hhmmDe = (d: Date) => d.toISOString().slice(11, 16);
const nombreRol = (codigo: string) => ROLES.find((r) => r.codigo === codigo)?.nombre ?? codigo;

/** Minutos de una hora «HH:MM» de la jornada: de 00:00 a 03:59 es la madrugada siguiente. */
const norm = (hhmm: string) => {
  const m = minutosDeHora(hhmm);
  return m < HORA_CIERRE_MIN ? m + 1440 : m;
};
export interface Ventana { d: number; h: number }
export const ventana = (desde: string, hasta: string): Ventana => {
  const d = norm(desde);
  let h = norm(hasta);
  if (h <= d) h += 1440;
  return { d, h };
};
const solapa = (a: Ventana, b: Ventana) => a.d < b.h && b.d < a.h;

export interface Pierna { fecha: string; desde: string; hasta: string }
interface Cuenta { partyId: bigint; nombre: string; roles: string[]; areas: Array<{ id: bigint; nombre: string }> }

interface DatosRango {
  ctx: { horarios: HorarioFila[]; coberturas: CoberturaFila[]; reemplazos: ReemplazoFila[] };
  vacaciones: Array<{ partyId: bigint; desde: string; hasta: string }>;
  ceses: Map<bigint, string>;
  activas: any[];
}

const piernas = (s: any): Array<{ trabaja: bigint; fecha: string; w: Ventana }> => {
  const lista = [{ trabaja: s.reemplazo_party_id as bigint, fecha: isoDe(s.fecha), w: ventana(hhmmDe(s.desde), hhmmDe(s.hasta)) }];
  if (s.tipo === 'CAMBIO_TURNO' && s.fecha_devolucion) {
    lista.push({ trabaja: s.solicitante_party_id as bigint, fecha: isoDe(s.fecha_devolucion), w: ventana(hhmmDe(s.desde_devolucion), hhmmDe(s.hasta_devolucion)) });
  }
  return lista;
};

/**
 * Reemplazos y cambios de turno que pide el propio personal. El elegido acepta, Supervisión/Admin aprueba y solo entonces
 * se crean las filas de CoberturaTurno (que ya usan el calendario, la asistencia y la planilla). La elegibilidad se valida
 * en el servidor al crear, al aceptar y al aprobar (esta última dentro de una transacción serializable).
 */
@Injectable()
export class AsistenciaTurnosService {
  private readonly logger = new Logger(AsistenciaTurnosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  // ---------------------------------------------------------------------------
  // Datos y reglas de elegibilidad
  // ---------------------------------------------------------------------------

  private async cuentas(db: any, ids?: bigint[]): Promise<Map<bigint, Cuenta>> {
    const filas: any[] = await db.userAccount.findMany({
      where: { activo: true, ...(ids ? { party_id: { in: ids } } : {}) },
      include: {
        rolesExtra: { where: { OR: vigenciaRolExtra() }, select: { rol: true } },
        areasCocina: { include: { area: { select: { nombre: true } } } },
      },
    });
    const personas: any[] = await db.person.findMany({ where: { party_id: { in: filas.map((f) => f.party_id) } } });
    const nombres = new Map(personas.map((p) => [p.party_id, [p.nombres, p.apellidos].filter(Boolean).join(' ')]));
    const mapa = new Map<bigint, Cuenta>();
    for (const f of filas) {
      mapa.set(f.party_id, {
        partyId: f.party_id,
        nombre: nombres.get(f.party_id) || `Persona ${f.party_id}`,
        roles: [f.rol, ...f.rolesExtra.map((r: any) => r.rol).filter((r: string) => r !== f.rol)],
        areas: f.areasCocina.map((a: any) => ({ id: a.area_id, nombre: a.area.nombre })),
      });
    }
    return mapa;
  }

  /**
   * ¿Puede `b` cubrir a `a`? Cocina: si `a` tiene áreas, `b` debe ser de cocina y compartir al menos una (cocina sin áreas
   * = todas las áreas). Resto: debe compartir al menos un rol. Una cuenta solo ADMIN nunca trabaja turnos.
   */
  emparejar(a: Cuenta, b: Cuenta): { ok: true; motivos: string[] } | { ok: false; razon: string } {
    if (b.roles.every((r) => r === 'ADMIN')) return { ok: false, razon: 'Esa cuenta no trabaja turnos' };
    if (a.roles.includes('COCINA') && a.areas.length > 0) {
      if (!b.roles.includes('COCINA')) return { ok: false, razon: 'No es de tu área de cocina' };
      if (b.areas.length === 0) return { ok: true, motivos: ['Cocina: todas las áreas'] };
      const comunes = a.areas.filter((x) => b.areas.some((y) => y.id === x.id)).map((x) => x.nombre);
      if (comunes.length === 0) return { ok: false, razon: 'No comparte tu área de cocina' };
      return { ok: true, motivos: comunes.map((n) => `Misma área: ${n}`) };
    }
    const comunes = a.roles.filter((r) => r !== 'ADMIN' && b.roles.includes(r));
    if (comunes.length === 0) return { ok: false, razon: 'No comparte tu rol' };
    return { ok: true, motivos: comunes.map((r) => `Mismo rol: ${nombreRol(r)}`) };
  }

  private async datosRango(db: any, desde: string, hasta: string): Promise<DatosRango> {
    const rango = { gte: fechaDb(desde), lte: fechaDb(hasta) };
    const [horarios, coberturas, reemplazos, vacaciones, vinculos, activas] = await Promise.all([
      db.horarioTrabajo.findMany({ where: { activo: true } }),
      db.coberturaTurno.findMany({ where: { fecha: rango } }),
      db.reemplazoDia.findMany({ where: { activo: true } }),
      db.vacacionMovimiento.findMany({
        where: { tipo: 'TOMADAS', anulado_en: null, fecha_desde: { lte: rango.lte }, fecha_hasta: { gte: rango.gte } },
        select: { party_id: true, fecha_desde: true, fecha_hasta: true },
      }),
      db.vinculoPersonal.findMany({ where: { vigente_hasta: null, fecha_fin: { not: null } }, select: { party_id: true, fecha_fin: true } }),
      db.solicitudTurno.findMany({
        where: { estado: { in: ACTIVAS }, OR: [{ fecha: rango }, { fecha_devolucion: rango }] },
      }),
    ]);
    return {
      ctx: {
        horarios: horarios.map((h: any) => ({
          partyId: h.party_id, dia: h.dia_semana, entrada: minutosDeHora(h.entrada), salida: minutosDeHora(h.salida),
          almuerzoIni: h.almuerzo_inicio ? minutosDeHora(h.almuerzo_inicio) : null,
          almuerzoFin: h.almuerzo_fin ? minutosDeHora(h.almuerzo_fin) : null,
        })),
        coberturas: coberturas.map((c: any) => ({
          fecha: isoDe(c.fecha), cubreId: c.cubre_party_id, reemplazaId: c.reemplaza_party_id, desde: minutosDeHora(c.desde), hasta: minutosDeHora(c.hasta),
        })),
        reemplazos: reemplazos.map((r: any) => ({ partyId: r.party_id, dia: r.dia_semana, reemplazaId: r.reemplaza_party_id })),
      },
      vacaciones: vacaciones.map((v: any) => ({ partyId: v.party_id, desde: isoDe(v.fecha_desde), hasta: isoDe(v.fecha_hasta) })),
      ceses: new Map(vinculos.map((v: any) => [v.party_id, isoDe(v.fecha_fin)])),
      activas,
    };
  }

  /** Motivo por el que `partyId` NO está libre toda la ventana de ese día; null si está libre. */
  private libre(d: DatosRango, partyId: bigint, fecha: string, w: Ventana, excluirId?: bigint): string | null {
    if (d.vacaciones.some((v) => v.partyId === partyId && v.desde <= fecha && v.hasta >= fecha)) return 'Está de vacaciones o licencia ese día';
    const fin = d.ceses.get(partyId);
    if (fin && fin < fecha) return 'Ya no tiene vínculo vigente';
    // Con una cobertura el turno propio del día se reemplaza: por eso no debe tener ningún turno ese día
    if (resolverTurno(partyId, fecha, d.ctx).turno) return 'Ya tiene turno ese día';
    const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    if (d.ctx.reemplazos.some((r) => r.reemplazaId === partyId && r.dia === dia)) return 'Es suplente fijo ese día';
    const choca = d.activas.some(
      (s) => s.id !== excluirId && piernas(s).some((p) => p.trabaja === partyId && p.fecha === fecha && solapa(p.w, w)),
    );
    return choca ? 'Ya tiene otro pedido de turno en ese horario' : null;
  }

  /** Turno real de `partyId` ese día y si la ventana cae dentro (parcial permitido: debe tocar el inicio o el final). */
  private turnoSirve(d: DatosRango, partyId: bigint, fecha: string, w: Ventana, de: string): string | null {
    const { turno } = resolverTurno(partyId, fecha, d.ctx);
    if (!turno) return `${de} no tiene turno el ${etiquetaDia(fecha)}`;
    if (w.d < turno.entrada || w.h > turno.salida) return 'Las horas deben estar dentro del turno de ese día';
    if (w.d !== turno.entrada && w.h !== turno.salida) return 'Pide cubrir desde el inicio o hasta el final del turno';
    return null;
  }

  /** Valida el pedido completo con los datos de `db` (prisma o una transacción). No lanza: devuelve el problema. */
  private async validar(
    db: any,
    p: { tipo: string; solicitante: bigint; reemplazo: bigint; a: Pierna; b?: Pierna | null; excluirId?: bigint },
  ): Promise<{ error: string | null; motivos: string[] }> {
    const cuentas = await this.cuentas(db, [p.solicitante, p.reemplazo]);
    const ca = cuentas.get(p.solicitante);
    const cb = cuentas.get(p.reemplazo);
    if (!ca) return { error: 'Tu cuenta no está activa', motivos: [] };
    if (!cb || p.reemplazo === p.solicitante) return { error: 'La persona elegida no está disponible', motivos: [] };
    const emp = this.emparejar(ca, cb);
    if (!emp.ok) return { error: emp.razon, motivos: [] };
    const fechas = [p.a.fecha, ...(p.b ? [p.b.fecha] : [])].sort();
    const datos = await this.datosRango(db, fechas[0], fechas[fechas.length - 1]);
    const wa = ventana(p.a.desde, p.a.hasta);
    const error =
      this.turnoSirve(datos, p.solicitante, p.a.fecha, wa, 'Tú no tienes') ??
      this.libre(datos, p.reemplazo, p.a.fecha, wa, p.excluirId) ??
      (p.b
        ? (() => {
            const wb = ventana(p.b.desde, p.b.hasta);
            return this.turnoSirve(datos, p.reemplazo, p.b.fecha, wb, 'La otra persona no tiene') ?? this.libre(datos, p.solicitante, p.b.fecha, wb, p.excluirId);
          })()
        : null);
    return { error, motivos: emp.motivos };
  }

  private async exigir(db: any, p: Parameters<AsistenciaTurnosService['validar']>[1]) {
    const r = await this.validar(db, p);
    if (r.error) throw new ConflictException({ codigo: 'REEMPLAZO_NO_ELEGIBLE', mensaje: r.error });
    return r;
  }

  // ---------------------------------------------------------------------------
  // Candidatos y turnos para devolver (lo que ve el asistente del celular)
  // ---------------------------------------------------------------------------

  /** Solo personas elegibles para cubrir la ventana, con el porqué; y cuántas se descartaron por cada motivo. */
  async candidatos(partyId: bigint, q: Pierna, ahora = new Date()) {
    this.validarForma(q, ahora);
    const w = ventana(q.desde, q.hasta);
    const datos = await this.datosRango(this.prisma, q.fecha, q.fecha);
    const propio = this.turnoSirve(datos, partyId, q.fecha, w, 'Tú no tienes');
    if (propio) return { candidatos: [], descartados: [], aviso: propio };
    const todas = await this.cuentas(this.prisma);
    const yo = todas.get(partyId);
    if (!yo) return { candidatos: [], descartados: [], aviso: 'Tu cuenta no está activa' };
    const candidatos: Array<{ partyId: number; nombre: string; motivos: string[] }> = [];
    const descartados = new Map<string, number>();
    for (const c of todas.values()) {
      if (c.partyId === partyId) continue;
      const emp = this.emparejar(yo, c);
      const razon = emp.ok ? this.libre(datos, c.partyId, q.fecha, w) : emp.razon;
      if (razon || !emp.ok) descartados.set(razon ?? '', (descartados.get(razon ?? '') ?? 0) + 1);
      else candidatos.push({ partyId: Number(c.partyId), nombre: c.nombre, motivos: emp.motivos });
    }
    candidatos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { candidatos, descartados: [...descartados].map(([motivo, cantidad]) => ({ motivo, cantidad })), aviso: null };
  }

  /** Para el cambio de turno: los próximos turnos de la otra persona en los que yo estoy libre (los que podría devolverle). */
  async turnosDeCandidato(partyId: bigint, otro: bigint, ahora = new Date()) {
    const hoy = jornadaDe(ahora).jornada;
    const hasta = sumarDias(hoy, TURNOS_DIAS_ADELANTO_MAX);
    const cuentas = await this.cuentas(this.prisma, [partyId, otro]);
    const yo = cuentas.get(partyId);
    const el = cuentas.get(otro);
    if (!yo || !el || !this.emparejar(yo, el).ok) throw new ConflictException({ codigo: 'REEMPLAZO_NO_ELEGIBLE', mensaje: 'Esa persona no puede cubrirte' });
    const datos = await this.datosRango(this.prisma, hoy, hasta);
    const salida: Array<{ fecha: string; etiqueta: string; desde: string; hasta: string }> = [];
    for (let f = hoy; f <= hasta; f = sumarDias(f, 1)) {
      const { turno } = resolverTurno(otro, f, datos.ctx);
      if (!turno) continue;
      const hh = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const desde = hh(turno.entrada);
      const hastaH = hh(turno.salida);
      if (momentoDeHora(f, desde).momento.getTime() <= ahora.getTime()) continue;
      if (this.libre(datos, partyId, f, ventana(desde, hastaH))) continue;
      salida.push({ fecha: f, etiqueta: etiquetaDia(f), desde, hasta: hastaH });
    }
    return salida;
  }

  // ---------------------------------------------------------------------------
  // Crear, aceptar, rechazar, cancelar
  // ---------------------------------------------------------------------------

  private validarForma(p: Pierna, ahora: Date) {
    if (!FECHA.test(p.fecha) || Number.isNaN(Date.parse(`${p.fecha}T00:00:00Z`)) || !HORA.test(p.desde) || !HORA.test(p.hasta)) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha o las horas no son válidas' });
    }
    if (p.desde === p.hasta) throw new BadRequestException({ codigo: 'HORAS_INVALIDAS', mensaje: 'La hora de inicio y la de fin no pueden ser iguales' });
    if (momentoDeHora(p.fecha, p.desde).momento.getTime() <= ahora.getTime()) {
      throw new BadRequestException({ codigo: 'FECHA_PASADA', mensaje: 'Ese turno ya empezó o ya pasó' });
    }
    if (p.fecha > sumarDias(jornadaDe(ahora).jornada, TURNOS_DIAS_ADELANTO_MAX)) {
      throw new BadRequestException({ codigo: 'MUY_ADELANTE', mensaje: `Solo puedes pedir hasta ${TURNOS_DIAS_ADELANTO_MAX} días adelante` });
    }
  }

  async crear(dto: CrearTurnoDto, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    if ([usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      throw new BadRequestException({ codigo: 'ADMIN_NO_TURNOS', mensaje: 'El administrador no trabaja turnos.' });
    }
    const motivo = (dto.motivo ?? '').trim();
    if (motivo.length < 5) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo (mínimo 5 caracteres)' });
    const a: Pierna = { fecha: dto.fecha, desde: dto.desde, hasta: dto.hasta };
    this.validarForma(a, ahora);
    let b: Pierna | null = null;
    if (dto.tipo === 'CAMBIO_TURNO') {
      if (!dto.fechaDevolucion || !dto.desdeDevolucion || !dto.hastaDevolucion) {
        throw new BadRequestException({ codigo: 'DEVOLUCION_REQUERIDA', mensaje: 'Elige el turno que tú vas a cubrir a cambio' });
      }
      b = { fecha: dto.fechaDevolucion, desde: dto.desdeDevolucion, hasta: dto.hastaDevolucion };
      this.validarForma(b, ahora);
    }
    const yo = usuario.partyId;
    const otro = BigInt(dto.reemplazoPartyId);
    if (otro === yo) throw new BadRequestException({ codigo: 'MISMA_PERSONA', mensaje: 'No puedes elegirte a ti mismo' });
    const ultimas24h = await this.prisma.solicitudTurno.count({ where: { solicitante_party_id: yo, creada_en: { gte: new Date(ahora.getTime() - 86_400_000) } } });
    if (ultimas24h >= TURNOS_MAX_PEDIDOS_DIA) {
      throw new HttpException({ codigo: 'DEMASIADOS_PEDIDOS', mensaje: `Hiciste ${TURNOS_MAX_PEDIDOS_DIA} pedidos hoy. Intenta mañana.` }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const fila = await this.prisma.$transaction(async (tx: any) => {
      const dup = await tx.solicitudTurno.findMany({
        where: { solicitante_party_id: yo, fecha: fechaDb(a.fecha), estado: { in: [...ACTIVAS, 'APROBADA'] } },
      });
      const w = ventana(a.desde, a.hasta);
      if (dup.some((s: any) => solapa(ventana(hhmmDe(s.desde), hhmmDe(s.hasta)), w))) {
        throw new ConflictException({ codigo: 'SOLICITUD_DUPLICADA', mensaje: 'Ya tienes un pedido para ese día y horario.' });
      }
      await this.exigir(tx, { tipo: dto.tipo, solicitante: yo, reemplazo: otro, a, b });
      return tx.solicitudTurno.create({
        data: {
          tipo: dto.tipo, solicitante_party_id: yo, reemplazo_party_id: otro, fecha: fechaDb(a.fecha), desde: horaDb(a.desde), hasta: horaDb(a.hasta),
          ...(b ? { fecha_devolucion: fechaDb(b.fecha), desde_devolucion: horaDb(b.desde), hasta_devolucion: horaDb(b.hasta) } : {}),
          motivo, estado: 'PENDIENTE_ACEPTA',
        },
      });
    });
    await this.auditar('SOLICITAR_TURNO', usuario.partyId, ip, fila, motivo);
    const nombres = await this.nombres([yo, otro]);
    await this.avisar('TURNO_PEDIDO', { party: otro }, `${nombres.get(yo)} te pide ${dto.tipo === 'CAMBIO_TURNO' ? 'cambiar un turno' : 'cubrir su turno'} el ${etiquetaDia(a.fecha)}`, `${a.desde} a ${a.hasta}. Entra a Mi asistencia para aceptar o rechazar.`);
    return { ok: true, id: Number(fila.id) };
  }

  private async cargar(id: number) {
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundException({ codigo: 'TURNO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    const s = await this.prisma.solicitudTurno.findUnique({ where: { id: BigInt(id) } });
    if (!s) throw new NotFoundException({ codigo: 'TURNO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    return s;
  }

  /** Si el turno ya empezó, el pedido pendiente pasa a VENCIDA y se responde 409. */
  private async exigirVigente(s: any, ahora: Date, usuario?: UsuarioAutenticado) {
    if (momentoDeHora(isoDe(s.fecha), hhmmDe(s.desde)).momento.getTime() > ahora.getTime()) return;
    const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: { in: ACTIVAS } }, data: { estado: 'VENCIDA', resuelta_en: ahora } });
    if (r.count) await this.auditar('VENCER_TURNO', usuario?.partyId, undefined, { ...s, estado: 'VENCIDA' });
    throw new ConflictException({ codigo: 'SOLICITUD_VENCIDA', mensaje: 'El turno ya empezó: el pedido venció.' });
  }

  private exigirEstado(s: any, estados: EstadoTurno[], mensaje: string) {
    if (!estados.includes(s.estado)) throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje });
  }

  private pierna = (s: any) => ({ a: { fecha: isoDe(s.fecha), desde: hhmmDe(s.desde), hasta: hhmmDe(s.hasta) } as Pierna, b: s.fecha_devolucion ? ({ fecha: isoDe(s.fecha_devolucion), desde: hhmmDe(s.desde_devolucion), hasta: hhmmDe(s.hasta_devolucion) } as Pierna) : null });

  async aceptar(id: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s = await this.cargar(id);
    if (s.reemplazo_party_id !== usuario.partyId) throw new ForbiddenException({ codigo: 'TURNO_AJENO', mensaje: 'Ese pedido no es para ti' });
    this.exigirEstado(s, ['PENDIENTE_ACEPTA'], 'Ese pedido ya no espera tu respuesta');
    await this.exigirVigente(s, ahora, usuario);
    await this.exigir(this.prisma, { tipo: s.tipo, solicitante: s.solicitante_party_id, reemplazo: s.reemplazo_party_id, ...this.pierna(s), excluirId: s.id });
    const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: 'PENDIENTE_ACEPTA' }, data: { estado: 'PENDIENTE_APRUEBA', aceptada_en: ahora } });
    if (r.count === 0) throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje: 'Ese pedido ya cambió' });
    await this.auditar('ACEPTAR_TURNO', usuario.partyId, ip, { ...s, estado: 'PENDIENTE_APRUEBA' });
    const n = await this.nombres([s.solicitante_party_id, s.reemplazo_party_id]);
    await this.avisar('TURNO_POR_APROBAR', { rol: 'SUPERVISOR' }, `${n.get(s.reemplazo_party_id)} aceptó cubrir a ${n.get(s.solicitante_party_id)} el ${etiquetaDia(isoDe(s.fecha))}`, 'Espera tu aprobación en Mi asistencia o en Asistencia › Solicitudes.');
    return { ok: true };
  }

  async rechazar(id: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s = await this.cargar(id);
    if (s.reemplazo_party_id !== usuario.partyId) throw new ForbiddenException({ codigo: 'TURNO_AJENO', mensaje: 'Ese pedido no es para ti' });
    this.exigirEstado(s, ['PENDIENTE_ACEPTA'], 'Ese pedido ya no espera tu respuesta');
    const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: 'PENDIENTE_ACEPTA' }, data: { estado: 'RECHAZADA', resuelta_por: usuario.partyId, resuelta_en: ahora } });
    if (r.count === 0) throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje: 'Ese pedido ya cambió' });
    await this.auditar('RECHAZAR_TURNO_REEMPLAZO', usuario.partyId, ip, { ...s, estado: 'RECHAZADA' });
    const n = await this.nombres([s.reemplazo_party_id]);
    await this.avisar('TURNO_RESUELTO', { party: s.solicitante_party_id }, `${n.get(s.reemplazo_party_id)} no puede cubrir tu turno del ${etiquetaDia(isoDe(s.fecha))}`, 'Pide a otra persona.');
    return { ok: true };
  }

  async cancelar(id: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s = await this.cargar(id);
    if (s.solicitante_party_id !== usuario.partyId) throw new ForbiddenException({ codigo: 'TURNO_AJENO', mensaje: 'Ese pedido no es tuyo' });
    this.exigirEstado(s, ACTIVAS, 'Solo puedes cancelar un pedido que aún no fue aprobado');
    const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: { in: ACTIVAS } }, data: { estado: 'CANCELADA', resuelta_en: ahora } });
    if (r.count === 0) throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje: 'Ese pedido ya cambió' });
    await this.auditar('CANCELAR_TURNO', usuario.partyId, ip, { ...s, estado: 'CANCELADA' });
    const n = await this.nombres([s.solicitante_party_id]);
    await this.avisar('TURNO_RESUELTO', { party: s.reemplazo_party_id }, `${n.get(s.solicitante_party_id)} canceló su pedido del ${etiquetaDia(isoDe(s.fecha))}`, 'Ya no tienes que cubrirlo.');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Aprobación (Supervisión / Admin)
  // ---------------------------------------------------------------------------

  private exigirNoInvolucrado(s: any, usuario: UsuarioAutenticado) {
    if (s.solicitante_party_id === usuario.partyId || s.reemplazo_party_id === usuario.partyId) {
      throw new ForbiddenException({ codigo: 'TURNO_PROPIO', mensaje: 'No puedes resolver un pedido en el que participas' });
    }
  }

  async aprobar(id: number, nota: string | undefined, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s0 = await this.cargar(id);
    this.exigirNoInvolucrado(s0, usuario);
    this.exigirEstado(s0, ['PENDIENTE_APRUEBA'], 'Ese pedido no está esperando aprobación');
    await this.exigirVigente(s0, ahora, usuario);
    let ids: number[];
    try {
      ids = await this.prisma.$transaction(
        async (tx: any) => {
          const s = await tx.solicitudTurno.findUnique({ where: { id: s0.id } });
          if (!s || s.estado !== 'PENDIENTE_APRUEBA') throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje: 'Ese pedido ya cambió' });
          const { a, b } = this.pierna(s);
          await this.exigir(tx, { tipo: s.tipo, solicitante: s.solicitante_party_id, reemplazo: s.reemplazo_party_id, a, b, excluirId: s.id });
          const creadas: number[] = [];
          const cobertura = async (p: Pierna, cubre: bigint, reemplaza: bigint) => {
            const c = await tx.coberturaTurno.create({
              data: { fecha: fechaDb(p.fecha), cubre_party_id: cubre, reemplaza_party_id: reemplaza, desde: horaDb(p.desde), hasta: horaDb(p.hasta), por: usuario.partyId },
            });
            creadas.push(Number(c.id));
          };
          await cobertura(a, s.reemplazo_party_id, s.solicitante_party_id);
          if (b) await cobertura(b, s.solicitante_party_id, s.reemplazo_party_id);
          await tx.solicitudTurno.update({
            where: { id: s.id },
            data: { estado: 'APROBADA', resuelta_por: usuario.partyId, resuelta_en: ahora, motivo_resolucion: (nota ?? '').trim() || null, cobertura_ids: creadas as any },
          });
          return creadas;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e: any) {
      // P2034 = dos aprobaciones a la vez chocaron: una de las dos debe reintentar viendo lo nuevo
      if (e?.code === 'P2034') throw new ConflictException({ codigo: 'CONDICIONES_CAMBIARON', mensaje: 'Las condiciones cambiaron mientras aprobabas. Revisa el pedido y vuelve a intentar.' });
      throw e;
    }
    await this.auditar('APROBAR_TURNO', usuario.partyId, ip, { ...s0, estado: 'APROBADA' }, (nota ?? '').trim() || undefined, { coberturas: ids });
    const n = await this.nombres([s0.solicitante_party_id, s0.reemplazo_party_id]);
    const f = etiquetaDia(isoDe(s0.fecha));
    await this.avisar('TURNO_RESUELTO', { party: s0.solicitante_party_id }, `Aprobado: ${n.get(s0.reemplazo_party_id)} te cubre el ${f}`, null);
    await this.avisar('TURNO_RESUELTO', { party: s0.reemplazo_party_id }, `Aprobado: cubres a ${n.get(s0.solicitante_party_id)} el ${f}`, `${hhmmDe(s0.desde)} a ${hhmmDe(s0.hasta)}. Si no marcas a tiempo, será tu falta.`);
    return { ok: true, coberturas: ids };
  }

  async rechazarAdmin(id: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const motivo = (motivoTxt ?? '').trim();
    if (motivo.length < 5) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo del rechazo (mínimo 5 caracteres)' });
    const s = await this.cargar(id);
    this.exigirNoInvolucrado(s, usuario);
    this.exigirEstado(s, ['PENDIENTE_APRUEBA'], 'Ese pedido no está esperando aprobación');
    const r = await this.prisma.solicitudTurno.updateMany({
      where: { id: s.id, estado: 'PENDIENTE_APRUEBA' },
      data: { estado: 'RECHAZADA', resuelta_por: usuario.partyId, resuelta_en: ahora, motivo_resolucion: motivo },
    });
    if (r.count === 0) throw new ConflictException({ codigo: 'ESTADO_NO_PERMITIDO', mensaje: 'Ese pedido ya cambió' });
    await this.auditar('RECHAZAR_TURNO', usuario.partyId, ip, { ...s, estado: 'RECHAZADA' }, motivo);
    const f = etiquetaDia(isoDe(s.fecha));
    for (const quien of [s.solicitante_party_id, s.reemplazo_party_id]) {
      await this.avisar('TURNO_RESUELTO', { party: quien }, `Supervisión rechazó el pedido de turno del ${f}`, motivo);
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Listas
  // ---------------------------------------------------------------------------

  private async plano(filas: any[], conValidacion = false) {
    const ids = [...new Set(filas.flatMap((s) => [s.solicitante_party_id, s.reemplazo_party_id]))];
    const cuentas = ids.length ? await this.cuentas(this.prisma, ids) : new Map<bigint, Cuenta>();
    const nombres = await this.nombres(ids);
    const salida = [];
    for (const s of filas) {
      const { a, b } = this.pierna(s);
      const sol = cuentas.get(s.solicitante_party_id);
      let validacion: unknown = null;
      if (conValidacion) {
        const v = await this.validar(this.prisma, { tipo: s.tipo, solicitante: s.solicitante_party_id, reemplazo: s.reemplazo_party_id, a, b, excluirId: s.id });
        validacion = { ok: !v.error, problema: v.error, areaYRol: v.motivos };
      }
      salida.push({
        id: Number(s.id),
        tipo: s.tipo as string,
        estado: s.estado as string,
        fecha: a.fecha, etiqueta: etiquetaDia(a.fecha), desde: a.desde, hasta: a.hasta,
        devolucion: b ? { ...b, etiqueta: etiquetaDia(b.fecha) } : null,
        motivo: s.motivo as string,
        solicitante: { partyId: Number(s.solicitante_party_id), nombre: nombres.get(s.solicitante_party_id) ?? '' },
        reemplazo: { partyId: Number(s.reemplazo_party_id), nombre: nombres.get(s.reemplazo_party_id) ?? '' },
        area: sol ? (sol.areas.length ? sol.areas.map((x) => x.nombre).join(', ') : sol.roles.map(nombreRol).join(', ')) : '',
        motivoResolucion: s.motivo_resolucion ?? null,
        creadaEn: s.creada_en.toISOString(),
        validacion,
      });
    }
    return salida;
  }

  /** Los pedidos que hice y los que me hicieron (últimos 31 días de turnos y los de fechas futuras). */
  async mias(partyId: bigint, ahora = new Date()) {
    const desde = sumarDias(jornadaDe(ahora).jornada, -31);
    const filas = await this.prisma.solicitudTurno.findMany({
      where: { fecha: { gte: fechaDb(desde) }, OR: [{ solicitante_party_id: partyId }, { reemplazo_party_id: partyId }] },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 80,
    });
    const p = await this.plano(filas);
    return p.map((x) => ({ ...x, soyYoSolicitante: x.solicitante.partyId === Number(partyId) }));
  }

  /** Bandeja de Supervisión/Admin: por defecto lo que espera aprobación, con la validación al día. */
  async paraAprobar(estado: string | undefined, ahora = new Date()) {
    const e = (ESTADOS_TURNO as readonly string[]).includes(estado ?? '') ? (estado as EstadoTurno) : 'PENDIENTE_APRUEBA';
    const filas = await this.prisma.solicitudTurno.findMany({ where: { estado: e }, orderBy: [{ fecha: 'asc' }, { id: 'asc' }], take: 100 });
    const cfg = await this.asistencia.obtenerConfig();
    return { toleranciaMin: cfg.toleranciaMin, solicitudes: await this.plano(filas, e === 'PENDIENTE_APRUEBA') };
  }

  async contarPendientes(): Promise<number> {
    return this.prisma.solicitudTurno.count({ where: { estado: 'PENDIENTE_APRUEBA' } });
  }

  // ---------------------------------------------------------------------------
  // Tarea programada: vencer pedidos y marcar los reemplazos que no llegaron
  // ---------------------------------------------------------------------------

  /** Idempotente: cada cambio de estado es un updateMany condicionado al estado anterior. */
  async procesarVencimientos(ahora = new Date()) {
    const hoy = jornadaDe(ahora).jornada;
    const cfg = await this.asistencia.obtenerConfig();
    let vencidas = 0;
    let sinMarca = 0;

    const pendientes = await this.prisma.solicitudTurno.findMany({ where: { estado: { in: ACTIVAS }, fecha: { lte: fechaDb(hoy) } } });
    for (const s of pendientes) {
      if (momentoDeHora(isoDe(s.fecha), hhmmDe(s.desde)).momento.getTime() > ahora.getTime()) continue;
      const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: { in: ACTIVAS } }, data: { estado: 'VENCIDA', resuelta_en: ahora } });
      if (!r.count) continue;
      vencidas++;
      await this.auditar('VENCER_TURNO', undefined, undefined, { ...s, estado: 'VENCIDA' });
      await this.avisar('TURNO_RESUELTO', { party: s.solicitante_party_id }, `Tu pedido de turno del ${etiquetaDia(isoDe(s.fecha))} venció sin aprobarse`, 'El turno ya empezó. Sigue siendo tuyo.');
    }

    const limite = fechaDb(sumarDias(hoy, -7));
    const aprobadas = await this.prisma.solicitudTurno.findMany({
      where: { estado: 'APROBADA', OR: [{ fecha: { gte: limite, lte: fechaDb(hoy) } }, { fecha_devolucion: { gte: limite, lte: fechaDb(hoy) } }] },
    });
    for (const s of aprobadas) {
      let falto: { quien: bigint; fecha: string } | null = null;
      const tramos = [{ quien: s.reemplazo_party_id, fecha: isoDe(s.fecha), desde: hhmmDe(s.desde) }];
      if (s.fecha_devolucion && s.desde_devolucion) tramos.push({ quien: s.solicitante_party_id, fecha: isoDe(s.fecha_devolucion), desde: hhmmDe(s.desde_devolucion) });
      for (const t of tramos) {
        const limiteMarca = momentoDeHora(t.fecha, t.desde).momento.getTime() + cfg.toleranciaMin * 60_000;
        if (ahora.getTime() <= limiteMarca) continue;
        const marca = await this.prisma.asistenciaMarca.findFirst({ where: { party_id: t.quien, jornada: fechaDb(t.fecha), estado: { not: 'ANULADA' } }, select: { id: true } });
        if (!marca) { falto = t; break; }
      }
      if (!falto) continue;
      const r = await this.prisma.solicitudTurno.updateMany({ where: { id: s.id, estado: 'APROBADA' }, data: { estado: 'SIN_MARCA', sin_marca_en: ahora } });
      if (!r.count) continue;
      sinMarca++;
      await this.auditar('SIN_MARCA_TURNO', undefined, undefined, { ...s, estado: 'SIN_MARCA' });
      const n = await this.nombres([falto.quien, s.solicitante_party_id]);
      const titulo = `${n.get(falto.quien)} no marcó: el turno del ${etiquetaDia(falto.fecha)} quedó sin cubrir`;
      await this.avisar('TURNO_SIN_MARCA', { rol: 'SUPERVISOR' }, titulo, 'La falta es de quien debía cubrir.');
      await this.avisar('TURNO_SIN_MARCA', { party: s.solicitante_party_id }, `El reemplazo no marcó: el turno del ${etiquetaDia(falto.fecha)} quedó sin cubrir`, null);
    }
    return { vencidas, sinMarca };
  }

  // ---------------------------------------------------------------------------
  // Auditoría y avisos
  // ---------------------------------------------------------------------------

  private async nombres(ids: bigint[]): Promise<Map<bigint, string>> {
    const m = await this.asistencia.cuentas([...new Set(ids)]);
    return new Map(ids.map((i) => [i, m.get(i)?.nombre ?? 'Alguien']));
  }

  private async auditar(accion: string, partyId: bigint | undefined, ip: string | undefined, s: any, motivo?: string, extra: Record<string, unknown> = {}) {
    // Solo identificadores y estado: sin nombres ni datos personales
    await this.auditoria?.registrar({
      categoria: 'CAMBIO' as any,
      modulo: 'asistencia',
      accion,
      resultado: 'OK',
      entidad: 'solicitud_turno',
      entidadId: Number(s.id),
      despues: { tipo: s.tipo, estado: s.estado, solicitante: Number(s.solicitante_party_id), reemplazo: Number(s.reemplazo_party_id), fecha: isoDe(s.fecha), ...extra },
      partyId,
      ip,
      motivo,
    } as any);
  }

  /** Campanita (nunca WhatsApp). Un fallo al avisar no tumba la operación. */
  private async avisar(tipo: string, destino: { party?: bigint; rol?: string }, titulo: string, mensaje: string | null) {
    try {
      const n = await this.prisma.notificacion.create({
        data: {
          tipo, titulo, mensaje,
          enlace: '/admin/mi-asistencia',
          ...(destino.party ? { party_destino: destino.party } : { rol_destino: destino.rol }),
        },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: n.id.toString(), titulo });
    } catch (e) {
      this.logger.error(`Aviso de turno no registrado: ${(e as Error).message}`);
    }
  }
}
