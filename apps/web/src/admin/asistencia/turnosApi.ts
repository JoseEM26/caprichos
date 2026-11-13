import { api } from '../../comun/api';

// Reemplazos y cambios de turno que pide el propio personal (el elegido acepta, Supervisión/Admin aprueba).

export type TipoTurno = 'REEMPLAZO' | 'CAMBIO_TURNO';
export type EstadoTurno = 'PENDIENTE_ACEPTA' | 'PENDIENTE_APRUEBA' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'VENCIDA' | 'SIN_MARCA';

export const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = {
  PENDIENTE_ACEPTA: 'Espera respuesta',
  PENDIENTE_APRUEBA: 'Espera aprobación',
  APROBADA: 'Aprobado',
  RECHAZADA: 'Rechazado',
  CANCELADA: 'Cancelado',
  VENCIDA: 'Venció',
  SIN_MARCA: 'No marcó',
};

export interface Persona { partyId: number; nombre: string }

export interface PiernaTurno { fecha: string; etiqueta: string; desde: string; hasta: string }

export interface SolicitudTurno {
  id: number;
  tipo: TipoTurno;
  estado: EstadoTurno;
  fecha: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  devolucion: PiernaTurno | null;
  motivo: string;
  solicitante: Persona;
  reemplazo: Persona;
  area: string;
  motivoResolucion: string | null;
  creadaEn: string;
  soyYoSolicitante?: boolean;
  validacion?: { ok: boolean; problema: string | null; areaYRol: string[] } | null;
}

export interface Candidato { partyId: number; nombre: string; motivos: string[] }
export interface Candidatos { candidatos: Candidato[]; descartados: { motivo: string; cantidad: number }[]; aviso: string | null }
export interface TurnoDevolver { fecha: string; etiqueta: string; desde: string; hasta: string }

export interface NuevoTurno {
  tipo: TipoTurno;
  reemplazoPartyId: number;
  fecha: string;
  desde: string;
  hasta: string;
  fechaDevolucion?: string;
  desdeDevolucion?: string;
  hastaDevolucion?: string;
  motivo: string;
}

const MI = '/admin/asistencia/mi/turnos';
const ADM = '/admin/asistencia/turnos';

export const candidatosTurno = (fecha: string, desde: string, hasta: string) =>
  api.get<Candidatos>(`${MI}/candidatos?fecha=${fecha}&desde=${desde}&hasta=${hasta}`);
export const turnosParaDevolver = (partyId: number) => api.get<TurnoDevolver[]>(`${MI}/candidatos/${partyId}/turnos`);
export const misTurnos = () => api.get<SolicitudTurno[]>(`${MI}/solicitudes`);
export const crearTurno = (b: NuevoTurno) => api.post<{ ok: boolean; id: number }>(`${MI}/solicitudes`, b);
export const aceptarTurno = (id: number) => api.post(`${MI}/solicitudes/${id}/aceptar`);
export const rechazarTurno = (id: number) => api.post(`${MI}/solicitudes/${id}/rechazar`);
export const cancelarTurno = (id: number) => api.post(`${MI}/solicitudes/${id}/cancelar`);

export const turnosPorAprobar = () => api.get<{ toleranciaMin: number; solicitudes: SolicitudTurno[] }>(`${ADM}/solicitudes`);
export const aprobarTurno = (id: number) => api.post(`${ADM}/solicitudes/${id}/aprobar`, {});
export const rechazarTurnoAdmin = (id: number, motivo: string) => api.post(`${ADM}/solicitudes/${id}/rechazar`, { motivo });
