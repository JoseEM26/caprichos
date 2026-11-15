import type { PrismaService } from '../../../comun/prisma/prisma.service';
import type { LocalService } from '../../local/local.service';
import { formatearHora, obtenerFechaHoraLima } from '../../local/local.util';
import { dentroDeHorario } from './anti-bloqueo.util';

export interface HorarioLocal {
  abierto: boolean;
  /** «hoy a las 09:00» o «mañana a las 09:00»; null si no se sabe cuándo abre. */
  apertura: string | null;
}

/**
 * Horario de trabajo del local (el de Configuración › Local: horario por día y fechas especiales). Una pausa por alta
 * demanda no cierra el local: se mira el respaldo (evolution_horario_desde/hasta), igual que si no se pudo leer el horario.
 * ponytail: la apertura de mañana mira solo el horario del día siguiente, no sus fechas especiales.
 */
export async function horarioDelLocal(
  local: Pick<LocalService, 'obtenerEstadoCarta'> | undefined,
  prisma: Pick<PrismaService, 'horarioDia'> | undefined,
  ahora: Date,
  respaldo: { desde: number; hasta: number },
): Promise<HorarioLocal> {
  const porRespaldo = (): HorarioLocal => ({ abierto: dentroDeHorario(ahora, respaldo.desde, respaldo.hasta), apertura: null });
  if (!local) return porRespaldo();
  try {
    const e = await local.obtenerEstadoCarta(ahora);
    if (e.abierta) return { abierto: true, apertura: null };
    if (e.motivo === 'PAUSA') return porRespaldo();
    const { horaMinutos, diaSemana } = obtenerFechaHoraLima(ahora);
    if (e.abre && horaMinutos < e.abre) return { abierto: false, apertura: `hoy a las ${e.abre}` };
    const manana = await prisma?.horarioDia.findUnique({ where: { dia_semana: (diaSemana % 7) + 1 } }).catch(() => null);
    const abreManana = manana && !manana.cerrado ? formatearHora(manana.abre) : null;
    return { abierto: false, apertura: abreManana ? `mañana a las ${abreManana}` : null };
  } catch {
    return porRespaldo();
  }
}
