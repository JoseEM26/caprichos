/**
 * Clave del conjunto de pedidos activos del mapa de repartos y del filtro de zona.
 * El mapa solo se reajusta (zoom a todos los pedidos + sede) cuando esta clave cambia o se pulsa «Ver todos los pedidos».
 * No depende del orden de los pedidos ni de que el array se haya vuelto a crear en cada sondeo.
 */
export function claveConjuntoMapa(ids: string[], zona?: string): string {
  return `${zona ?? ''}|${[...ids].sort().join(',')}`;
}
