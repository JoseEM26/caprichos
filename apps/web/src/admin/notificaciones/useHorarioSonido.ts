import { useCallback, useEffect, useState } from 'react';
import { api } from '../../comun/api';

export interface HorarioSonido {
  suenaAhora: boolean;
  /** Línea para la campanita cuando el sonido está en pausa */
  texto: string | null;
}

/**
 * ¿Toca sonar ahora según el horario de trabajo? Lo decide el servidor (hora de Lima).
 * Se reevalúa cada minuto y al volver a la pestaña. Sin respuesta, suena como siempre.
 */
export function useHorarioSonido(): HorarioSonido {
  const [h, setH] = useState<HorarioSonido>({ suenaAhora: true, texto: null });

  const cargar = useCallback(async () => {
    try {
      setH(await api.get<HorarioSonido>('/admin/notificaciones/mi-horario-sonido'));
    } catch {
      // sin conexión: se conserva lo último
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 60000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(cada);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);

  return h;
}
