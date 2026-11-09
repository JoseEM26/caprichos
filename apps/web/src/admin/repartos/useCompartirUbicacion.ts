import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../comun/api';

export type EstadoUbicacion = 'inactiva' | 'compartiendo' | 'apagada' | 'denegada' | 'sin_gps';

/** Sin moverse más de 15 m solo se reenvía cada 60 s; moviéndose, como mínimo cada 10 s. */
export const MIN_METROS = 15;
export const MIN_MOVIENDO_MS = 10_000;
export const LATIDO_MS = 60_000;
const REVISION_MS = 5_000;

export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Comparte la posición del repartidor con el local SOLO mientras `hayEnCamino` y quiera compartir.
 * Si el navegador niega el permiso la app sigue igual; solo queda en «denegada».
 */
export function useCompartirUbicacion(hayEnCamino: boolean) {
  const [quiere, setQuiere] = useState(true);
  const [denegada, setDenegada] = useState(false);
  const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
  const activo = hayEnCamino && quiere && !!geo && !denegada;

  const ultimaFix = useRef<{ lat: number; lng: number; precision: number; rumbo?: number; velocidad?: number } | null>(null);
  const ultimoEnvio = useRef<{ lat: number; lng: number; en: number } | null>(null);

  const intentarEnviar = useCallback(() => {
    const fix = ultimaFix.current;
    if (!fix) return;
    const ahora = Date.now();
    const ult = ultimoEnvio.current;
    const toca =
      !ult ||
      ahora - ult.en >= LATIDO_MS ||
      (distanciaMetros(ult, fix) > MIN_METROS && ahora - ult.en >= MIN_MOVIENDO_MS);
    if (!toca) return;
    ultimoEnvio.current = { lat: fix.lat, lng: fix.lng, en: ahora };
    // El envío es de mejor esfuerzo: un fallo no molesta al repartidor
    api.post('/admin/repartos/ubicacion', fix).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activo || !geo) return;
    const id = geo.watchPosition(
      (p) => {
        ultimaFix.current = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: Math.min(Math.round(p.coords.accuracy ?? 0), 200),
          ...(p.coords.heading != null && !Number.isNaN(p.coords.heading) ? { rumbo: Math.round(p.coords.heading) } : {}),
          ...(p.coords.speed != null && !Number.isNaN(p.coords.speed) ? { velocidad: Math.max(0, p.coords.speed) } : {}),
        };
        intentarEnviar();
      },
      (e) => {
        if (e.code === 1) setDenegada(true);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    const latido = setInterval(intentarEnviar, REVISION_MS);
    return () => {
      geo.clearWatch(id);
      clearInterval(latido);
      ultimaFix.current = null;
      ultimoEnvio.current = null;
    };
  }, [activo, geo, intentarEnviar]);

  const estado: EstadoUbicacion = !hayEnCamino
    ? 'inactiva'
    : !geo
      ? 'sin_gps'
      : denegada
        ? 'denegada'
        : quiere
          ? 'compartiendo'
          : 'apagada';

  return {
    estado,
    alternar: () => {
      setDenegada(false);
      setQuiere((q) => !q);
    },
  };
}
