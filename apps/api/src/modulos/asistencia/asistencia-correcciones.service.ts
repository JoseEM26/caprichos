import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { vigenciaRolExtra } from '../acceso/roles-usuario';
import { AsistenciaService } from './asistencia.service';
import { HORA_CIERRE_MIN, TipoMarca, aHoraTexto, cierreJornada, jornadaDe, sumarDias } from './asistencia.calculo';
import { Inconsistencia, TipoInconsistencia, detectarInconsistencia, rolEfectivo } from './asistencia.interpretacion';
import { CrearSolicitudDto } from './dto/asistencia.dto';

const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS_RANGO = 31;
/** Tope de ítems por lote (aprobar/rechazar en masa). */
export const MAX_LOTE = 200;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «lunes 9» a partir de una fecha ISO. */
export const etiquetaDia = (j: string): string => `${DIAS[new Date(`${j}T00:00:00Z`).getUTCDay()]} ${Number(j.slice(8, 10))}`;

/** Instante (Lima = UTC-5) de una hora «HH:MM» de la jornada; de 00:00 a 03:59 es la madrugada del día siguiente. */
export function momentoDeHora(jornada: string, hora: string): { momento: Date; minutos: number } {
  const [h, m] = hora.split(':').map(Number);
  const hm = h * 60 + m;
  const minutos = hm < HORA_CIERRE_MIN ? hm + 1440 : hm;
  return { minutos, momento: new Date(Date.parse(`${jornada}T00:00:00Z`) + (minutos + 300) * 60_000) };
}

export interface ItemSolicitud {
  tipo: TipoMarca;
  hora: string;
  momento: string;
}

export interface InconsistenciaPersona extends Inconsistencia {
  jornada: string;
  etiqueta: string;
  /** SIN_CORREGIR: hay que pedir la corrección; ENVIADA: ya pidió y espera al admin. */
  estado: 'SIN_CORREGIR' | 'ENVIADA';
  /** Motivo con el que el admin rechazó una solicitud anterior (reaparece la inconsistencia). */
  rechazo: string | null;
  solicitudId: number | null;
}

