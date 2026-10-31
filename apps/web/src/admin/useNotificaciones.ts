import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../comun/api';
import { useEventos } from '../comun/socket';
import { marcarNotificacion } from './notificaciones/notificacionesApi';
import { ordenarNotificaciones } from './notificaciones/notificacionesTipos';
import type { NotificacionPendiente } from './notificaciones/notificacionesTipos';

/** Un aviso tal como lo devuelve el servidor (guardado o calculado), con su lectura de este usuario. */
export type NotificacionAdmin = NotificacionPendiente;

export interface ResumenNotificaciones {
  conteos: Record<string, number>;
  notificaciones: NotificacionAdmin[];
}

export interface ResumenNotificacionesVivo extends ResumenNotificaciones {
  /** true cuando ya llegó la primera respuesta (sirve para no mostrar como nuevo lo que ya estaba) */
  cargado: boolean;
  /** Vuelve a pedir el resumen (tras marcar leído, por ejemplo) */
  refrescar: () => Promise<void>;
  /** Marca leído o no leído para este usuario; cambia al instante y luego confirma con el servidor */
  marcar: (clave: string, leida: boolean) => Promise<boolean>;
}

const VACIO: ResumenNotificaciones = { conteos: {}, notificaciones: [] };

/** Lo pendiente para la campanita, el sonido y las insignias del menú: se refresca solo y con los eventos en vivo. */
export function useNotificaciones(): ResumenNotificacionesVivo {
  const [resumen, setResumen] = useState<ResumenNotificaciones>(VACIO);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<ResumenNotificaciones>('/admin/notificaciones');
      setResumen(r);
      setCargado(true);
    } catch {
      // sin conexión o sin permiso: se conserva lo último que se vio
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 30000);
    return () => clearInterval(cada);
  }, [cargar]);

  useEventos('pedido:estado', cargar);
  useEventos('pedido:nuevo', cargar);
  useEventos('stock:cambio', cargar);
  useEventos('reserva:solicitud_nueva', cargar);
  useEventos('reserva:cambio', cargar);
  useEventos('notificaciones:nueva', cargar);
  useEventos('notificaciones:actualizada', cargar);

  const marcar = useCallback(
    async (clave: string, leida: boolean): Promise<boolean> => {
      const ahoraIso = new Date().toISOString();
      // cambio inmediato: el sonido se calla y el aviso baja al final sin esperar la red
      setResumen((r) => ({
        ...r,
        notificaciones: ordenarNotificaciones(
          r.notificaciones.map((n) => (n.clave === clave ? { ...n, leida, leidaEn: leida ? ahoraIso : null } : n)),
        ),
      }));
      try {
        await marcarNotificacion(clave, leida);
        await cargar();
        return true;
      } catch {
        await cargar();
        return false;
      }
    },
    [cargar],
  );

  return useMemo(() => ({ ...resumen, cargado, refrescar: cargar, marcar }), [resumen, cargado, cargar, marcar]);
}
