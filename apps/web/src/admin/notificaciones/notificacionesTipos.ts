export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface NotificacionPendiente {
  id: string;
  titulo: string;
  detalle: string;
  prioridad: Prioridad;
  desde: string | null;
  modulo: string;
  accion: string;
}

export interface NotificacionHistorialItem {
  id: string;
  tipoCodigo: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  leidaEn: string | null;
  creadoEn: string;
  fecha: string;
  hora: string;
  iso: string;
  color: string;
  modulo: string | null;
  accion: string | null;
}

export interface MetricasNotificaciones {
  pendientesAhora: number;
  urgentesAhora: number;
  sinLeerHistorial: number;
  delDiaDeHoy: number;
  totalHistorial: number;
  rolNombre: string;
}

export interface RespuestaHistorialNotificaciones {
  metricas: MetricasNotificaciones;
  pendientes: NotificacionPendiente[];
  conteosPorTipo: Record<string, number>;
  conteosPorEstado: {
    todas: number;
    nuevas: number;
    leidas: number;
  };
  items: NotificacionHistorialItem[];
}

export interface FiltrosHistorial {
  q?: string;
  tipo?: string;
  estado?: 'todas' | 'nuevas' | 'leidas';
  desde?: string;
  hasta?: string;
}
