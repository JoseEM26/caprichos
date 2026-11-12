import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../comun/api';
import { useTiempoReal } from '../../../comun/socket';

export type EstadoConsulta = 'cargando' | 'ok' | 'error';

export interface OpcionesConsulta {
  /** Refresco automático en ms (por ejemplo 30000 para datos en vivo). Sin valor: solo al cambiar la ruta. */
  cadaMs?: number;
  /** Eventos de socket que fuerzan recargar (con antirrebote). */
  eventos?: readonly string[];
  /** false = no consulta (por ejemplo, fechas inválidas). */
  activo?: boolean;
}

/**
 * GET con estados cargando/ok/error, que ignora respuestas viejas (si cambian los filtros a mitad de camino)
 * y conserva los datos anteriores mientras recarga en segundo plano. `recargar()` fuerza una consulta nueva.
 */
export function useConsultaAnalisis<T>(ruta: string, { cadaMs, eventos = [], activo = true }: OpcionesConsulta = {}) {
  const [datos, setDatos] = useState<T | null>(null);
  const [estado, setEstado] = useState<EstadoConsulta>('cargando');
  const [mensaje, setMensaje] = useState('');
  const numero = useRef(0);

  const cargar = useCallback(
    (silencioso: boolean) => {
      if (!activo) return;
      const mio = ++numero.current;
      if (!silencioso) setEstado('cargando');
      api
        .get<T>(ruta)
        .then((r) => {
          if (mio !== numero.current) return;
          setDatos(r);
          setEstado('ok');
        })
        .catch((e: unknown) => {
          if (mio !== numero.current) return;
          // un fallo de refresco en segundo plano no borra lo que ya se ve
          if (silencioso && datos) return;
          setMensaje(e instanceof Error ? e.message : '');
          setEstado('error');
        });
    },
    // `datos` solo se lee para decidir si se muestra el error; no debe reiniciar la consulta
    [ruta, activo],
  );

  useEffect(() => {
    cargar(false);
    return () => {
      numero.current++;
    };
  }, [cargar]);

  useEffect(() => {
    if (!cadaMs || !activo) return undefined;
    const t = setInterval(() => cargar(true), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs, activo, cargar]);

  useTiempoReal(eventos, () => cargar(true));

  return { datos, estado, mensaje, recargar: () => cargar(false) };
}
