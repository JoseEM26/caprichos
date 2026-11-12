import { BadRequestException } from '@nestjs/common';

/** Tope de días de cualquier consulta de Análisis (protege la base: rangos acotados). */
export const MAX_DIAS_ANALISIS = 92;

export const MODALIDADES = ['MESA', 'RECOGER', 'DELIVERY', 'COMER_LOCAL'] as const;
export const CANALES = ['CARTA', 'CAJA', 'MOZO', 'WHATSAPP', 'BOT'] as const;
export const TURNOS = ['MANANA', 'TARDE', 'NOCHE'] as const;
export type Turno = (typeof TURNOS)[number];

/** Horas de Lima de cada turno: mañana [0,12), tarde [12,18), noche [18,24). */
export const HORAS_TURNO: Record<Turno, [number, number]> = { MANANA: [0, 12], TARDE: [12, 18], NOCHE: [18, 24] };

export interface FiltrosAnalisis {
  desde?: string;
  hasta?: string;
  modalidad?: string;
  canal?: string;
  turno?: string;
}

export interface RangoAnalisis {
  desde: string;
  hasta: string;
  /** Instante de inicio (00:00 Lima de `desde`) y fin exclusivo (00:00 Lima del día siguiente a `hasta`). */
  inicio: Date;
  fin: Date;
  dias: number;
  modalidad: string | null;
  canal: string | null;
  turno: Turno | null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;
// Lima no usa horario de verano: siempre UTC-5
const aInstanteLima = (f: string) => new Date(`${f}T00:00:00-05:00`);
export const hoyLimaISO = (ahora: Date = new Date()): string => new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

const error = (mensaje: string) => new BadRequestException({ codigo: 'FILTRO_INVALIDO', mensaje });

function enumerado<T extends string>(valor: string | undefined, validos: readonly T[], nombre: string): T | null {
  if (valor == null || valor === '' || valor === 'todos' || valor === 'TODOS') return null;
  const v = valor.toUpperCase() as T;
  if (!validos.includes(v)) throw error(`${nombre} no válido`);
  return v;
}

/** Valida y normaliza los filtros comunes. Sin fechas: hoy. Rango máximo: 92 días, nunca hacia el futuro. */
export function resolverFiltros(f: FiltrosAnalisis, ahora: Date = new Date()): RangoAnalisis {
  const hoy = hoyLimaISO(ahora);
  const desde = f.desde || f.hasta || hoy;
  const hasta = f.hasta || f.desde || hoy;
  if (!FECHA.test(desde) || !FECHA.test(hasta) || Number.isNaN(aInstanteLima(desde).getTime()) || Number.isNaN(aInstanteLima(hasta).getTime())) {
    throw error('Las fechas deben ser AAAA-MM-DD');
  }
  if (desde > hasta) throw error('La fecha «desde» no puede ser posterior a «hasta»');
  if (hasta > hoy) throw error('No se puede consultar el futuro');
  const inicio = aInstanteLima(desde);
  const fin = new Date(aInstanteLima(hasta).getTime() + DIA_MS);
  const dias = Math.round((fin.getTime() - inicio.getTime()) / DIA_MS);
  if (dias > MAX_DIAS_ANALISIS) throw error(`El rango máximo es de ${MAX_DIAS_ANALISIS} días`);
  return {
    desde,
    hasta,
    inicio,
    fin,
    dias,
    modalidad: enumerado(f.modalidad, MODALIDADES, 'La modalidad'),
    canal: enumerado(f.canal, CANALES, 'El canal'),
    turno: enumerado(f.turno, TURNOS, 'El turno'),
  };
}

/** Hora (0-23) en Lima de un instante. */
export const horaLima = (d: Date): number => new Date(d.getTime() - 5 * 3_600_000).getUTCHours();

export const enTurno = (d: Date, turno: Turno): boolean => {
  const h = horaLima(d);
  const [a, b] = HORAS_TURNO[turno];
  return h >= a && h < b;
};
