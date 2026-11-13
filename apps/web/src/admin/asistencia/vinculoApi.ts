import { api, clienteFetch, obtenerBlobAutenticado } from '../../comun/api';

export type TipoVinculo = 'PLANILLA' | 'CONTRATO_TEMPORAL';
export type TipoMovimiento = 'TOMADAS' | 'PAGADAS' | 'AJUSTE';

export const ETIQUETA_VINCULO: Record<TipoVinculo, string> = { PLANILLA: 'En planilla', CONTRATO_TEMPORAL: 'Contrato temporal' };
export const MAX_CONTRATO_BYTES = 5 * 1024 * 1024;

export interface Vinculo {
  id: number;
  tipo: TipoVinculo;
  fechaIngreso: string;
  fechaFin: string | null;
  regimenVacaciones: 30 | 15 | null;
  tieneContrato: boolean;
  notas: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface MovimientoVacacion {
  id: number;
  tipo: TipoMovimiento;
  desde: string;
  hasta: string;
  dias: number;
  monto?: number | null;
  motivo?: string | null;
  anulado: boolean;
  anuladoMotivo?: string | null;
}

export interface ResumenVacaciones {
  regimen: 30 | 15;
  ingreso: string;
  ganados: number;
  tomadas: number;
  pagadas: number;
  ajustes: number;
  saldo: number;
  movimientos: MovimientoVacacion[];
}

export interface VinculoCompleto {
  vigente: Vinculo | null;
  historial: Vinculo[];
  vacaciones: ResumenVacaciones | null;
}

export interface DatosVinculo {
  tipo: TipoVinculo;
  fechaIngreso: string;
  fechaFin?: string | null;
  regimenVacaciones?: 30 | 15;
  notas?: string;
}

export interface DatosMovimiento {
  partyId: number;
  tipo: TipoMovimiento;
  desde: string;
  hasta?: string;
  dias?: number;
  monto?: number;
  motivo?: string;
}

export type MiVacaciones = { aplica: false } | ({ aplica: true } & Omit<ResumenVacaciones, 'movimientos'> & { movimientos: MovimientoVacacion[] });

export const obtenerVinculo = (partyId: number) => api.get<VinculoCompleto>(`/admin/planilla/vinculo/${partyId}`);
export const guardarVinculo = (partyId: number, datos: DatosVinculo) => api.put<Vinculo>(`/admin/planilla/vinculo/${partyId}`, datos);
export const subirContrato = (partyId: number, archivo: File) => {
  const f = new FormData();
  f.append('archivo', archivo);
  return clienteFetch(`/admin/planilla/vinculo/${partyId}/contrato`, { method: 'POST', body: f });
};
export const verContrato = (partyId: number, vinculoId?: number) =>
  obtenerBlobAutenticado(`/admin/planilla/vinculo/${partyId}/contrato${vinculoId ? `?vinculo=${vinculoId}` : ''}`);
export const registrarVacaciones = (datos: DatosMovimiento) => api.post('/admin/planilla/vacaciones', datos);
export const anularVacaciones = (id: number, motivo: string) => api.post(`/admin/planilla/vacaciones/${id}/anular`, { motivo });
export const miVacaciones = () => api.get<MiVacaciones>('/admin/asistencia/mi/vacaciones');
