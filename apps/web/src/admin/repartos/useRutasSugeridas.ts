import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventos } from '../../comun/socket';
import { repartosApi, RespuestaRutasSugeridas } from './repartosApi';

const REFRESCO_MS = 30_000;

/**
 * Opciones de ruta calculadas por el servidor: se refrescan con 'reparto:rutas', cada 30 s y cuando
 * la vista llama a `recargar` desde su propio manejo de 'pedido:estado'.
 */
export function useRutasSugeridas(activo = true) {
  const [datos, setDatos] = useState<RespuestaRutasSugeridas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  const recargar = useCallback(async () => {
    if (!activo) return;
    try {
      const res = await repartosApi.listarRutasSugeridas();
      if (!vivo.current) return;
      setDatos({ opciones: res?.opciones ?? [], sinUbicacion: res?.sinUbicacion ?? [], cupo: res?.cupo ?? 0 });
      setError(null);
    } catch (err: any) {
      if (vivo.current) setError(err?.message || 'No se pudieron cargar las rutas sugeridas');
    } finally {
      if (vivo.current) setCargando(false);
    }
  }, [activo]);

  useEffect(() => {
    vivo.current = true;
    recargar();
    const t = setInterval(recargar, REFRESCO_MS);
    return () => {
      vivo.current = false;
      clearInterval(t);
    };
  }, [recargar]);

  useEventos('reparto:rutas', recargar);

  return { datos, cargando, error, recargar };
}
