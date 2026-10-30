import { useCallback, useEffect, useState } from 'react';
import type { EstadoMaquinaImpresion, RolImpresora } from '@caprichos/compartido';
import { impresionApi } from './impresionApi';
import { useEventos } from '../../comun/socket';

export type MaquinasImpresion = Record<RolImpresora, EstadoMaquinaImpresion>;

export const NOMBRE_MAQUINA: Record<RolImpresora, string> = { ETIQUETERA: 'Etiquetera', TICKETERA: 'Ticketera' };

/** Máquinas que no están bien conectadas (vacío = todo listo). */
export function maquinasConProblema(m: MaquinasImpresion | null | undefined): RolImpresora[] {
  if (!m) return [];
  return (['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).filter((r) => !m[r]?.conectada);
}

/** El programa del local no corre: hay que instalarlo o abrirlo. */
export const programaApagado = (m: MaquinasImpresion | null | undefined) =>
  Boolean(m && m.ETIQUETERA?.estado === 'sin_programa');

/**
 * Estado de las dos máquinas: se revisa al entrar, cada 20 s y en vivo (`impresion:estado`).
 * Solo el programa del local puede ver las impresoras USB; el navegador no.
 */
export function useEstadoMaquinas() {
  const [maquinas, setMaquinas] = useState<MaquinasImpresion | null>(null);
  const [pendientes, setPendientes] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const e = await impresionApi.obtenerEstado();
      setMaquinas((e.impresoras as MaquinasImpresion) ?? null);
      setPendientes(e.pendientes ?? 0);
    } catch {
      setMaquinas(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 20000);
    return () => clearInterval(cada);
  }, [cargar]);

  useEventos('impresion:estado', cargar);
  useEventos('impresion:cola', cargar);

  return { maquinas, pendientes, recargar: cargar };
}
