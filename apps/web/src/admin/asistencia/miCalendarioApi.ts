import { api } from '../../comun/api';

/** Contratos de «Mi asistencia» (calendario) y «Mis pagos». Solo estado, horas y resultados: nunca foto, GPS ni datos ajenos. */
export type EstadoRespuesta = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface DiaCalendario {
  fecha: string;
  feriado?: string | null;
  programado?: { entrada: string; salida: string } | null;
  estado: string;
  entrada?: string | null;
  almuerzoSalida?: string | null;
  almuerzoVuelta?: string | null;
  almuerzoMin?: number | null;
  salida?: string | null;
  trabajadaMin?: number | null;
  tardanzaMin?: number | null;
  salioAntesMin?: number | null;
  extraMin?: number | null;
  extraEstado?: EstadoRespuesta | null;
  marcas?: { tipo: string | null; hora: string; estado: string }[];
  solicitud?: { id: number; tipo: string; estado: EstadoRespuesta; motivo?: string | null; respuesta?: string | null } | null;
}

export interface ResumenCalendario {
  diasTrabajados?: number;
  horasTrabajadasMin?: number;
  tardanzaMin?: number;
  extraAprobadaMin?: number;
  extraPendienteMin?: number;
  faltas?: number;
}

export interface MiCalendario {
  desde: string;
  hasta: string;
  dias: DiaCalendario[];
  resumen?: ResumenCalendario;
}

export const miCalendario = (desde: string, hasta: string) =>
  api.get<MiCalendario>(`/admin/mi-asistencia/calendario?desde=${desde}&hasta=${hasta}`);

export interface MiPlanilla {
  periodo?: { desde: string; hasta: string; tipo?: string };
  base?: { sueldo?: number | null; tarifaHora?: number | null; valorHora?: number | null };
  horas?: { trabajadasMin?: number; extraAprobadaMin?: number; extraPendienteMin?: number; extraRechazadaMin?: number };
  ganado?: { bruto?: number; extras?: number; bonos?: number };
  descuentos?: { id: number; fecha?: string; etiqueta?: string; concepto?: string; monto: number }[];
  adelantos?: { id: number; fecha?: string; monto: number; motivo?: string | null }[];
  penalidadTardanza?: { total: number; detalle?: { fecha: string; minutos: number; monto: number }[] };
  prestamos?: { id: number; capital: number; interesPctMensual?: number; cuota: number; saldo: number; cuotasPagadas: number; cuotasTotales: number; estado?: string }[];
  serviciosExtra?: { nombre: string; monto: number; periodicidad?: string; activo?: boolean }[];
  neto?: number;
  estadoPago?: 'PENDIENTE' | 'PAGADO';
  pagadoEn?: string | null;
}

export const miPlanilla = (periodo?: string) =>
  api.get<MiPlanilla>(`/admin/mi-planilla${periodo ? `?periodo=${periodo}` : ''}`);
