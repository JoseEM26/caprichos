import type { Pedido } from './pedidosApi';

/** Sentido de la lista de Caja: «menos» = los recién llegados arriba (así llega del servidor, creado_en desc); «mas» = los más atrasados arriba. */
export type OrdenTiempo = 'menos' | 'mas';
export const ORDEN_POR_DEFECTO: OrdenTiempo = 'menos';
const CLAVE = 'caja.ordenTiempo';

export const TEXTO_ORDEN: Record<OrdenTiempo, string> = {
  mas: 'Más tiempo primero (los más atrasados arriba)',
  menos: 'Menos tiempo primero (los recién llegados arriba)',
};

const valido = (v: unknown): v is OrdenTiempo => v === 'mas' || v === 'menos';

/** La URL (?orden=mas|menos) manda; luego lo recordado en este navegador; luego el defecto. Nunca lanza. */
export function ordenInicial(search: string = typeof window === 'undefined' ? '' : window.location.search): OrdenTiempo {
  const url = new URLSearchParams(search).get('orden');
  if (valido(url)) return url;
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (valido(guardado)) return guardado;
  } catch {
    // Sin almacenamiento: vale el defecto
  }
  return ORDEN_POR_DEFECTO;
}

export function recordarOrden(o: OrdenTiempo): void {
  try {
    localStorage.setItem(CLAVE, o);
  } catch {
    // Sin almacenamiento: la elección vale solo para esta visita
  }
}

/**
 * El tiempo es el de la pastilla de espera: se mide desde creado_en (también en cerrados), así que el orden no depende del reloj
 * y no salta cada 30 s. «menos» conserva el orden del servidor; «mas» ordena por creado_en ascendente y empata por código.
 */
export function ordenarPorTiempo(lista: Pedido[], orden: OrdenTiempo): Pedido[] {
  if (orden === 'menos') return lista;
  const ms = (p: Pedido) => (p.creado_en ? new Date(p.creado_en).getTime() : 0);
  return [...lista].sort((a, b) => ms(a) - ms(b) || String(a.codigo || '').localeCompare(String(b.codigo || '')));
}
