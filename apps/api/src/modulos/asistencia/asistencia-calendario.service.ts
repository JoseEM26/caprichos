import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CalendarioFilas, CalendarioFila, CalendarioResumen, CoberturaDiaCalendario, MiCalendario, MiCalendarioDia, ProgramadoCalendario,
  TipoDiaCalendario, TipoMarca as TipoMarcaQr,
} from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import {
  aHoraTexto, cierreJornada, CoberturaFila, jornadaDe, minutosPagados, resolverTurno, sumarDias, Turno,
} from './asistencia.calculo';
import { almuerzoMarcadoMin, detectarInconsistencia, rolEfectivo } from './asistencia.interpretacion';
import { AsistenciaCorreccionesService, etiquetaDia } from './asistencia-correcciones.service';
import { AsistenciaService } from './asistencia.service';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DIAS_CALENDARIO = 62;
const fechaDb = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const TIPO_SOLICITUD = 'CORRECCION';

type Dia = ReturnType<AsistenciaService['evaluarDia']>;

/** Fechas del rango (1 a 62 días); BadRequest si no es válido. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const ok = (f: string) => FECHA.test(f) && !Number.isNaN(Date.parse(`${f}T00:00:00Z`));
  if (!ok(desde) || !ok(hasta) || hasta < desde) {
    throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: 'El rango de fechas no es válido' });
  }
  const dias: string[] = [];
  for (let j = desde; j <= hasta && dias.length <= MAX_DIAS_CALENDARIO; j = sumarDias(j, 1)) dias.push(j);
  if (dias.length > MAX_DIAS_CALENDARIO) {
    throw new BadRequestException({ codigo: 'RANGO_MUY_LARGO', mensaje: `Pide como máximo ${MAX_DIAS_CALENDARIO} días por vez` });
  }
  return dias;
}

/** Horas ya interpretadas de un día (entrada, salida, primer almuerzo y su duración real). */
function horasDelDia(d: Dia) {
  const br = d.interp.breaks[0];
  return {
    entrada: d.interp.entrada ? aHoraTexto(d.interp.entrada.minutos) : null,
    salida: d.interp.salida ? aHoraTexto(d.interp.salida.minutos) : null,
    almuerzoSalida: br ? aHoraTexto(br.sale) : null,
    almuerzoVuelta: br ? aHoraTexto(br.regresa) : null,
    almuerzoMin: almuerzoMarcadoMin(d.interp),
  };
}

const turnoSimple = (d: Dia) => (d.turnoTexto ? { entrada: d.turnoTexto.entrada, salida: d.turnoTexto.salida } : null);

/** Días hacia adelante que se miran para «Próximo descanso / feriado». */
const PROXIMOS_DIAS = 60;

/** Horario programado con almuerzo (si lo hay) y duración que se paga (el almuerzo cuenta). */
function programadoDe(t: Turno | null): ProgramadoCalendario | null {
  if (!t) return null;
  return {
    entrada: aHoraTexto(t.entrada),
    salida: aHoraTexto(t.salida),
    almuerzo: t.almuerzoIni != null && t.almuerzoFin != null ? { desde: aHoraTexto(t.almuerzoIni), hasta: aHoraTexto(t.almuerzoFin) } : null,
    duracionMin: minutosPagados(t),
  };
}

/** Cobertura de un día para la persona (sin nombres de otras personas). */
export function coberturaDe(pid: bigint, jornada: string, coberturas: CoberturaFila[], turno: Turno | null): CoberturaDiaCalendario | null {
  if (coberturas.some((c) => c.fecha === jornada && c.cubreId === pid)) return { rol: 'COBRE', parcial: false };
  if (coberturas.some((c) => c.fecha === jornada && c.reemplazaId === pid)) return { rol: 'CUBIERTO', parcial: turno !== null };
  return null;
}

export interface InfoDia {
  turno: Turno | null;
  motivoDescanso?: string;
  cobertura: CoberturaDiaCalendario | null;
  vacacion: boolean;
  feriado: { nombre: string; recargo: number } | null;
}

/**
 * Tipo de día para la persona. Vacaciones solo si hay turno (como en la planilla); el feriado tapa al resto
 * para que se vea el recargo; luego cobertura, trabajo, reemplazo y descanso.
 */
