import type { OpcionesReserva } from './reservasCartaApi';

const ZONA = 'America/Lima';

/** Fecha (YYYY-MM-DD) y minutos del día ahora mismo en Lima, sin depender de la zona del celular. */
export function ahoraLima(ahora: Date = new Date()): { fechaIso: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '00';
  return {
    fechaIso: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
  };
}

/** Suma días a una fecha YYYY-MM-DD (calendario, sin hora). */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado de una fecha YYYY-MM-DD. */
export function diaSemanaIso(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** «jue 7» para los chips de día. */
export function diaYNumero(iso: string): string {
  const txt = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(/\./g, '')
    .replace(',', '');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** «jue 7 nov» para el resumen. */
export function fechaLegible(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(/\./g, '')
    .replace(',', '');
}

/** «19:30» → «7:30 pm». */
export function horaLegible(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const sufijo = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

export const minutosDeHora = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

const aHora = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Horas cada 30 minutos desde «abre» hasta «cierra», incluidas (igual que validarHorarioAtencion). */
export function horasDelDia(abre: string, cierra: string): string[] {
  const horas: string[] = [];
  for (let t = minutosDeHora(abre); t <= minutosDeHora(cierra); t += 30) horas.push(aHora(t));
  return horas;
}

/** Horario de atención de una fecha, o null si ese día no se atiende. */
export function horarioDelDia(iso: string, op: OpcionesReserva): { abre: string; cierra: string } | null {
  if (op.fechasCerradas.includes(iso)) return null;
  const especial = op.fechasEspeciales.find((f) => f.fecha === iso);
  if (especial) return { abre: especial.abre, cierra: especial.cierra };
  const regular = op.horarios.find((h) => h.dia === diaSemanaIso(iso));
  return regular ? { abre: regular.abre, cierra: regular.cierra } : null;
}

/** Hora ya pasada si la fecha es hoy y la hora no es posterior al momento actual. */
export function horaPasada(fecha: string, hora: string, ahora: Date = new Date()): boolean {
  const lima = ahoraLima(ahora);
  return fecha === lima.fechaIso && minutosDeHora(hora) <= lima.minutos;
}

/** Celular peruano de 9 dígitos que empieza con 9 (acepta +51 o 51 delante). Devuelve null si no es válido. */
export function celularValido(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, '');
  if (digitos.length === 11 && digitos.startsWith('51')) digitos = digitos.slice(2);
  return /^9\d{8}$/.test(digitos) ? digitos : null;
}
