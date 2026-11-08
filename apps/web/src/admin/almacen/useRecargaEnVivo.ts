import { useEffect, useRef } from 'react';
import { useSocketConectado, useTiempoReal } from '../../comun/socket';

/** Junta una ráfaga de `stock:cambio` en una sola recarga. */
export const ESPERA_STOCK_MS = 800;
/** Respaldo por si se pierde un evento: recarga cada 60 s, solo con la pestaña visible. */
export const RESPALDO_STOCK_MS = 60_000;

/**
 * Llama a `recargar` (en silencio) cuando llega `stock:cambio` (con antirrebote), al reconectar el socket,
 * al volver la pestaña al frente y cada 60 s si la pestaña está visible. Devuelve si el socket está conectado.
 */
export function useRecargaEnVivo(recargar: () => void): boolean {
  useTiempoReal(['stock:cambio'], recargar, ESPERA_STOCK_MS);
  const ultima = useRef(recargar);
  ultima.current = recargar;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ultima.current();
    }, RESPALDO_STOCK_MS);
    return () => clearInterval(t);
  }, []);
  return useSocketConectado();
}
