import type { AsistenciaCorreccionesService, AsistenciaService } from '../../asistencia';

const sumarDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

/** Una jornada evaluada de una persona. Nunca lleva sueldos, documentos, selfies ni GPS: solo estado y minutos. */
export interface JornadaPersona {
  fecha: string;
  pid: bigint;
  roles: string[];
  programada: boolean;
  presente: boolean;
  estado: string;
  tardanzaMin: number;
  trabajadaMin: number;
}

/** Tope de personas×días evaluados por consulta (92 días × ~65 personas); si se pasa, se corta y se avisa. */
export const MAX_JORNADAS = 6000;

/**
 * Evalúa las jornadas de todas las personas con actividad en el rango reutilizando el motor de asistencia
 * (mismo cálculo que el calendario y la planilla). El ADMIN no marca y no entra.
 */
export async function jornadasDelRango(
  asistencia: AsistenciaService,
  correcciones: AsistenciaCorreccionesService,
  desde: string,
  hasta: string,
  ahora: Date,
): Promise<{ jornadas: JornadaPersona[]; truncado: boolean }> {
  const dias: string[] = [];
  for (let j = desde; j <= hasta; j = sumarDias(j, 1)) dias.push(j);
  const cfg = await asistencia.obtenerConfig();
  const ctx = await asistencia.cargarContexto(desde, hasta);
  const ids = new Set<bigint>();
  for (const j of dias) for (const p of asistencia.partesConActividad(ctx, j)) ids.add(p);
  const rolesDe = await correcciones.rolesPorPersona([...ids]);
  const jornadas: JornadaPersona[] = [];
  let truncado = false;
  for (const pid of ids) {
    const roles = rolesDe.get(pid) ?? [];
    if (roles.includes('ADMIN')) continue;
    for (const fecha of dias) {
      const d = asistencia.evaluarDia(pid, fecha, ctx, ahora, cfg);
      if (!d.turno && d.interp.marcas.length === 0) continue;
      if (jornadas.length >= MAX_JORNADAS) {
        truncado = true;
        break;
      }
      jornadas.push({
        fecha,
        pid,
        roles,
        programada: Boolean(d.turno),
        presente: Boolean(d.interp.entrada),
        estado: d.resultado.estado,
        tardanzaMin: d.resultado.tardanzaMin,
        trabajadaMin: d.resultado.trabajadaMin,
      });
    }
    if (truncado) break;
  }
  return { jornadas, truncado };
}
