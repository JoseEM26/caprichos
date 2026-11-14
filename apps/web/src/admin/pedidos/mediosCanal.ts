import { useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { MEDIOS_PLAN, type MedioPlan } from './planPago';

/** Canales del personal con interruptor de medios de pago. 'SIN_FILTRO' (repartidor) muestra todos. */
export type CanalPersonal = 'CAJA' | 'MOZO' | 'SIN_FILTRO';

const TODOS = MEDIOS_PLAN.map((m) => m.id) as readonly string[];

/**
 * Medios encendidos en el canal (Configuración › Pagos), tal como los dice el servidor.
 * Mientras carga o si falla la lectura se muestran todos: el servidor igual rechaza el que esté apagado.
 */
export function useMediosEncendidos(canal: CanalPersonal): readonly string[] {
  const [medios, setMedios] = useState<readonly string[]>(TODOS);
  useEffect(() => {
    if (canal === 'SIN_FILTRO') return;
    let vigente = true;
    (async () => {
      try {
        const r = await api.get<{ medios: string[] }>(`/admin/medios-pago/${canal}`);
        if (vigente && Array.isArray(r?.medios)) setMedios(r.medios);
      } catch {
        /* sin lectura: se muestran todos y el servidor decide */
      }
    })();
    return () => {
      vigente = false;
    };
  }, [canal]);
  return canal === 'SIN_FILTRO' ? TODOS : medios;
}

/** MEDIOS_PLAN sin los apagados del canal. */
export function mediosPlanEncendidos(encendidos: readonly string[]): ReadonlyArray<{ id: MedioPlan; nombre: string }> {
  return MEDIOS_PLAN.filter((m) => encendidos.includes(m.id));
}
