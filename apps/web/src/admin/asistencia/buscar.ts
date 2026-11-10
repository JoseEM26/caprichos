/** Minúsculas, sin tildes y con espacios colapsados: «  JOSÉ  pérez » → «jose perez». */
export const normalizarBusqueda = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿El texto contiene la búsqueda (sin importar tildes, mayúsculas ni espacios de más)? */
export const coincide = (texto: string, q: string) => {
  const n = normalizarBusqueda(q);
  return !n || normalizarBusqueda(texto).includes(n);
};
