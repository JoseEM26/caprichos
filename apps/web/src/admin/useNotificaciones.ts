import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../comun/api';
import { useEventos } from '../comun/socket';

export interface NotificacionAdmin {
  id: string;
  titulo: string;
  detalle: string;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  desde: string | null;
  modulo: string;
  accion: string;
  ruta?: string;
  /** true si es un aviso guardado (se puede marcar leído); las calculadas al vuelo no */
  marcable?: boolean;
}

export interface ResumenNotificaciones {
  conteos: Record<string, number>;
  notificaciones: NotificacionAdmin[];
}

export interface ResumenNotificacionesVivo extends ResumenNotificaciones {
  /** Vuelve a pedir el resumen (tras marcar leído, por ejemplo) */
  refrescar: () => Promise<void>;
}

const VACIO: ResumenNotificaciones = { conteos: {}, notificaciones: [] };

/** Lo pendiente para la campanita y las insignias del menú: se refresca solo y con los eventos en vivo. */
export function useNotificaciones(): ResumenNotificacionesVivo {
  const [resumen, setResumen] = useState<ResumenNotificaciones>(VACIO);

  const cargar = useCallback(async () => {
    try {
      setResumen(await api.get<ResumenNotificaciones>('/admin/notificaciones'));
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

  return useMemo(() => ({ ...resumen, refrescar: cargar }), [resumen, cargar]);
}
