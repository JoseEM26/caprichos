import { useCallback, useRef, useState } from 'react';
import { ErrorApi } from './api';

export type EstadoSubida = 'inactivo' | 'subiendo' | 'listo' | 'error';

const MENSAJE_RED = 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.';

/**
 * Estado de una subida de imagen. `ejecutar` corre la operación completa (subir al servidor y guardar);
 * «listo» solo llega cuando la operación resolvió, o sea, cuando el servidor respondió OK.
 * Mientras corre, no admite un segundo envío. `reintentar` repite la última operación.
 */
export function useSubidaArchivo<T = void>() {
  const [estado, setEstado] = useState<EstadoSubida>('inactivo');
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  const ultima = useRef<(() => Promise<T>) | null>(null);

  const ejecutar = useCallback(async (operacion: () => Promise<T>): Promise<T | undefined> => {
    if (enCurso.current) return undefined;
    enCurso.current = true;
    ultima.current = operacion;
    setError(null);
    setEstado('subiendo');
    try {
      const res = await operacion();
      setEstado('listo');
      return res;
    } catch (err) {
      setError(err instanceof ErrorApi && err.message ? err.message : MENSAJE_RED);
      setEstado('error');
      return undefined;
    } finally {
      enCurso.current = false;
    }
  }, []);

  const reintentar = useCallback(() => (ultima.current ? ejecutar(ultima.current) : undefined), [ejecutar]);

  const reiniciar = useCallback(() => {
    setError(null);
    setEstado('inactivo');
  }, []);

  return { estado, error, subiendo: estado === 'subiendo', ejecutar, reintentar, reiniciar };
}
