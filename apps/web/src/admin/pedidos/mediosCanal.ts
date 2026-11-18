import { useEffect, useState } from 'react';
import { ordenarMediosPresentacion } from '@caprichos/compartido';
import { api } from '../../comun/api';
import { MEDIOS_PLAN, type MedioPlan } from './planPago';

/** Canales del personal con interruptor de medios de pago. 'SIN_FILTRO' (repartidor) muestra todos. */
export type CanalPersonal = 'CAJA' | 'MOZO' | 'SIN_FILTRO';

const TODOS = ordenarMediosPresentacion(MEDIOS_PLAN.map((m) => m.id) as string[], undefined) as readonly string[];

interface MediosCanal {
  medios: readonly string[];
  presentacion: unknown;
}

/**
 * Medios encendidos del canal (Configuración › Pagos) YA en el orden configurado, más la presentación (insignias, tamaño).
 * Mientras carga o si falla la lectura se muestran todos con valores de fábrica: el servidor igual rechaza el que esté apagado.
 */
export function useMediosCanal(canal: CanalPersonal): MediosCanal {
  const [datos, setDatos] = useState<MediosCanal>({ medios: TODOS, presentacion: undefined });
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const r = await api.get<{ medios: string[]; presentacion?: unknown }>(`/admin/medios-pago/${canal}`);
        if (vigente && Array.isArray(r?.medios)) setDatos({ medios: canal === 'SIN_FILTRO' ? TODOS : r.medios, presentacion: r.presentacion });
      } catch {
        /* sin lectura: se muestran todos y el servidor decide */
      }
    })();
    return () => {
      vigente = false;
    };
  }, [canal]);
  return datos;
}

/** Solo los medios encendidos, en el orden configurado. */
export function useMediosEncendidos(canal: CanalPersonal): readonly string[] {
  return useMediosCanal(canal).medios;
}

/** Los elementos cuyo medio está encendido, en el orden de `encendidos` (el configurado). */
export function segunOrdenMedios<T>(lista: ReadonlyArray<T>, encendidos: readonly string[], id: (x: T) => string): T[] {
  return lista
    .filter((x) => encendidos.includes(id(x).toUpperCase()))
    .sort((a, b) => encendidos.indexOf(id(a).toUpperCase()) - encendidos.indexOf(id(b).toUpperCase()));
}

/** MEDIOS_PLAN sin los apagados del canal, en el orden configurado. */
export function mediosPlanEncendidos(encendidos: readonly string[]): ReadonlyArray<{ id: MedioPlan; nombre: string }> {
  return segunOrdenMedios(MEDIOS_PLAN, encendidos, (m) => m.id);
}
