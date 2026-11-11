import { api } from '../../comun/api';
import type { TipoMarca } from './asistenciaApi';

// Marcas múltiples, cronograma, solicitudes de corrección y aprobación en lote.

/** Texto corto del rol interpretado de una marca (el servidor las lee por orden y pares). */
export const ETIQUETA_ROL: Record<TipoMarca, string> = {
  ENTRADA: 'Entrada',
  SALIDA_ALMUERZO: 'Salida a break',
  ENTRADA_ALMUERZO: 'Regreso del break',
  SALIDA: 'Salida',
};

export interface CronoMarca {
  id: number;
  minutos: number;
  hora: string;
  momento: string | null;
  origen: 'CELULAR' | 'CORRECCION' | 'WEB' | null;
  estado: string;
  /** Rol interpretado (las dobles marcas toman el de la marca a la que se unieron). */
  rol: TipoMarca | null;
  duplicada: boolean;
  tieneSelfie: boolean;
  motivo: string | null;
  alertas: string | null;
  /** GPS aproximado: distancia al local y precisión del celular, en metros (null si no hubo GPS). */
  distanciaM?: number | null;
  precisionM?: number | null;
}
export interface ItemSolicitud { tipo: TipoMarca; hora: string; momento: string }
export interface CronoSolicitud { id: number; motivo: string; creadaEn: string; items: ItemSolicitud[] }
export interface Tramo { desde: number; hasta: number | null; tipo: 'TRABAJO' | 'BREAK' }
export interface InconsistenciaDia { tipo: string; texto: string; falta: TipoMarca | null; sinSolicitud: boolean }
export interface CronoDia {
  jornada: string;
  estado: string;
  turno: { entrada: number; salida: number; almuerzoIni: number | null; almuerzoFin: number | null } | null;
  alertas: string[];
  trabajadaMin: number;
  tardanzaMin: number;
  breakMin: number;
  tramos: Tramo[];
  marcas: CronoMarca[];
  solicitudes: CronoSolicitud[];
  cantidadesRaras: boolean;
  inconsistencia: InconsistenciaDia | null;
}
export interface CronoPersona { partyId: number; nombre: string; roles: string[]; dias: CronoDia[] }
export interface ResumenDiaCrono { total: number; cumplieron: number; tardanzas: number; aRevisar: number; faltas: number; solicitudes: number }
export interface Cronograma { desde: string; hasta: string; dias: string[]; resumen: Record<string, ResumenDiaCrono>; personas: CronoPersona[] }

export const cronograma = (desde: string, hasta: string) => api.get<Cronograma>(`/admin/asistencia/cronograma?desde=${desde}&hasta=${hasta}`);
export const separarMarca = (id: number, motivo: string) => api.post(`/admin/asistencia/marcas/${id}/separar`, { motivo });
export const reasignarMarca = (id: number, tipo: TipoMarca, motivo: string) => api.post(`/admin/asistencia/marcas/${id}/reasignar`, { tipo, motivo });

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
export interface Solicitud {
  id: number;
  partyId: number;
  jornada: string;
  etiqueta: string;
  items: ItemSolicitud[];
  motivo: string;
  estado: EstadoSolicitud;
  creadaEn: string;
  resueltaEn: string | null;
  motivoResolucion: string | null;
  nombre?: string;
  roles?: string[];
}
export interface InconsistenciaPersona {
  jornada: string;
  etiqueta: string;
  tipo: string;
  texto: string;
  falta: TipoMarca | null;
  estado: 'SIN_CORREGIR' | 'ENVIADA';
  rechazo: string | null;
  solicitudId: number | null;
}
export const miInconsistencias = () => api.get<InconsistenciaPersona[]>('/admin/asistencia/mi/inconsistencias');
export const misSolicitudes = () => api.get<Solicitud[]>('/admin/asistencia/mi/solicitudes');
export const crearSolicitud = (datos: { jornada: string; items: Array<{ tipo: TipoMarca; hora: string }>; motivo: string }) =>
  api.post<{ ok: boolean; id: number }>('/admin/asistencia/mi/solicitudes', datos);
export const cancelarSolicitud = (id: number) => api.post(`/admin/asistencia/mi/solicitudes/${id}/cancelar`, {});

export interface MarcaBandeja {
  id: number;
  partyId: number;
  nombre: string;
  roles: string[];
  jornada: string;
  hora: string;
  rol: TipoMarca | null;
  origen: string | null;
  estado: string;
  alertas: string | null;
  tieneSelfie: boolean;
  /** WEB = marca manual (usuario y contraseña); CELULAR = con alertas de GPS; DOBLE = unida a la anterior. */
  clase: 'WEB' | 'CELULAR' | 'DOBLE';
  cantidadesRaras: boolean;
}
export interface SinSolicitud { partyId: number; nombre: string; roles: string[]; jornada: string; tipo: string; texto: string }
export interface Bandeja { solicitudes: Solicitud[]; sinSolicitud: SinSolicitud[]; marcas: MarcaBandeja[] }
export const bandejaCorrecciones = () => api.get<Bandeja>('/admin/asistencia/solicitudes');
export const contadorSolicitudes = () => api.get<{ pendientes: number }>('/admin/asistencia/solicitudes/contador');

export interface ResultadoLote {
  total: number;
  ok: number;
  fallidas: number;
  omitidas?: number;
  resultados: Array<{ tipo: 'MARCA' | 'SOLICITUD'; id: number; ok: boolean; codigo?: string; mensaje?: string }>;
}
export const loteCorrecciones = (datos: { accion: 'APROBAR' | 'RECHAZAR'; motivo?: string; items: Array<{ tipo: 'MARCA' | 'SOLICITUD'; id: number }> }) =>
  api.post<ResultadoLote>('/admin/asistencia/lote', datos);
export const aprobarSimplesPeriodo = (partyId: number, desde: string, hasta: string) =>
  api.post<ResultadoLote>('/admin/asistencia/aprobar-simples', { partyId, desde, hasta });

export const MINUTOS_DIA = 1440;
/** «HH:MM» de minutos de jornada (pasados de 24 h vuelven a empezar). */
export const horaDe = (min: number): string => {
  const m = ((min % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
