import type { HorarioDiaApi, ReemplazoDiaApi } from './tipos';

/** Orden de pantalla: lunes a domingo. `dia` usa la convención del servidor (0 = domingo). */
export const DIAS = [
  { dia: 1, letra: 'L', nombre: 'Lunes' },
  { dia: 2, letra: 'M', nombre: 'Martes' },
  { dia: 3, letra: 'X', nombre: 'Miércoles' },
  { dia: 4, letra: 'J', nombre: 'Jueves' },
  { dia: 5, letra: 'V', nombre: 'Viernes' },
  { dia: 6, letra: 'S', nombre: 'Sábado' },
  { dia: 0, letra: 'D', nombre: 'Domingo' },
] as const;

export interface DiaEstado {
  trabaja: boolean;
  entrada: string;
  salida: string;
}
export type HorarioEstado = Record<number, DiaEstado>;
/** día -> partyId del reemplazo ('' = sin reemplazo) */
export type ReemplazosEstado = Record<number, string>;

export function horarioVacio(): HorarioEstado {
  const h: HorarioEstado = {};
  DIAS.forEach((d) => (h[d.dia] = { trabaja: false, entrada: '09:00', salida: '17:00' }));
  return h;
}

export function horarioDesdeServidor(horarios: HorarioDiaApi[]): HorarioEstado {
  const h = horarioVacio();
  horarios.forEach((x) => (h[x.dia] = { trabaja: true, entrada: x.entrada, salida: x.salida }));
  return h;
}

export function reemplazosDesdeServidor(reemplazos: ReemplazoDiaApi[]): ReemplazosEstado {
  const r: ReemplazosEstado = {};
  reemplazos.forEach((x) => (r[x.dia] = x.reemplazaPartyId));
  return r;
}

const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Horas de un turno; si la salida es menor que la entrada cruza la medianoche. */
export function horasTurno(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;
  return ((aMin(salida) - aMin(entrada) + 1440) % 1440) / 60;
}

export function totalHorasSemana(h: HorarioEstado): number {
  return DIAS.reduce((t, d) => t + (h[d.dia].trabaja ? horasTurno(h[d.dia].entrada, h[d.dia].salida) : 0), 0);
}

export function formatoHoras(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
}

export function copiarATodos(h: HorarioEstado, desde: number): HorarioEstado {
  const { entrada, salida } = h[desde];
  const nuevo: HorarioEstado = {};
  DIAS.forEach((d) => (nuevo[d.dia] = { trabaja: true, entrada, salida }));
  return nuevo;
}

export function validarHorario(h: HorarioEstado): string | null {
  for (const d of DIAS) {
    const e = h[d.dia];
    if (e.trabaja && (!e.entrada || !e.salida)) return `Completa la entrada y la salida del ${d.nombre.toLowerCase()}.`;
    if (e.trabaja && e.entrada === e.salida) return `El ${d.nombre.toLowerCase()} tiene la misma hora de entrada y de salida.`;
  }
  return null;
}

export function horariosParaEnviar(h: HorarioEstado): HorarioDiaApi[] {
  return DIAS.filter((d) => h[d.dia].trabaja).map((d) => ({
    dia: d.dia,
    entrada: h[d.dia].entrada,
    salida: h[d.dia].salida,
  }));
}

export function reemplazosParaEnviar(r: ReemplazosEstado) {
  return DIAS.filter((d) => r[d.dia]).map((d) => ({ dia: d.dia, reemplazaPartyId: r[d.dia] }));
}
