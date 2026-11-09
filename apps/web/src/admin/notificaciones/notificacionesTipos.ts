export type Prioridad = 'ALTA' | 'MEDIA' | 'BAJA';

export interface NotificacionPendiente {
  id: string;
  /** Clave para marcar leída: `n:<id>` (guardada) o `c:<tipo>:<firma>` (calculada) */
  clave: string;
  titulo: string;
  detalle: string;
  prioridad: Prioridad;
  desde: string | null;
  modulo: string;
  accion: string;
  ruta?: string;
  /** Leída por ESTE usuario */
  leida: boolean;
  leidaEn: string | null;
}

const RANGO_PRIORIDAD: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

/**
 * Mismo orden que el servidor: no leídas por urgencia y, dentro de cada una, las más nuevas arriba;
 * después las leídas, la última leída primero. Sirve para reordenar al instante al marcar.
 */
export function ordenarNotificaciones(lista: NotificacionPendiente[]): NotificacionPendiente[] {
  const ahora = new Date().toISOString();
  const noLeidas = lista
    .filter((n) => !n.leida)
    .sort((a, b) => RANGO_PRIORIDAD[a.prioridad] - RANGO_PRIORIDAD[b.prioridad] || (b.desde ?? ahora).localeCompare(a.desde ?? ahora));
  const leidas = lista
    .filter((n) => n.leida)
    .sort((a, b) => (b.leidaEn ?? '').localeCompare(a.leidaEn ?? ''));
  return [...noLeidas, ...leidas];
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

/** Ajustes que cambia el ADMIN en Configuración (llegan con el resumen y con el historial) */
export type AlcanceSonido = 'TODOS_NO_LEIDOS' | 'SOLO_URGENTES' | 'SOLO_HOY';

export interface AjustesNotificaciones {
  sonidoActivo: boolean;
  sonidoIntervaloSeg: number;
  sonidoAlcance: AlcanceSonido;
  marcarTodasActivo: boolean;
}

/** Mismos valores que el servidor: se usan si aún no llegó el resumen */
export const AJUSTES_NOTIFICACIONES_DEFECTO: AjustesNotificaciones = {
  sonidoActivo: true,
  sonidoIntervaloSeg: 15,
  sonidoAlcance: 'TODOS_NO_LEIDOS',
  marcarTodasActivo: true,
};

export interface RespuestaHistorialNotificaciones {
  ajustes?: AjustesNotificaciones;
  metricas: MetricasNotificaciones;
  pendientes: NotificacionPendiente[];
  conteosPorTipo: Record<string, number>;
  conteosPorEstado: {
    todas: number;
    nuevas: number;
    leidas: number;
  };
  items: NotificacionHistorialItem[];
  /** Total que cumple los filtros (no solo los de esta página) */
  total?: number;
  hayMas?: boolean;
  /** Id de la última fila de esta página: se pasa como `cursor` para pedir la siguiente */
  siguienteCursor?: string | null;
}

export interface FiltrosHistorial {
  q?: string;
  tipo?: string;
  estado?: 'todas' | 'nuevas' | 'leidas';
  desde?: string;
  hasta?: string;
  limite?: number;
  cursor?: string;
}
