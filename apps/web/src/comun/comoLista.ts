/**
 * Devuelve siempre un array. Evita "x.map is not a function" cuando una respuesta
 * llega como objeto ({ items: [...] }) o vacía ({}) en vez de como lista.
 */
export function comoLista<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  const items = (x as { items?: unknown } | null | undefined)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}
