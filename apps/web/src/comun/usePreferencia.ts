import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Preferencias personales (por usuario, en el servidor) con respaldo en este equipo si el servidor falla. */
export const preferenciasApi = {
  obtener: (clave: string) => api.get<{ clave: string; valor: unknown }>(`/admin/preferencias/${clave}`),
  guardar: (clave: string, valor: unknown) => api.put<{ clave: string; valor: unknown }>(`/admin/preferencias/${clave}`, { valor }),
};


const leerLocal = (clave: string): unknown => {
  try {
    const t = window.localStorage.getItem(`caprichos.${clave}`);
    return t == null ? undefined : JSON.parse(t);
  } catch {
    return undefined;
  }
};
const escribirLocal = (clave: string, valor: unknown) => {
  try {
    window.localStorage.setItem(`caprichos.${clave}`, JSON.stringify(valor));
  } catch {
    // sin almacenamiento: solo vale en esta sesión
  }
};

/**
 * Valor de una preferencia: arranca con lo guardado en este equipo, se corrige con lo del servidor al cargar
 * (si el usuario aún no lo tocó en esta sesión) y cada cambio se guarda en ambos sitios.
 * `normalizar` deja pasar solo valores válidos.
 */
export function usePreferencia<T>(clave: string, defecto: T, normalizar: (v: unknown) => T): [T, (v: T) => void] {
  const [valor, setValorEstado] = useState<T>(() => {
    const local = leerLocal(clave);
    return local === undefined ? defecto : normalizar(local);
  });
  const tocado = useRef(false);

  useEffect(() => {
    let vivo = true;
    preferenciasApi
      .obtener(clave)
      .then((r) => {
        if (!vivo || tocado.current || r?.valor == null) return;
        const v = normalizar(r.valor);
        setValorEstado(v);
        escribirLocal(clave, v);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // normalizar es una función pura estable del llamador
     
  }, [clave]);

  const setValor = useCallback(
    (v: T) => {
      tocado.current = true;
      setValorEstado(v);
      escribirLocal(clave, v);
      try {
        void Promise.resolve(preferenciasApi.guardar(clave, v)).catch(() => {});
      } catch {
        // sin servidor: queda el respaldo de este equipo
      }
    },
    [clave],
  );
  return [valor, setValor];
}
