import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CalendarioFilas, CalendarioFila, CalendarioResumen, MiCalendario, MiCalendarioDia, TipoMarca as TipoMarcaQr,
} from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { aHoraTexto, cierreJornada, jornadaDe, sumarDias } from './asistencia.calculo';
import { almuerzoMarcadoMin, detectarInconsistencia } from './asistencia.interpretacion';
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

/** Calendario de asistencia: vista del admin (todos) y vista propia (solo la cuenta del token). Reutiliza evaluarDia/cronograma. */
@Injectable()
export class AsistenciaCalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asistencia: AsistenciaService,
    private readonly correcciones: AsistenciaCorreccionesService,
  ) {}

  private async feriadosDe(desde: string, hasta: string): Promise<Map<string, string>> {
    const fs = await this.prisma.feriado.findMany({ where: { activo: true, fecha: { gte: fechaDb(desde), lte: fechaDb(hasta) } } });
    return new Map(fs.map((f) => [isoDe(f.fecha), f.nombre]));
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
    const [rolesDe, nombres, solicitudes, feriados] = await Promise.all([
      this.correcciones.rolesPorPersona(lista),
      this.asistencia.cuentas(lista),
      this.prisma.asistenciaSolicitud.findMany({
        where: { estado: { in: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] }, jornada: { gte: fechaDb(desde), lte: fechaDb(hasta) } },
        orderBy: { creada_en: 'asc' },
      }),
      this.feriadosDe(desde, hasta),
    ]);
    const solDe = new Map<string, typeof solicitudes>();
    for (const s of solicitudes) {
      const k = `${s.party_id}|${isoDe(s.jornada)}`;
      solDe.set(k, [...(solDe.get(k) ?? []), s]);
    }
    const filaPorId = new Map<number, any>(ctx.filas.map((f: any) => [Number(f.id), f]));
    const items: Array<{ fecha: string; pid: bigint; nombre: string; roles: string[]; d: Dia; sols: typeof solicitudes; inc: string | null }> = [];
    for (const pid of lista) {
      const roles = rolesDe.get(pid) ?? [];
      if (roles.includes('ADMIN')) continue;
      const nombre = nombres.get(pid)?.nombre ?? `Persona ${pid}`;
      for (const j of dias) {
        const d = this.asistencia.evaluarDia(pid, j, ctx, ahora, cfg);
        const sols = solDe.get(`${pid}|${j}`) ?? [];
        if (!d.turno && d.interp.marcas.length === 0 && sols.length === 0) continue;
        const cerrada = ahora.getTime() >= cierreJornada(j).getTime();
        const inc = cerrada ? detectarInconsistencia(d.resultado.estado, d.interp, etiquetaDia(j)) : null;
        items.push({ fecha: j, pid, nombre, roles, d, sols, inc: inc ? inc.texto : null });
      }
    }
    return { dias, items, feriados, solicitudes, filaPorId };
  }

  /** Resumen por día para pintar el calendario. */
  async resumen(desde: string, hasta: string, ahora = new Date()): Promise<CalendarioResumen> {
    const { dias, items, feriados, solicitudes } = await this.evaluarTodos(desde, hasta, ahora);
    const res = new Map(dias.map((f) => [f, {
      fecha: f, feriado: feriados.get(f) ?? null, programadas: 0, presentes: 0, tardanzas: 0, faltas: 0, aRevisar: 0,
      solicitudesPendientes: solicitudes.filter((s) => s.estado === 'PENDIENTE' && isoDe(s.jornada) === f).length, inconsistencias: 0,
    }]));
    for (const { fecha, d, inc } of items) {
      const r = res.get(fecha)!;
      const est = d.resultado.estado;
      if (d.turno) r.programadas++;
      if (d.interp.entrada) r.presentes++;
      if (est === 'TARDANZA') r.tardanzas++;
      if (est === 'FALTA') r.faltas++;
      if (est === 'A_REVISAR' || est === 'INCOMPLETO' || d.interp.marcas.some((m) => m.estado === 'A_REVISAR')) r.aRevisar++;
      if (inc) r.inconsistencias++;
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
      inconsistencias: i.inc ? [i.inc] : [],
    }));
    return { total: filtradas.length, pagina, limite, filas, totales };
  }

  /**
   * Calendario propio. SIEMPRE de `partyId` (la cuenta del token). Sin fotos, coordenadas, dispositivo ni notas internas.
   * Extra: APROBADA si el admin la aprobó, PENDIENTE si hay minutos extra sin aprobar. ponytail: RECHAZADA no se guarda en
   * ninguna tabla hoy (aprobar/quitar aprobación), así que nunca se devuelve; añadirla cuando exista el rechazo explícito.
   */
  async miCalendario(partyId: bigint, desde?: string, hasta?: string, ahora = new Date()): Promise<MiCalendario> {
    const hoy = jornadaDe(ahora).jornada;
    const d0 = desde ?? `${hoy.slice(0, 8)}01`;
    const h0 = hasta ?? isoDe(new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)));
    const dias = diasDelRango(d0, h0);
    const cfg = await this.asistencia.obtenerConfig();
    const ctx = await this.asistencia.cargarContexto(d0, h0, [partyId]);
    const rango = { gte: fechaDb(d0), lte: fechaDb(h0) };
    const [extras, solicitudes, feriados] = await Promise.all([
      this.prisma.planillaExtraAprobada.findMany({ where: { party_id: partyId, jornada: rango } }),
      this.prisma.asistenciaSolicitud.findMany({
        where: { party_id: partyId, estado: { in: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] }, jornada: rango },
        orderBy: { creada_en: 'asc' },
      }),
      this.feriadosDe(d0, h0),
    ]);
    const aprobadas = new Set(extras.map((e) => isoDe(e.jornada)));
    const resumen = { diasTrabajados: 0, horasTrabajadasMin: 0, tardanzaMin: 0, extraAprobadaMin: 0, extraPendienteMin: 0, faltas: 0 };
    const out: MiCalendarioDia[] = dias.map((fecha) => {
      const d = this.asistencia.evaluarDia(partyId, fecha, ctx, ahora, cfg);
      const r = d.resultado;
      const extraEstado = r.extraMin > 0 ? (aprobadas.has(fecha) ? 'APROBADA' : 'PENDIENTE') : null;
      const sol = [...solicitudes].reverse().find((s) => isoDe(s.jornada) === fecha);
      if (r.trabajadaMin > 0) { resumen.diasTrabajados++; resumen.horasTrabajadasMin += r.trabajadaMin; }
      resumen.tardanzaMin += r.tardanzaMin;
      if (r.estado === 'FALTA') resumen.faltas++;
      if (extraEstado === 'APROBADA') resumen.extraAprobadaMin += r.extraMin;
      if (extraEstado === 'PENDIENTE') resumen.extraPendienteMin += r.extraMin;
      const { almuerzoMin, ...horas } = horasDelDia(d);
      return {
        fecha,
        feriado: feriados.get(fecha) ?? null,
        programado: turnoSimple(d),
        estado: r.estado,
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
    return { desde: d0, hasta: h0, dias: out, resumen };
  }
}
