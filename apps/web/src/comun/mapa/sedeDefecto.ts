import { api } from '../api';
import type { PuntoLocal } from './MapaUbicacion';

/** Sede de Caprichos por defecto: la que usa la carta mientras no llegan los datos de /carta/local */
export const SEDE_DEFECTO: PuntoLocal = {
  lat: -12.0196436,
  lng: -76.963255,
  nombre: 'Caprichos',
  direccion: 'Av. Principal 123',
};

interface DatosSedeRespuesta {
  lat?: number;
  lng?: number;
  nombre?: string;
  direccion?: string;
}

/** Datos de la sede desde GET /carta/local. Nunca falla: si no responde, usa SEDE_DEFECTO. */
export async function cargarSede(): Promise<PuntoLocal> {
  try {
    const d = await api.get<DatosSedeRespuesta>('/carta/local');
    return {
      lat: d?.lat ?? SEDE_DEFECTO.lat,
      lng: d?.lng ?? SEDE_DEFECTO.lng,
      nombre: d?.nombre ?? SEDE_DEFECTO.nombre,
      direccion: d?.direccion ?? SEDE_DEFECTO.direccion,
    };
  } catch {
    return SEDE_DEFECTO;
  }
}
