/** Fechas del chat de Mensajes: siempre en hora de Lima y en español. `ahora` se puede pasar para probar. */
const ZONA = 'America/Lima';

const partes = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, ...opts })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** Día calendario de Lima como «2026-11-03». */
export function diaLima(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86400000);

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const sinPunto = (t: string) => t.replace('.', '');

/** «15:37» */
export function horaDeChat(iso: string): string {
  const p = partes(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.hour}:${p.minute}`;
}

/** «3 nov 2026, 15:37»: para el title y el aria-label de cada burbuja. */
export function fechaCompletaChat(iso: string): string {
  const d = new Date(iso);
  const p = partes(d, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${p.day} ${sinPunto(p.month)} ${p.year}, ${horaDeChat(iso)}`;
}

/** Separador de día: «Hoy», «Ayer», «Lunes 3 de noviembre» o «3 nov 2026» si es de otro año. */
export function etiquetaDia(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const dif = diasEntre(diaLima(d), diaLima(ahora));
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  const p = partes(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (p.year !== partes(ahora, { year: 'numeric' }).year) {
    const c = partes(d, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${c.day} ${sinPunto(c.month)} ${c.year}`;
  }
  return `${mayuscula(p.weekday)} ${p.day} de ${p.month}`;
}

/** Hora del último mensaje en la lista: hora si es de hoy, «Ayer», día de la semana (últimos 6 días) o «03/11/26». */
export function horaListaChat(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  const dif = diasEntre(diaLima(d), diaLima(ahora));
  if (dif <= 0) return horaDeChat(iso);
  if (dif === 1) return 'Ayer';
  if (dif < 7) return mayuscula(partes(d, { weekday: 'long' }).weekday);
  const p = partes(d, { day: '2-digit', month: '2-digit', year: '2-digit' });
  return `${p.day}/${p.month}/${p.year}`;
}
