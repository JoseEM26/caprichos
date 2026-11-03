/**
 * Quién recibe un aviso del equipo por correo, según el horario de trabajo.
 * Funciones puras (sin base de datos): el servicio carga los datos y aquí se decide.
 */

export interface VentanaDia {
  /** 0 = Domingo */
  dia: number;
  /** Minutos desde medianoche (hora de Lima). */
  entrada: number;
  salida: number;
}

export interface FijoDia {
  dia: number;
  reemplazaId: string;
}

export interface PersonaTurno {
  partyId: string;
  /** Casilla «Recibir avisos del sistema por correo». */
  conCasilla: boolean;
  /** Horario 24/7: recibe si nadie con casilla está de turno. */
  h247: boolean;
  horarios: VentanaDia[];
  /** Reemplazo fijo por día (aplica cuando la persona no trabaja ese día). */
  fijos: FijoDia[];
}

export interface CoberturaDia {
  /** Quien entra a cubrir. */
  cubreId: string;
  /** A quien cubre (null = sin titular definido). */
  reemplazaId: string | null;
  desde: number;
  hasta: number;
}

export interface MomentoLima {
  /** AAAA-MM-DD */
  fecha: string;
  dia: number;
  minuto: number;
}

/** Hora y día en Lima (el local no cambia de horario). */
export function momentoLima(ahora: Date): MomentoLima {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return { fecha, dia: new Date(`${fecha}T12:00:00Z`).getUTCDay(), minuto: hora * 60 + minuto };
}

/** Minutos desde medianoche de una columna TIME (guardada como 1970-01-01 HH:MM en UTC). */
export function minutosDeHora(hora: Date): number {
  return hora.getUTCHours() * 60 + hora.getUTCMinutes();
}

/** Ventana [desde, hasta). Si hasta es menor que desde, el turno cruza la medianoche. */
export function enVentana(minuto: number, desde: number, hasta: number): boolean {
  return desde <= hasta ? minuto >= desde && minuto < hasta : minuto >= desde || minuto < hasta;
}

/**
 * Reglas:
 * 1. De turno = con casilla y trabajando ahora (horario del día), salvo que una cobertura de hoy la reemplace.
 * 2. Quien cubre en este momento (cobertura por fecha) también recibe.
 * 3. Si la persona no trabaja hoy y tiene reemplazo fijo, quien la reemplaza recibe.
 * 4. Si nadie con casilla está de turno, reciben los de horario 24/7 con casilla.
 * 5. Si tampoco hay nadie, devuelve [] (el aviso solo queda registrado).
 */
export function elegirDestinatarios(momento: MomentoLima, personas: PersonaTurno[], coberturas: CoberturaDia[]): string[] {
  const { dia, minuto } = momento;
  const activas = coberturas.filter((c) => enVentana(minuto, c.desde, c.hasta));
  const reemplazadas = new Set(activas.map((c) => c.reemplazaId).filter((id): id is string => !!id));

  const deTurno = new Set<string>();
  for (const p of personas) {
    const trabajaAhora = p.horarios.some((h) => h.dia === dia && enVentana(minuto, h.entrada, h.salida));
    if (trabajaAhora && !reemplazadas.has(p.partyId)) deTurno.add(p.partyId);

    const trabajaHoy = p.horarios.some((h) => h.dia === dia);
    const fijo = p.fijos.find((f) => f.dia === dia);
    if (!trabajaHoy && fijo) deTurno.add(fijo.reemplazaId);
  }
  for (const c of activas) deTurno.add(c.cubreId);

  const conCasilla = new Set(personas.filter((p) => p.conCasilla).map((p) => p.partyId));
  const enTurno = [...deTurno].filter((id) => conCasilla.has(id));
  if (enTurno.length > 0) return enTurno;

  return personas.filter((p) => p.conCasilla && p.h247).map((p) => p.partyId);
}
