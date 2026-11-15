/** Reglas puras anti-bloqueo de WhatsApp no oficial. Todo parametrizable desde quien las llama. */

export const SALUDOS_VARIADOS = ['Hola', 'Buenas', 'Buen día', 'Qué gusto saludarte', 'Saludos'];

/** Hora (0-23) en Lima. */
export const horaLima = (d: Date): number => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d)) % 24;

/** true si la hora de Lima cae en [desde, hasta). */
export const dentroDeHorario = (d: Date, desde: number, hasta: number): boolean => {
  const h = horaLima(d);
  return desde <= hasta ? h >= desde && h < hasta : h >= desde || h < hasta;
};

/** Pausa aleatoria entre envíos, en ms, entre minSeg y maxSeg. `azar` (0-1) se inyecta para probar. */
export const pausaAleatoriaMs = (minSeg: number, maxSeg: number, azar = Math.random()): number => {
  const a = Math.max(0, Math.min(minSeg, maxSeg));
  const b = Math.max(a, maxSeg);
  return Math.round((a + (b - a) * azar) * 1000);
};

/** Tiempo de «escribiendo…» proporcional al largo, con piso de 1 s y techo de 8 s. */
export const escribiendoMs = (texto: string, msPorCaracter: number): number =>
  Math.max(1000, Math.min(8000, Math.round((texto?.length ?? 0) * Math.max(0, msPorCaracter))));

const RE_URL = /https?:\/\/[^\s]+/gi;

/** Deja como mucho `max` enlaces; los demás se reemplazan por un aviso para no parecer spam. */
export function limitarEnlaces(texto: string, max: number): string {
  let visto = 0;
  return texto.replace(RE_URL, (u) => (++visto <= max ? u : '(enlace omitido)'));
}

/** Cambia el saludo inicial según `variante` para que un mismo texto no salga idéntico a muchos. */
export function variarSaludo(texto: string, variante: number): string {
  const saludo = SALUDOS_VARIADOS[Math.abs(variante) % SALUDOS_VARIADOS.length];
  const m = /^[¡!]?\s*(hola|buenas(?: tardes| noches)?|buen d[ií]a)\b[,!.]*\s*/i.exec(texto);
  return m ? `${saludo}, ${texto.slice(m[0].length)}` : texto;
}
