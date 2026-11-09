import { api } from '../../comun/api';

export type Modalidad = 'SEMANAL' | 'MENSUAL';

export interface SueldoPersona {
  modalidad: Modalidad;
  semanal: number;
  mensual: number;
}

export interface FilaPlanilla {
  partyId: number;
  nombre: string;
  sueldo: SueldoPersona | null;
  vinculo?: { tipo: 'PLANILLA' | 'CONTRATO_TEMPORAL'; fechaIngreso: string; fechaFin: string | null } | null;
  periodo?:{ desde: string; hasta: string };
  estado?: 'ABIERTO' | 'PAGADO';
  programadasH?: number;
  trabajadasH?: number;
  ganado?: number;
  consumos?: number;
  descuentos?: number;
  adelantos?: number;
  neto?: number;
  pendientes?: number;
}

export interface DiaPlanillaApi {
  jornada: string;
  estado: string;
  programadaMin: number;
  trabajadaMin: number;
  tardanzaMin: number;
  salidaAnticipadaMin: number;
  extraMin: number;
  extraAprobada: boolean;
  extraAprobadaEn: string | null;
}

export interface ConsumoPlanillaApi {
  id: string;
  fecha: string;
  pedido: string;
  monto: number;
  cobrar: boolean;
}

export interface AjustePlanillaApi {
  id: number;
  tipo: 'ADELANTO' | 'DESCUENTO';
  fecha: string;
  monto: number;
  motivo: string;
  anulado: boolean;
  anuladoMotivo: string | null;
}

export interface DetallePlanilla {
  partyId: number;
  nombre: string;
  periodo: { desde: string; hasta: string };
  sueldo: SueldoPersona;
  estado: 'ABIERTO' | 'PAGADO';
  periodoId: number | null;
  pagadoEn?: string;
  toleranciaMin: number;
  pctTardanza: number;
  pendientes: number;
  resultado: {
    programadaMin: number;
    trabajadaMin: number;
    tardanzaMin: number;
    salidaAnticipadaMin: number;
    extraMin: number;
    extraAprobadaMin: number;
    valorHora: number;
    pagoTrabajado: number;
    pagoTardanza: number;
    pagoExtra: number;
    /** Vacaciones pagadas en dinero dentro del período. */
    pagoVacaciones?: number;
    ganado: number;
    consumosCobrados: number;
    consumosPendientes: number;
    descuentos: number;
    adelantos: number;
    neto: number;
  };
  dias: DiaPlanillaApi[];
  consumos: ConsumoPlanillaApi[];
  ajustes: AjustePlanillaApi[];
}

/** Misma fórmula del servidor: semanal = mensual×12/52; mensual = semanal×52/12 (a céntimos). */
export function sueldoEquivalente(modalidad: Modalidad, monto: number): { semanal: number; mensual: number } {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return modalidad === 'MENSUAL' ? { semanal: r2((monto * 12) / 52), mensual: r2(monto) } : { semanal: r2(monto), mensual: r2((monto * 52) / 12) };
}

export const soles = (n: number | undefined | null) => (n === undefined || n === null ? '—' : `S/ ${n.toFixed(2)}`);

export const listarPlanilla = (fecha?: string) => api.get<{ fecha: string; filas: FilaPlanilla[] }>(`/admin/planilla${fecha ? `?fecha=${fecha}` : ''}`);
export const detallePlanilla = (partyId: number, fecha: string, excluir: string[]) =>
  api.get<DetallePlanilla>(`/admin/planilla/persona/${partyId}?fecha=${fecha}${excluir.length ? `&excluir=${excluir.join(',')}` : ''}`);
export const obtenerSueldo = (partyId: number) => api.get<{ sueldo: SueldoPersona | null }>(`/admin/planilla/sueldo/${partyId}`);
export const guardarSueldo = (partyId: number, modalidad: Modalidad, monto: number) => api.put(`/admin/planilla/sueldo/${partyId}`, { modalidad, monto });
export const crearAjuste = (tipo: 'ADELANTO' | 'DESCUENTO', datos: { partyId: number; fecha: string; monto: number; motivo: string }) =>
  api.post(`/admin/planilla/${tipo === 'ADELANTO' ? 'adelantos' : 'descuentos'}`, datos);
export const anularAjuste = (id: number, motivo: string) => api.post(`/admin/planilla/ajustes/${id}/anular`, { motivo });
export const aprobarExtra = (partyId: number, jornada: string, aprobada: boolean) => api.post('/admin/planilla/extras', { partyId, jornada, aprobada });
export const pagarPlanilla = (partyId: number, fecha: string, excluirConsumoIds: string[]) => api.post('/admin/planilla/pagar', { partyId, fecha, excluirConsumoIds });
export const reabrirPlanilla = (periodoId: number, motivo: string) => api.post(`/admin/planilla/periodos/${periodoId}/reabrir`, { motivo });
