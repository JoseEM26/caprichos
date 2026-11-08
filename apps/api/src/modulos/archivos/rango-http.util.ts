/**
 * Interpreta la cabecera Range (solo un rango «bytes=a-b», «bytes=a-» o «bytes=-n»).
 * Devuelve null si no hay cabecera o no se entiende (se sirve el archivo completo) y 'invalido' si queda fuera del archivo (416).
 */
export function interpretarRango(cabecera: string | undefined, total: number): { inicio: number; fin: number } | 'invalido' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec((cabecera ?? '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let inicio: number;
  let fin: number;
  if (m[1] === '') {
    const n = Number(m[2]);
    inicio = Math.max(total - n, 0);
    fin = total - 1;
  } else {
    inicio = Number(m[1]);
    fin = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (total <= 0 || inicio >= total || inicio > fin) return 'invalido';
  return { inicio, fin };
}
