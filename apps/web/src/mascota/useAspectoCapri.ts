/**
 * useAspectoCapri.ts
 * Hook y caché en memoria para heredar automáticamente el aspecto resuelto de Capri desde GET /carta/mascota.
 * Evita múltiples peticiones, soporta reintentos suaves y previene parpadeos usando el aspecto base mientras carga.
 */

import { useState, useEffect } from 'react';
import { api } from '../comun/api';
import {
  type AspectoCapri,
  type RespuestaPublicaMascota,
  ASPECTO_BASE_DEFECTO,
} from './tiposAspecto';
import { sanitizarAspecto } from './aspectoUtils';

export interface AspectoHeredado {
  aspecto: AspectoCapri;
  tema: string;
  cargando: boolean;
}

interface CacheAspecto {
  tema: string;
  aspecto: AspectoCapri;
}

let cacheGlobal: CacheAspecto | null = null;
let promesaEnVuelo: Promise<CacheAspecto> | null = null;
const suscriptores = new Set<(datos: CacheAspecto) => void>();

function notificarSuscriptores(datos: CacheAspecto) {
  suscriptores.forEach((fn) => {
    try {
      fn(datos);
    } catch {
      // Ignorar errores de suscriptores desmontados
    }
  });
}

/**
 * Consulta el endpoint público GET /carta/mascota una sola vez con caché en memoria
 * y reintento suave ante fallos de red.
 */
export async function cargarAspectoPublico(): Promise<CacheAspecto> {
  if (cacheGlobal) {
    return cacheGlobal;
  }

  if (promesaEnVuelo) {
    return promesaEnVuelo;
  }

  promesaEnVuelo = (async () => {
    const intentar = async (): Promise<RespuestaPublicaMascota> => {
      return await api.get<RespuestaPublicaMascota>('/carta/mascota');
    };

    try {
      let respuesta: RespuestaPublicaMascota;
      try {
        respuesta = await intentar();
      } catch {
        // Reintento suave después de 500ms
        await new Promise((r) => setTimeout(r, 500));
        respuesta = await intentar();
      }

      const resuelto: CacheAspecto = {
        tema: respuesta?.tema || 'normal',
        aspecto: sanitizarAspecto(respuesta?.aspecto),
      };

      cacheGlobal = resuelto;
      notificarSuscriptores(resuelto);
      return resuelto;
    } catch {
      // Fallback seguro al diseño por defecto
      const fallback: CacheAspecto = {
        tema: 'normal',
        aspecto: { ...ASPECTO_BASE_DEFECTO },
      };
      cacheGlobal = fallback;
      notificarSuscriptores(fallback);
      return fallback;
    } finally {
      promesaEnVuelo = null;
    }
  })();

  return promesaEnVuelo;
}

/**
 * Hook para obtener el aspecto global de Capri.
 * Comienza de inmediato con el diseño por defecto (o caché si ya existe) para evitar parpadeos,
 * y se actualiza suavemente cuando llega la respuesta del servidor.
 */
export function useAspectoCapri(): AspectoHeredado {
  const [datos, setDatos] = useState<CacheAspecto>(() => {
    return (
      cacheGlobal || {
        tema: 'normal',
        aspecto: { ...ASPECTO_BASE_DEFECTO },
      }
    );
  });
  const [cargando, setCargando] = useState<boolean>(!cacheGlobal);

  useEffect(() => {
    let cancelado = false;

    const suscriptor = (nuevosDatos: CacheAspecto) => {
      if (!cancelado) {
        setDatos(nuevosDatos);
        setCargando(false);
      }
    };

    suscriptores.add(suscriptor);

    if (!cacheGlobal) {
      cargarAspectoPublico().then((res) => {
        if (!cancelado) {
          setDatos(res);
          setCargando(false);
        }
      });
    } else {
      setCargando(false);
    }

    return () => {
      cancelado = true;
      suscriptores.delete(suscriptor);
    };
  }, []);

  return {
    aspecto: datos.aspecto,
    tema: datos.tema,
    cargando,
  };
}

/**
 * Función para reiniciar la caché en memoria (útil para pruebas y tras guardar en el admin).
 */
export function limpiarCacheAspecto(): void {
  cacheGlobal = null;
  promesaEnVuelo = null;
}

/**
 * Función para forzar o pre-establecer el aspecto en caché (útil para pruebas unitarias).
 */
export function preestablecerAspectoCache(datos: CacheAspecto): void {
  cacheGlobal = {
    tema: datos.tema,
    aspecto: sanitizarAspecto(datos.aspecto),
  };
  notificarSuscriptores(cacheGlobal);
}
