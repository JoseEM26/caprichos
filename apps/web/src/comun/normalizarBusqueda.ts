/**
 * Normaliza texto para buscar: sin tildes, sin mayúsculas, sin guiones ni espacios
 * ('José' === 'jose', 'cp-w021' === 'CP W021'). Misma regla que el servidor
 * (apps/api/src/comun/normalizar-busqueda.ts).
 */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-\s]/g, '');
}

/** Búsqueda vacía: todo coincide. Si no, algún campo la contiene. */
export function coincideTexto(busqueda: string, ...campos: Array<string | null | undefined>): boolean {
  const q = normalizarBusqueda(busqueda);
  return q === '' || campos.some((c) => normalizarBusqueda(c).includes(q));
}
