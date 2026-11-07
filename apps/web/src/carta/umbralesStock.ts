import { useEffect, useSyncExternalStore } from 'react';
import { UMBRALES_AVISO_STOCK_DEFECTO, umbralesAvisoStock, type UmbralesAvisoStock } from '@caprichos/compartido';
import { api } from '../comun/api';

/**
 * Umbrales de los avisos «Quedan N» / «¡Últimas!» (Configuración). La carta los recibe en /carta/local;
 * mientras no lleguen valen 5 y 3. Un solo valor para toda la página: los componentes se suscriben.
 */
let actuales: UmbralesAvisoStock = UMBRALES_AVISO_STOCK_DEFECTO;
let cargado = false;
const oyentes = new Set<() => void>();

export function fijarUmbralesStock(valor?: { quedan?: unknown; ultimas?: unknown } | null): void {
  const nuevo = umbralesAvisoStock(valor?.quedan, valor?.ultimas);
  cargado = true;
  if (nuevo.quedan === actuales.quedan && nuevo.ultimas === actuales.ultimas) return;
  actuales = nuevo;
  oyentes.forEach((o) => o());
}

export const umbralesStockActuales = (): UmbralesAvisoStock => actuales;

/** Para pruebas: vuelve a los valores por defecto y a «sin cargar». */
export function reiniciarUmbralesStock(): void {
  actuales = UMBRALES_AVISO_STOCK_DEFECTO;
  cargado = false;
  oyentes.forEach((o) => o());
}

/**
 * Umbrales vigentes. Con `cargarSiFalta` (admin, que no pasa por la carta) los pide una vez a /carta/local.
 */
export function useUmbralesStock(cargarSiFalta = false): UmbralesAvisoStock {
  useEffect(() => {
    if (!cargarSiFalta || cargado) return;
    cargado = true;
    // Promise.resolve: tolera una respuesta no prometida (p. ej. un simulacro de `api` en pruebas) sin romper la ventana
    Promise.resolve(api.get<{ avisoStock?: { quedan?: unknown; ultimas?: unknown } }>('/carta/local'))
      .then((d) => fijarUmbralesStock(d?.avisoStock))
      .catch(() => undefined);
  }, [cargarSiFalta]);
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    umbralesStockActuales,
    umbralesStockActuales,
  );
}
