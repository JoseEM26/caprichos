/** Alérgenos fijos (códigos). Los demás se guardan como texto libre en minúsculas. */
export const ALERGENOS_FIJOS = ['MANI', 'NUECES', 'LACTEOS', 'GLUTEN', 'HUEVO', 'SOYA', 'MARISCOS', 'SESAMO'] as const;

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Normaliza la lista: trim, espacios colapsados, minúsculas; «Maní»/«mani» pasa al código MANI;
 * deduplica sin distinguir tildes ni mayúsculas. Lo que no es texto se deja tal cual para que la validación lo rechace.
 */
export function normalizarAlergenos<T>(lista: T): T {
  if (!Array.isArray(lista)) return lista;
  const vistos = new Set<string>();
  const salida: unknown[] = [];
  for (const v of lista) {
    if (typeof v !== 'string') { salida.push(v); continue; }
    const texto = v.trim().replace(/\s+/g, ' ').toLowerCase();
    const clave = sinTildes(texto);
    const codigo = ALERGENOS_FIJOS.find((c) => c.toLowerCase() === clave);
    const final = codigo ?? texto;
    const k = codigo ?? clave;
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(final);
  }
  return salida as unknown as T;
}