/** Cronograma (solo lectura), solicitudes de corrección e inconsistencias de asistencia. */
@Injectable()
export class AsistenciaCorreccionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cronograma (ADMIN): por rango, por persona, sin N+1
  // ---------------------------------------------------------------------------

  async cronograma(q: { desde: string; hasta: string; partyId?: number; rol?: string }, ahora = new Date()) {
    if (!FECHA.test(q.desde) || !FECHA.test(q.hasta) || q.hasta < q.desde) {
      throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: 'El rango de fechas no es válido' });
    }
    const dias: string[] = [];
    for (let j = q.desde; j <= q.hasta && dias.length <= MAX_DIAS_RANGO; j = sumarDias(j, 1)) dias.push(j);
    if (dias.length > MAX_DIAS_RANGO) {
      throw new BadRequestException({ codigo: 'RANGO_MUY_LARGO', mensaje: `Pide como máximo ${MAX_DIAS_RANGO} días por vez` });
    }
    const cfg = await this.asistencia.obtenerConfig();
    const ctx = await this.asistencia.cargarContexto(q.desde, q.hasta, q.partyId ? [BigInt(q.partyId)] : undefined);
    const ids = new Set<bigint>();
    for (const j of dias) for (const p of this.asistencia.partesConActividad(ctx, j)) ids.add(p);
    if (q.partyId) for (const p of [...ids]) if (p !== BigInt(q.partyId)) ids.delete(p);
    const lista = [...ids];

    const [rolesDe, nombres, solicitudes] = await Promise.all([
      this.rolesPorPersona(lista),
      this.asistencia.cuentas(lista),
      this.prisma.asistenciaSolicitud.findMany({
        where: { estado: 'PENDIENTE', jornada: { gte: fechaDb(q.desde), lte: fechaDb(q.hasta) } },
        orderBy: { creada_en: 'asc' },
      }),
    ]);
    const filaPorId = new Map(ctx.filas.map((f: any) => [Number(f.id), f]));
    const solDe = new Map<string, typeof solicitudes>();
    for (const s of solicitudes) {
      const k = `${s.party_id}|${isoDe(s.jornada)}`;
      solDe.set(k, [...(solDe.get(k) ?? []), s]);
    }

    const resumen: Record<string, { total: number; cumplieron: number; tardanzas: number; aRevisar: number; faltas: number; solicitudes: number }> = {};
    for (const j of dias) resumen[j] = { total: 0, cumplieron: 0, tardanzas: 0, aRevisar: 0, faltas: 0, solicitudes: 0 };

    const personas = [];
    for (const pid of lista) {
      const roles = rolesDe.get(pid) ?? [];
      if (roles.includes('ADMIN')) continue; // el administrador no marca
      if (q.rol && !roles.includes(q.rol)) continue;
      const nombre = nombres.get(pid)?.nombre ?? `Persona ${pid}`;
      const diasP = [];
      for (const j of dias) {
        const d = this.asistencia.evaluarDia(pid, j, ctx, ahora, cfg);
        const sols = solDe.get(`${pid}|${j}`) ?? [];
        if (!d.turno && d.interp.marcas.length === 0 && sols.length === 0) continue; // día de descanso sin nada
        const cerrada = ahora.getTime() >= cierreJornada(j).getTime();
        const inc = cerrada ? detectarInconsistencia(d.resultado.estado, d.interp, etiquetaDia(j)) : null;
        const r = resumen[j];
        const est = d.resultado.estado;
        if (est !== 'DESCANSO') {
          r.total++;
          if (est === 'CUMPLIO' || est === 'SALIO_DESPUES' || est === 'SALIO_ANTES') r.cumplieron++;
          if (est === 'TARDANZA') r.tardanzas++;
          if (est === 'A_REVISAR' || est === 'INCOMPLETO' || d.interp.marcas.some((m) => m.estado === 'A_REVISAR')) r.aRevisar++;
          if (est === 'FALTA') r.faltas++;
        }
        r.solicitudes += sols.length;
        diasP.push({
          jornada: j,
          estado: est,
          turno: d.turno
            ? { entrada: d.turno.entrada, salida: d.turno.salida, almuerzoIni: d.turno.almuerzoIni ?? null, almuerzoFin: d.turno.almuerzoFin ?? null }
            : null,
          turnoTexto: d.turnoTexto,
          alertas: d.resultado.alertas,
          trabajadaMin: d.resultado.trabajadaMin,
          tardanzaMin: d.resultado.tardanzaMin,
          breakMin: d.interp.breakMin,
          tramos: d.interp.tramos,
          marcas: d.interp.marcas.map((m) => {
            const f: any = filaPorId.get(m.id ?? -1);
            return {
              id: m.id,
              minutos: m.minutos,
              hora: aHoraTexto(m.minutos),
              momento: f ? f.momento.toISOString() : null,
              origen: f?.origen ?? null,
              estado: f?.estado ?? m.estado,
              rol: rolEfectivo(d.interp, m),
              duplicada: m.duplicadaDe !== null,
              tieneSelfie: Boolean(f?.selfie),
              motivo: f?.motivo ?? null,
              alertas: f?.motivos_revision ?? null,
              // GPS aproximado (distancia al local y precisión del celular), sin coordenadas: solo para el admin
              distanciaM: f?.distancia_m != null ? Math.round(Number(f.distancia_m)) : null,
              precisionM: f?.precision_m != null ? Math.round(Number(f.precision_m)) : null,
            };
          }),
          solicitudes: sols.map((s) => ({ id: Number(s.id), motivo: s.motivo, creadaEn: s.creada_en.toISOString(), items: this.itemsDe(s.items) })),
          cantidadesRaras: d.interp.estado === 'A_REVISAR',
          inconsistencia: inc ? { ...inc, sinSolicitud: sols.length === 0 } : null,
        });
      }
      if (diasP.length) personas.push({ partyId: Number(pid), nombre, roles, dias: diasP });
    }
    personas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { desde: q.desde, hasta: q.hasta, dias, resumen, personas };
  }

  /** Roles (principal y extras vigentes) de cada persona. Lo usan el cronograma y el calendario. */
  async rolesPorPersona(lista: bigint[]): Promise<Map<bigint, string[]>> {
    const cuentas = await this.prisma.userAccount.findMany({ where: { party_id: { in: lista } }, select: { id: true, party_id: true, rol: true } });
    const extras = cuentas.length
      ? await this.prisma.userAccountRol.findMany({
          where: { user_account_id: { in: cuentas.map((c) => c.id) }, OR: vigenciaRolExtra() },
          select: { user_account_id: true, rol: true },
        })
      : [];
    const rolesDe = new Map<bigint, string[]>();
    for (const c of cuentas) {
      rolesDe.set(c.party_id, [c.rol, ...extras.filter((e) => e.user_account_id === c.id && e.rol !== c.rol).map((e) => e.rol)]);
    }
    return rolesDe;
  }

  // ---------------------------------------------------------------------------
  // Inconsistencias de MI asistencia (la persona las corrige al día siguiente)
  // ---------------------------------------------------------------------------

  /** Jornadas cerradas con marcas que no cuadran, dentro del plazo y fuera de períodos pagados. Solo de `partyId`. */
  async inconsistencias(partyId: bigint, ahora = new Date()): Promise<InconsistenciaPersona[]> {
    const cfg = await this.asistencia.obtenerConfig();
    const hoy = jornadaDe(ahora).jornada;
    const desde = sumarDias(hoy, -cfg.solicitudDiasMax);
    const hasta = sumarDias(hoy, -1);
    const ctx = await this.asistencia.cargarContexto(desde, hasta, [partyId]);
    const rango = { gte: fechaDb(desde), lte: fechaDb(hasta) };
    const [pagados, vacaciones, solicitudes] = await Promise.all([
      this.prisma.planillaPeriodo.findMany({ where: { party_id: partyId, estado: 'PAGADO', desde: { lte: fechaDb(hasta) }, hasta: { gte: fechaDb(desde) } } }),
      this.prisma.vacacionMovimiento.findMany({
        where: { party_id: partyId, anulado_en: null, tipo: 'TOMADAS', fecha_desde: { lte: fechaDb(hasta) }, fecha_hasta: { gte: fechaDb(desde) } },
      }),
      this.prisma.asistenciaSolicitud.findMany({
        where: { party_id: partyId, estado: { in: ['PENDIENTE', 'RECHAZADA'] }, jornada: rango },
        orderBy: { creada_en: 'asc' },
      }),
    ]);
    const enPagado = (j: string) => pagados.some((p) => isoDe(p.desde) <= j && isoDe(p.hasta) >= j);
    const enVacacion = (j: string) => vacaciones.some((v) => isoDe(v.fecha_desde) <= j && isoDe(v.fecha_hasta) >= j);
    const salida: InconsistenciaPersona[] = [];
    for (let j = hasta; j >= desde; j = sumarDias(j, -1)) {
      if (enPagado(j) || enVacacion(j)) continue;
      const d = this.asistencia.evaluarDia(partyId, j, ctx, ahora, cfg);
      const inc = detectarInconsistencia(d.resultado.estado, d.interp, etiquetaDia(j));
      if (!inc) continue;
      const delDia = solicitudes.filter((s) => isoDe(s.jornada) === j);
      const pendiente = delDia.find((s) => s.estado === 'PENDIENTE');
      const rechazada = [...delDia].reverse().find((s) => s.estado === 'RECHAZADA');
      salida.push({
        ...inc,
        jornada: j,
        etiqueta: etiquetaDia(j),
        estado: pendiente ? 'ENVIADA' : 'SIN_CORREGIR',
        rechazo: pendiente ? null : (rechazada?.motivo_resolucion ?? null),
        solicitudId: pendiente ? Number(pendiente.id) : null,
      });
    }
    return salida;
  }

  // ---------------------------------------------------------------------------
  // Solicitudes de corrección (la persona pide; el admin aprueba)
  // ---------------------------------------------------------------------------

  private itemsDe(valor: unknown): ItemSolicitud[] {
    return Array.isArray(valor) ? (valor as ItemSolicitud[]) : [];
  }

  private async periodoPagado(partyId: bigint, jornada: string) {
    return this.prisma.planillaPeriodo.findFirst({
      where: { party_id: partyId, estado: 'PAGADO', desde: { lte: fechaDb(jornada) }, hasta: { gte: fechaDb(jornada) } },
    });
  }

  async crearSolicitud(dto: CrearSolicitudDto, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    if ([usuario.rol, ...(usuario.roles ?? [])].includes('ADMIN')) {
      throw new BadRequestException({ codigo: 'ADMIN_NO_MARCA', mensaje: 'El administrador no marca asistencia ni pide correcciones.' });
    }
    const partyId = usuario.partyId;
    const cfg = await this.asistencia.obtenerConfig();
    const hoy = jornadaDe(ahora).jornada;
    if (!FECHA.test(dto.jornada) || Number.isNaN(Date.parse(`${dto.jornada}T00:00:00Z`))) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha no es válida' });
    }
    if (dto.jornada > hoy) throw new BadRequestException({ codigo: 'JORNADA_FUTURA', mensaje: 'No puedes corregir una jornada que aún no ocurre' });
    if (dto.jornada < sumarDias(hoy, -cfg.solicitudDiasMax)) {
      throw new BadRequestException({ codigo: 'JORNADA_MUY_ANTIGUA', mensaje: `Solo puedes pedir correcciones de los últimos ${cfg.solicitudDiasMax} días` });
    }
    const motivo = dto.motivo.trim();
    if (motivo.length < 5) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo (mínimo 5 caracteres)' });
    if (await this.periodoPagado(partyId, dto.jornada)) {
      throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado: pide al administrador que lo reabra.' });
    }
    const items: ItemSolicitud[] = [];
    for (const it of dto.items) {
      const { momento } = momentoDeHora(dto.jornada, it.hora);
      if (momento.getTime() > ahora.getTime()) {
        throw new BadRequestException({ codigo: 'HORA_FUTURA', mensaje: `La hora ${it.hora} todavía no llega` });
      }
      if (items.some((x) => x.tipo === it.tipo && x.hora === it.hora)) {
        throw new BadRequestException({ codigo: 'ITEM_REPETIDO', mensaje: 'Repetiste la misma marca en la solicitud' });
      }
      items.push({ tipo: it.tipo, hora: it.hora, momento: momento.toISOString() });
    }
    const pendientes = await this.prisma.asistenciaSolicitud.findMany({ where: { party_id: partyId, jornada: fechaDb(dto.jornada), estado: 'PENDIENTE' } });
    const claves = new Set(pendientes.flatMap((p) => this.itemsDe(p.items).map((i) => `${i.tipo}|${i.hora}`)));
    if (items.some((i) => claves.has(`${i.tipo}|${i.hora}`))) {
      throw new ConflictException({ codigo: 'SOLICITUD_DUPLICADA', mensaje: 'Ya enviaste una solicitud pendiente con esa marca y hora para esa jornada.' });
    }
    const fila = await this.prisma.asistenciaSolicitud.create({
      data: { party_id: partyId, jornada: fechaDb(dto.jornada), items: items as any, motivo, estado: 'PENDIENTE' },
    });
    await this.auditar('SOLICITAR_CORRECCION', usuario.partyId, ip, fila.id, { jornada: dto.jornada, items }, motivo);
    return { ok: true, id: Number(fila.id) };
  }

  /** Mis solicitudes de los últimos 31 días, con su estado y el motivo si el admin la rechazó. */
  async misSolicitudes(partyId: bigint, ahora = new Date()) {
    const desde = sumarDias(jornadaDe(ahora).jornada, -31);
    const filas = await this.prisma.asistenciaSolicitud.findMany({
      where: { party_id: partyId, jornada: { gte: fechaDb(desde) } },
      orderBy: { creada_en: 'desc' },
      take: 60,
    });
    return filas.map((s) => this.aPlano(s));
  }

  private aPlano(s: any) {
    return {
      id: Number(s.id),
      partyId: Number(s.party_id),
      jornada: isoDe(s.jornada),
      etiqueta: etiquetaDia(isoDe(s.jornada)),
      items: this.itemsDe(s.items),
      motivo: s.motivo,
      estado: s.estado as string,
      creadaEn: s.creada_en.toISOString(),
      resueltaEn: s.resuelta_en ? s.resuelta_en.toISOString() : null,
      motivoResolucion: s.motivo_resolucion ?? null,
    };
  }

  async cancelarSolicitud(id: number, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s = await this.prisma.asistenciaSolicitud.findUnique({ where: { id: BigInt(id) } });
    if (!s) throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' });
    if (s.party_id !== usuario.partyId) throw new ForbiddenException({ codigo: 'SOLICITUD_AJENA', mensaje: 'Esa solicitud no es tuya' });
    if (s.estado !== 'PENDIENTE') throw new ConflictException({ codigo: 'NO_ESTA_PENDIENTE', mensaje: 'Solo puedes cancelar una solicitud pendiente' });
    await this.prisma.asistenciaSolicitud.update({ where: { id: s.id }, data: { estado: 'CANCELADA', resuelta_en: ahora } });
    await this.auditar('CANCELAR_SOLICITUD', usuario.partyId, ip, s.id, { jornada: isoDe(s.jornada) });
    return { ok: true };
  }

  /**
   * Bandeja del admin (últimos 31 días): solicitudes pendientes, marcas por revisar (usuario y contraseña, GPS dudoso),
   * dobles marcas y jornadas con inconsistencia que nadie ha pedido corregir. Todo con persona y rol para filtrar en pantalla.
   */
  async bandeja(ahora = new Date()) {
    const pendientes = await this.prisma.asistenciaSolicitud.findMany({ where: { estado: 'PENDIENTE' }, orderBy: { creada_en: 'asc' }, take: 200 });
    const nombres = await this.asistencia.cuentas([...new Set(pendientes.map((p) => p.party_id))]);
    const cfg = await this.asistencia.obtenerConfig();
    const hoy = jornadaDe(ahora).jornada;
    const crono = await this.cronograma({ desde: sumarDias(hoy, -(MAX_DIAS_RANGO - 1)), hasta: hoy }, ahora);
    const limite = sumarDias(hoy, -cfg.solicitudDiasMax);
    const rolesDe = new Map(crono.personas.map((p) => [p.partyId, p.roles]));
    const sinSolicitud: Array<{ partyId: number; nombre: string; roles: string[]; jornada: string; tipo: TipoInconsistencia; texto: string }> = [];
    const marcas: Array<Record<string, unknown>> = [];
    for (const p of crono.personas) {
      for (const d of p.dias) {
        if (d.inconsistencia?.sinSolicitud && d.jornada >= limite && d.jornada < hoy) {
          sinSolicitud.push({ partyId: p.partyId, nombre: p.nombre, roles: p.roles, jornada: d.jornada, tipo: d.inconsistencia.tipo, texto: d.inconsistencia.texto });
        }
        for (const m of d.marcas) {
          const porRevisar = m.estado === 'A_REVISAR';
          const doble = m.duplicada && m.estado === 'VALIDA';
          if (!porRevisar && !doble) continue;
          marcas.push({
            id: m.id, partyId: p.partyId, nombre: p.nombre, roles: p.roles, jornada: d.jornada, hora: m.hora, rol: m.rol, origen: m.origen,
            estado: m.estado, alertas: m.alertas, tieneSelfie: m.tieneSelfie,
            // WEB = marca manual (usuario y contraseña); DOBLE = unida a la anterior; CELULAR = con alertas de GPS
            clase: porRevisar ? (m.origen === 'WEB' ? 'WEB' : 'CELULAR') : 'DOBLE',
            cantidadesRaras: d.cantidadesRaras,
          });
        }
      }
    }
    return {
      solicitudes: pendientes.map((s) => ({ ...this.aPlano(s), nombre: nombres.get(s.party_id)?.nombre ?? `Persona ${s.party_id}`, roles: rolesDe.get(Number(s.party_id)) ?? [] })),
      sinSolicitud,
      marcas,
    };
  }

  // ---------------------------------------------------------------------------
  // Lote: aprobar / rechazar varias a la vez (reutiliza la lógica de una en una; resultado por ítem, nada a medias en silencio)
  // ---------------------------------------------------------------------------

  async lote(
    dto: { accion: 'APROBAR' | 'RECHAZAR'; motivo?: string; nota?: string; items: Array<{ tipo: 'MARCA' | 'SOLICITUD'; id: number }> },
    usuario: UsuarioAutenticado,
    ip?: string,
    ahora = new Date(),
  ) {
    const vistos = new Set<string>();
    const items = dto.items.filter((i) => !vistos.has(`${i.tipo}${i.id}`) && vistos.add(`${i.tipo}${i.id}`));
    if (items.length === 0) throw new BadRequestException({ codigo: 'LOTE_VACIO', mensaje: 'No elegiste nada' });
    if (items.length > MAX_LOTE) throw new BadRequestException({ codigo: 'LOTE_MUY_GRANDE', mensaje: `Máximo ${MAX_LOTE} por vez` });
    const motivo = (dto.motivo ?? '').trim();
    if (dto.accion === 'RECHAZAR' && motivo.length < 10) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe un motivo de al menos 10 caracteres para rechazar' });
    }
    // períodos pagados: una sola consulta para todo el lote
    const marcasBd = await this.prisma.asistenciaMarca.findMany({ where: { id: { in: items.filter((i) => i.tipo === 'MARCA').map((i) => BigInt(i.id)) } } });
    const solBd = await this.prisma.asistenciaSolicitud.findMany({ where: { id: { in: items.filter((i) => i.tipo === 'SOLICITUD').map((i) => BigInt(i.id)) } } });
    const partes = [...new Set([...marcasBd.map((m) => m.party_id), ...solBd.map((x) => x.party_id)])];
    const pagados = partes.length ? await this.prisma.planillaPeriodo.findMany({ where: { party_id: { in: partes }, estado: 'PAGADO' } }) : [];
    const enPagado = (partyId: bigint, j: Date) => pagados.some((p) => p.party_id === partyId && p.desde <= j && p.hasta >= j);

    const resultados: Array<{ tipo: string; id: number; ok: boolean; codigo?: string; mensaje?: string }> = [];
    for (const it of items) {
      try {
        if (it.tipo === 'MARCA') {
          const m = marcasBd.find((x) => Number(x.id) === it.id);
          if (!m) throw new NotFoundException({ codigo: 'MARCA_NO_ENCONTRADA', mensaje: 'Marca no encontrada' });
          if (enPagado(m.party_id, m.jornada)) throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Período ya pagado: reábrelo para cambiarlo' });
          if (dto.accion === 'RECHAZAR') await this.asistencia.revisarMarca(it.id, 'ANULAR', { motivo }, usuario, ip);
          else await this.asistencia.revisarMarca(it.id, m.estado === 'A_REVISAR' ? 'APROBAR' : 'SEPARAR', { motivo: motivo || 'Aprobada en lote' }, usuario, ip);
        } else {
          const x = solBd.find((y) => Number(y.id) === it.id);
          if (!x) throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' });
          if (dto.accion === 'RECHAZAR') await this.rechazarSolicitud(it.id, motivo, usuario, ip, ahora);
          else await this.aprobarSolicitud(it.id, dto.nota, usuario, ip, ahora);
        }
        resultados.push({ tipo: it.tipo, id: it.id, ok: true });
      } catch (e: any) {
        const r = typeof e?.getResponse === 'function' ? e.getResponse() : {};
        resultados.push({ tipo: it.tipo, id: it.id, ok: false, codigo: r.codigo ?? 'ERROR', mensaje: r.mensaje ?? 'No se pudo procesar' });
      }
    }
    const ok = resultados.filter((r) => r.ok).length;
    await this.auditar(dto.accion === 'APROBAR' ? 'APROBAR_LOTE' : 'RECHAZAR_LOTE', usuario.partyId, ip, 0n, { total: resultados.length, ok, fallidas: resultados.length - ok, resultados }, motivo || undefined);
    return { total: resultados.length, ok, fallidas: resultados.length - ok, resultados };
  }

  /**
   * «Aprobar todas las marcas dudosas del período» de una persona: solo las simples (marcas por revisar y solicitudes
   * pendientes). Las jornadas con cantidades raras de marcas siguen pidiendo corrección explícita.
   */
  async aprobarSimples(partyId: number, desde: string, hasta: string, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const crono = await this.cronograma({ desde, hasta, partyId }, ahora);
    const items: Array<{ tipo: 'MARCA' | 'SOLICITUD'; id: number }> = [];
    let omitidas = 0;
    for (const d of crono.personas[0]?.dias ?? []) {
      for (const m of d.marcas) {
        if (m.estado !== 'A_REVISAR' || m.id === undefined) continue;
        if (d.cantidadesRaras) omitidas++;
        else items.push({ tipo: 'MARCA', id: m.id });
      }
      for (const s of d.solicitudes) items.push({ tipo: 'SOLICITUD', id: s.id });
    }
    if (items.length === 0) return { total: 0, ok: 0, fallidas: 0, omitidas, resultados: [] };
    const r = await this.lote({ accion: 'APROBAR', motivo: 'Aprobada en lote desde el resumen de pago', items }, usuario, ip, ahora);
    return { ...r, omitidas };
  }

  /** Aprobar: crea las marcas (origen CORRECCION, a nombre del admin, con rol fijo). Un período PAGADO no admite aprobar. */
  async aprobarSolicitud(id: number, nota: string | undefined, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const s = await this.prisma.asistenciaSolicitud.findUnique({ where: { id: BigInt(id) } });
    if (!s) throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' });
    if (s.estado !== 'PENDIENTE') throw new ConflictException({ codigo: 'NO_ESTA_PENDIENTE', mensaje: 'Esa solicitud ya fue resuelta' });
    const jornada = isoDe(s.jornada);
    if (await this.periodoPagado(s.party_id, jornada)) {
      throw new ConflictException({ codigo: 'PERIODO_PAGADO', mensaje: 'Ese período ya está pagado. Reábrelo (con motivo) para aprobar la corrección.' });
    }
    const notaTxt = (nota ?? '').trim();
    const motivo = `Solicitud #${s.id}: ${s.motivo}${notaTxt ? ` (nota del admin: ${notaTxt})` : ''}`;
    const items = this.itemsDe(s.items);
    const ids = await this.prisma.$transaction(async (tx) => {
      const creadas: number[] = [];
      for (const it of items) {
        const m = await tx.asistenciaMarca.create({
          data: {
            party_id: s.party_id,
            jornada: s.jornada,
            tipo: it.tipo,
            origen: 'CORRECCION',
            momento: new Date(it.momento),
            estado: 'VALIDA',
            motivo,
            por_party_id: usuario.partyId,
          },
        });
        creadas.push(Number(m.id));
      }
      await tx.asistenciaSolicitud.update({
        where: { id: s.id },
        data: { estado: 'APROBADA', resuelta_por: usuario.partyId, resuelta_en: ahora, motivo_resolucion: notaTxt || null, marcas_ids: creadas as any },
      });
      return creadas;
    });
    await this.auditar('APROBAR_SOLICITUD', usuario.partyId, ip, s.id, { jornada, partyId: Number(s.party_id), marcas: ids }, notaTxt || undefined);
    return { ok: true, marcas: ids };
  }

  async rechazarSolicitud(id: number, motivoTxt: string, usuario: UsuarioAutenticado, ip?: string, ahora = new Date()) {
    const motivo = (motivoTxt ?? '').trim();
    if (motivo.length < 5) throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo del rechazo (mínimo 5 caracteres)' });
    const s = await this.prisma.asistenciaSolicitud.findUnique({ where: { id: BigInt(id) } });
    if (!s) throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'Solicitud no encontrada' });
    if (s.estado !== 'PENDIENTE') throw new ConflictException({ codigo: 'NO_ESTA_PENDIENTE', mensaje: 'Esa solicitud ya fue resuelta' });
    await this.prisma.asistenciaSolicitud.update({
      where: { id: s.id },
      data: { estado: 'RECHAZADA', resuelta_por: usuario.partyId, resuelta_en: ahora, motivo_resolucion: motivo },
    });
    await this.auditar('RECHAZAR_SOLICITUD', usuario.partyId, ip, s.id, { jornada: isoDe(s.jornada), partyId: Number(s.party_id) }, motivo);
    return { ok: true };
  }

  /** Cuántas solicitudes esperan al admin (para el contador y la campana). */
  async contarPendientes(): Promise<number> {
    return this.prisma.asistenciaSolicitud.count({ where: { estado: 'PENDIENTE' } });
  }

  private async auditar(nombre: string, partyId: bigint, ip: string | undefined, entidadId: bigint, despues: Record<string, unknown>, motivo?: string) {
    await this.auditoria?.registrar({
      categoria: 'CAMBIO' as any,
      modulo: 'asistencia',
      accion: nombre,
      resultado: 'OK',
      entidad: 'asistencia_solicitud',
      entidadId: Number(entidadId),
      despues,
      partyId,
      ip,
      motivo,
    } as any);
  }
}
