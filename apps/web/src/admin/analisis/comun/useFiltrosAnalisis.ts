import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRESETS_FECHA, errorDeRango, hoyLima, rangoDePreset, type PresetFecha } from './fechas';

export type FiltroExtra = 'modalidad' | 'canal' | 'turno';

/** Filtros comunes de toda pestaña de Análisis. Los extras vacíos significan «todos». */
export interface FiltrosActivos {
  preset: PresetFecha;
  desde: string;
  hasta: string;
  modalidad: string;
  canal: string;
  turno: string;
}

/** Opciones de los filtros extra (los valores son los del servidor). */
export const OPCIONES_EXTRA: Record<FiltroExtra, { etiqueta: string; opciones: ReadonlyArray<{ id: string; nombre: string }> }> = {
  modalidad: {
    etiqueta: 'Modalidad',
    opciones: [
      { id: '', nombre: 'Todas' },
      { id: 'MESA', nombre: 'Mesa' },
      { id: 'COMER_LOCAL', nombre: 'Comer en local' },
      { id: 'RECOGER', nombre: 'Para llevar' },
      { id: 'DELIVERY', nombre: 'Delivery' },
    ],
  },
  canal: {
    etiqueta: 'Canal',
    opciones: [
      { id: '', nombre: 'Todos' },
      { id: 'CARTA', nombre: 'Carta web' },
      { id: 'CAJA', nombre: 'Caja' },
      { id: 'MOZO', nombre: 'Mozo' },
      { id: 'WHATSAPP', nombre: 'WhatsApp' },
      { id: 'BOT', nombre: 'Bot' },
    ],
  },
  turno: {
    etiqueta: 'Turno',
    opciones: [
      { id: '', nombre: 'Todos' },
      { id: 'MANANA', nombre: 'Mañana (hasta 12:00)' },
      { id: 'TARDE', nombre: 'Tarde (12:00 a 18:00)' },
      { id: 'NOCHE', nombre: 'Noche (desde 18:00)' },
    ],
  },
};

const PRESET_DEFECTO: PresetFecha = 'hoy';

/**
 * Filtros guardados en la dirección (se comparten y sobreviven a recargar). Devuelve los filtros ya resueltos,
 * el error de fechas (vacío si está bien) y `consulta()`: la cadena `?desde=…&hasta=…` lista para el API,
 * con solo los extras que esa pestaña usa.
 */
export function useFiltrosAnalisis() {
  const [params, setParams] = useSearchParams();
  const hoy = useMemo(() => hoyLima(), []);

  const presetUrl = params.get('periodo') as PresetFecha | null;
  const preset = PRESETS_FECHA.some((p) => p.id === presetUrl) ? (presetUrl as PresetFecha) : PRESET_DEFECTO;
  const { desde, hasta } = rangoDePreset(preset, hoy, params.get('desde') ?? '', params.get('hasta') ?? '');
  const filtros: FiltrosActivos = {
    preset,
    desde,
    hasta,
    modalidad: params.get('modalidad') ?? '',
    canal: params.get('canal') ?? '',
    turno: params.get('turno') ?? '',
  };
  const errorFechas = errorDeRango(desde, hasta, hoy);

  const cambiar = useCallback(
    (cambios: Record<string, string>) => {
      setParams(
        (previo) => {
          const nuevo = new URLSearchParams(previo);
          for (const [k, v] of Object.entries(cambios)) {
            if (v) nuevo.set(k, v);
            else nuevo.delete(k);
          }
          return nuevo;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filtros, errorFechas, hoy, cambiar, params };
}

/** Cadena de consulta del API para los filtros dados (solo los extras que la pestaña declara). */
export function consultaDe(filtros: FiltrosActivos, extras: readonly FiltroExtra[]): string {
  const q = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  for (const e of extras) if (filtros[e]) q.set(e, filtros[e]);
  return q.toString();
}