export function tipoDelDia(i: InfoDia): TipoDiaCalendario {
  if (i.vacacion && i.turno) return 'VACACIONES';
  if (i.feriado) return 'FERIADO';
  if (i.cobertura?.rol === 'COBRE') return 'COBERTURA';
  if (i.turno) return 'TRABAJA';
  if (i.cobertura?.rol === 'CUBIERTO' || i.motivoDescanso === 'Reemplazado ese día') return 'REEMPLAZO';
  return 'DESCANSO';
}

/** Calendario de asistencia: vista del admin (todos) y vista propia (solo la cuenta del token). Reutiliza evaluarDia/cronograma. */
@Injectable()
export class AsistenciaCalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    private readonly correcciones: AsistenciaCorreccionesService,
  ) {}

  private async feriadosDe(desde: string, hasta: string): Promise<Map<string, { nombre: string; recargo: number }>> {
    const fs = await this.prisma.feriado.findMany({ where: { activo: true, fecha: { gte: fechaDb(desde), lte: fechaDb(hasta) } } });
    return new Map(fs.map((f) => [isoDe(f.fecha), { nombre: f.nombre, recargo: Number(f.recargo) }]));
  }

  /** Fechas en que la persona tomó vacaciones (movimientos TOMADAS vigentes que se cruzan con el rango). */
  private async vacacionesDe(partyId: bigint, desde: string, hasta: string): Promise<Set<string>> {
    const vacs = await this.prisma.vacacionMovimiento.findMany({
      where: { party_id: partyId, anulado_en: null, tipo: 'TOMADAS', fecha_desde: { lte: fechaDb(hasta) }, fecha_hasta: { gte: fechaDb(desde) } },
    });
    const out = new Set<string>();
    for (const v of vacs) for (let j = isoDe(v.fecha_desde); j <= isoDe(v.fecha_hasta); j = sumarDias(j, 1)) out.add(j);
    return out;
  }

  /** Tipo de día y horario de una fecha para una persona, con lo que ya calcula resolverTurno. */
  private infoDia(pid: bigint, fecha: string, ctx: Awaited<ReturnType<AsistenciaService['cargarContexto']>>, feriados: Map<string, { nombre: string; recargo: number }>, vacs: Set<string>): InfoDia {
    const r = resolverTurno(pid, fecha, ctx);
    return {
      turno: r.turno,
      motivoDescanso: r.motivoDescanso,
      cobertura: coberturaDe(pid, fecha, ctx.coberturas, r.turno),
      vacacion: vacs.has(fecha),
      feriado: feriados.get(fecha) ?? null,
    };
  }

  /** Evalúa a todas las personas (sin ADMIN) con actividad en el rango. Una sola pasada para resumen y filas. */
  private async evaluarTodos(desde: string, hasta: string, ahora: Date, partyId?: number) {
    const dias = diasDelRango(desde, hasta);
    const cfg = await this.asistencia.obtenerConfig();
    const ctx = await this.asistencia.cargarContexto(desde, hasta, partyId ? [BigInt(partyId)] : undefined);
    const ids = new Set<bigint>();
    for (const j of dias) for (const p of this.asistencia.partesConActividad(ctx, j)) ids.add(p);
    if (partyId) for (const p of [...ids]) if (p !== BigInt(partyId)) ids.delete(p);
    const lista = [...ids];
    const [rolesDe, nombres, solicitudes, feriados, turnosSinMarca] = await Promise.all([
      this.correcciones.rolesPorPersona(lista),
      this.asistencia.cuentas(lista),
      this.prisma.asistenciaSolicitud.findMany({
        where: { estado: { in: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] }, jornada: { gte: fechaDb(desde), lte: fechaDb(hasta) } },
        orderBy: { creada_en: 'asc' },
      }),
      this.feriadosDe(desde, hasta),
      // Reemplazos aprobados que no se presentaron (los marca la tarea de turnos): quien debía cubrir y el día
      this.prisma.solicitudTurno.findMany({
        where: { estado: 'SIN_MARCA', OR: [{ fecha: { gte: fechaDb(desde), lte: fechaDb(hasta) } }, { fecha_devolucion: { gte: fechaDb(desde), lte: fechaDb(hasta) } }] },
      }),
    ]);
    const noAsistio = new Set<string>();
    for (const t of turnosSinMarca) {
      noAsistio.add(`${t.reemplazo_party_id}|${isoDe(t.fecha)}`);
      if (t.fecha_devolucion) noAsistio.add(`${t.solicitante_party_id}|${isoDe(t.fecha_devolucion)}`);
    }
    const solDe = new Map<string, typeof solicitudes>();
    for (const s of solicitudes) {
      const k = `${s.party_id}|${isoDe(s.jornada)}`;
      solDe.set(k, [...(solDe.get(k) ?? []), s]);
    }
    const filaPorId = new Map<number, any>(ctx.filas.map((f: any) => [Number(f.id), f]));
    const items: Array<{ fecha: string; pid: bigint; nombre: string; roles: string[]; d: Dia; sols: typeof solicitudes; inc: string | null; noAsistido: boolean }> = [];
    for (const pid of lista) {
      const roles = rolesDe.get(pid) ?? [];
      if (roles.includes('ADMIN')) continue;
      const nombre = nombres.get(pid)?.nombre ?? `Persona ${pid}`;
      for (const j of dias) {
        const d = this.asistencia.evaluarDia(pid, j, ctx, ahora, cfg);
        const sols = solDe.get(`${pid}|${j}`) ?? [];
        if (!d.turno && d.interp.marcas.length === 0 && sols.length === 0) continue;
        const cerrada = ahora.getTime() >= cierreJornada(j, d.turno).getTime();
        const inc = cerrada ? detectarInconsistencia(d.resultado.estado, d.interp, etiquetaDia(j)) : null;
        // Cubría un turno ajeno y no marcó: se ve claro en el calendario (solo si de verdad no tiene marcas ese día)
        const noAsistido = noAsistio.has(`${pid}|${j}`) && d.interp.marcas.length === 0;
        items.push({ fecha: j, pid, nombre, roles, d, sols, inc: inc ? inc.texto : null, noAsistido });
      }
    }
    return { dias, items, feriados, solicitudes, filaPorId };
  }

  /** Resumen por día para pintar el calendario. */
  async resumen(desde: string, hasta: string, ahora = new Date()): Promise<CalendarioResumen> {
    const { dias, items, feriados, solicitudes } = await this.evaluarTodos(desde, hasta, ahora);
    const res = new Map(dias.map((f) => [f, {
      fecha: f, feriado: feriados.get(f)?.nombre ?? null, programadas: 0, presentes: 0, tardanzas: 0, faltas: 0, aRevisar: 0,
      solicitudesPendientes: solicitudes.filter((s) => s.estado === 'PENDIENTE' && isoDe(s.jornada) === f).length, inconsistencias: 0,
    }]));
    for (const { fecha, d, inc, noAsistido } of items) {
      const r = res.get(fecha)!;
      const est = d.resultado.estado;
      if (d.turno) r.programadas++;
      if (d.interp.entrada) r.presentes++;
      if (est === 'TARDANZA') r.tardanzas++;
      if (est === 'FALTA') r.faltas++;
      if (est === 'A_REVISAR' || est === 'INCOMPLETO' || est === 'SIN_SALIDA' || d.interp.marcas.some((m) => m.estado === 'A_REVISAR')) r.aRevisar++;
      if (inc || noAsistido) r.inconsistencias++;
    }
    return { desde, hasta, dias: [...res.values()] };
  }

  /** Filas (una por persona y día) con filtros, paginación y totales de todo lo filtrado. */
  async filas(
    q: { desde: string; hasta: string; q?: string; estado?: string; rol?: string; partyId?: number; pagina?: number; limite?: string | number },
    ahora = new Date(),
  ): Promise<CalendarioFilas> {
    const { items, filaPorId } = await this.evaluarTodos(q.desde, q.hasta, ahora, q.partyId);
    const lista = (v?: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
    const estados = lista(q.estado);
    const roles = lista(q.rol);
    const texto = q.q?.trim().toLowerCase();
    const filtradas = items
      .filter((i) => (!texto || i.nombre.toLowerCase().includes(texto))
        && (!estados.length || estados.includes(i.d.resultado.estado))
        && (!roles.length || i.roles.some((r) => roles.includes(r))))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));

    const totales = { trabajadaMin: 0, tardanzaMin: 0, extraMin: 0, faltas: 0 };
    for (const i of filtradas) {
      totales.trabajadaMin += i.d.resultado.trabajadaMin;
      totales.tardanzaMin += i.d.resultado.tardanzaMin;
      totales.extraMin += i.d.resultado.extraMin;
      if (i.d.resultado.estado === 'FALTA') totales.faltas++;
    }
    const limite = q.limite === 'todas' ? 2000 : Math.min(500, Math.max(1, Number(q.limite) || 100));
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const filas: CalendarioFila[] = filtradas.slice((pagina - 1) * limite, pagina * limite).map((i) => ({
      fecha: i.fecha,
      partyId: String(i.pid),
      nombre: i.nombre,
      rol: i.roles[0] ?? '',
      turno: turnoSimple(i.d),
      marcas: i.d.interp.marcas.map((m) => {
        const f = filaPorId.get(m.id ?? -1);
        return {
          id: m.id ?? 0,
          tipo: m.declarado ?? null,
          hora: aHoraTexto(m.minutos),
          origen: f?.origen ?? '',
          estado: f?.estado ?? m.estado,
          tieneSelfie: Boolean(f?.selfie),
        };
      }),
      ...horasDelDia(i.d),
      trabajadaMin: i.d.resultado.trabajadaMin,
      tardanzaMin: i.d.resultado.tardanzaMin,
      salioAntesMin: i.d.resultado.salioAntesMin,
      extraMin: i.d.resultado.extraMin,
      estado: i.d.resultado.estado,
      solicitudes: i.sols.map((s) => ({ id: Number(s.id), tipo: TIPO_SOLICITUD, estado: s.estado })),
      inconsistencias: [...(i.inc ? [i.inc] : []), ...(i.noAsistido ? ['Reemplazo no asistido: debía cubrir un turno y no marcó.'] : [])],
    }));
    return { total: filtradas.length, pagina, limite, filas, totales };
  }

  /**
   * Calendario propio. SIEMPRE de `partyId` (la cuenta del token). Sin fotos, coordenadas, dispositivo ni notas internas.
   * Extra: APROBADA si el admin la aprobó, PENDIENTE si hay minutos extra sin aprobar. ponytail: RECHAZADA no se guarda en
   * ninguna tabla hoy (aprobar/quitar aprobación), así que nunca se devuelve; añadirla cuando exista el rechazo explícito.
   * Tipo de día, horario, feriado con recargo, cobertura y descanso: solo de la propia persona (sin nombres de otros).
   */
  async miCalendario(partyId: bigint | null | undefined, desde?: string, hasta?: string, ahora = new Date()): Promise<MiCalendario> {
    const hoy = jornadaDe(ahora).jornada;
    const d0 = desde ?? `${hoy.slice(0, 8)}01`;
    const h0 = hasta ?? isoDe(new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)));
    // Cuenta sin vínculo con una persona: calendario vacío, nunca un error.
    if (partyId == null) return { desde: d0, hasta: h0, dias: [] } as unknown as MiCalendario;
    const dias = diasDelRango(d0, h0);
    const cfg = await this.asistencia.obtenerConfig();
    // Contexto del mes pedido y de los próximos días desde hoy (para «Próximo descanso / feriado»)
    const hastaScan = sumarDias(hoy, PROXIMOS_DIAS);
    const ini = d0 < hoy ? d0 : hoy;
    const fin = h0 > hastaScan ? h0 : hastaScan;
    const ctx = await this.asistencia.cargarContexto(ini, fin, [partyId]);
    const rango = { gte: fechaDb(d0), lte: fechaDb(h0) };
    const [extras, solicitudes, feriados, vacs] = await Promise.all([
      this.prisma.planillaExtraAprobada.findMany({ where: { party_id: partyId, jornada: rango } }),
      this.prisma.asistenciaSolicitud.findMany({
        where: { party_id: partyId, estado: { in: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] }, jornada: rango },
        orderBy: { creada_en: 'asc' },
      }),
      this.feriadosDe(ini, fin),
      this.vacacionesDe(partyId, ini, fin),
    ]);
    const aprobadas = new Set(extras.map((e) => isoDe(e.jornada)));
    const resumen = {
      diasTrabajados: 0, horasTrabajadasMin: 0, tardanzaMin: 0, extraAprobadaMin: 0, extraPendienteMin: 0, faltas: 0,
      diasProgramados: 0, diasDescanso: 0, feriadosConRecargo: 0, horasProgramadasMin: 0,
    };
    const out: MiCalendarioDia[] = dias.map((fecha) => {
      const d = this.asistencia.evaluarDia(partyId, fecha, ctx, ahora, cfg);
      const r = d.resultado;
      const info = this.infoDia(partyId, fecha, ctx, feriados, vacs);
      const tipo = tipoDelDia(info);
      const estado = tipo === 'VACACIONES' ? 'VACACIONES' : r.estado;
      const extraEstado = r.extraMin > 0 ? (aprobadas.has(fecha) ? 'APROBADA' : 'PENDIENTE') : null;
      const sol = [...solicitudes].reverse().find((s) => isoDe(s.jornada) === fecha);
      if (r.trabajadaMin > 0) { resumen.diasTrabajados++; resumen.horasTrabajadasMin += r.trabajadaMin; }
      resumen.tardanzaMin += r.tardanzaMin;
      if (estado === 'FALTA') resumen.faltas++;
      if (extraEstado === 'APROBADA') resumen.extraAprobadaMin += r.extraMin;
      if (extraEstado === 'PENDIENTE') resumen.extraPendienteMin += r.extraMin;
      if (d.turno) { resumen.diasProgramados++; resumen.horasProgramadasMin += minutosPagados(d.turno); }
      if (tipo === 'DESCANSO') resumen.diasDescanso++;
      const { almuerzoMin, ...horas } = horasDelDia(d);
      const entradaM = d.interp.marcas.find((m) => m.duplicadaDe === null && rolEfectivo(d.interp, m) === 'ENTRADA');
      const feriado = info.feriado;
      return {
        fecha,
        entradaMarcaId: entradaM?.id && entradaM.id > 0 ? entradaM.id : null,
        feriado: feriado?.nombre ?? null,
        programado: programadoDe(d.turno),
        tipoDia: tipo,
        recargo: feriado ? feriado.recargo : null,
        pagaRecargo: Boolean(feriado) && feriado!.recargo !== 1 && tipo !== 'VACACIONES',
        cobertura: info.cobertura,
        motivoDescanso: tipo === 'DESCANSO' || tipo === 'REEMPLAZO' ? (info.motivoDescanso ?? 'Descanso semanal') : null,
        trabajoEnDescanso: !d.turno && d.interp.marcas.length > 0,
        estado,
        entrada: horas.entrada,
        almuerzoSalida: horas.almuerzoSalida,
        almuerzoVuelta: horas.almuerzoVuelta,
        almuerzoMin,
        salida: horas.salida,
        trabajadaMin: r.trabajadaMin,
        tardanzaMin: r.tardanzaMin,
        salioAntesMin: r.salioAntesMin,
        extraMin: r.extraMin,
        extraEstado,
        marcas: d.interp.marcas.map((m) => ({ tipo: (m.declarado ?? null) as TipoMarcaQr | null, hora: aHoraTexto(m.minutos), estado: m.estado })),
        solicitud: sol
          ? { id: Number(sol.id), tipo: TIPO_SOLICITUD, estado: sol.estado as 'PENDIENTE' | 'APROBADA' | 'RECHAZADA', motivo: sol.motivo ?? null, respuesta: sol.motivo_resolucion ?? null }
          : null,
      };
    });
    resumen.feriadosConRecargo = dias.filter((f) => { const x = feriados.get(f); return x !== undefined && x.recargo !== 1; }).length;
    // Próximo descanso y próximo feriado desde hoy (aunque el mes mostrado sea otro)
    const proximos: NonNullable<MiCalendario['proximos']> = { descanso: null, feriado: null };
    for (let j = hoy; j <= hastaScan && (!proximos.descanso || !proximos.feriado); j = sumarDias(j, 1)) {
      const info = this.infoDia(partyId, j, ctx, feriados, vacs);
      if (!proximos.feriado && info.feriado) proximos.feriado = { fecha: j, nombre: info.feriado.nombre, recargo: info.feriado.recargo };
      if (!proximos.descanso && tipoDelDia(info) === 'DESCANSO') proximos.descanso = { fecha: j };
    }
    return { desde: d0, hasta: h0, dias: out, resumen, proximos };
  }
}
