import { api } from '../../comun/api';

export interface ConsumoItem {
  id: string;
  pedidoId: string;
  pedidoCodigo: string;
  fecha: string;
  fechaIso: string;
  monto: number;
  montoFormateado: string;
  lineas: string[];
  /** Descuento del personal que ya lleva el pedido (S/) */
  descuento?: number;
  /** PENDIENTE = se paga en su cuenta semanal/mensual; PAGADO = ya saldado (en Caja o por planilla) */
  estadoPago?: 'PENDIENTE' | 'PAGADO';
  pagadoEn?: string | null;
  pagoModo?: 'CAJA' | 'PLANILLA' | null;
  /** Medio con el que se cobró (EFECTIVO, YAPE… o PLANILLA) y quién cobró */
  pagoMedio?: string | null;
  pagoDetalle?: string | null;
  cobradoPor?: string | null;
}

export interface CuentaCredito {
  partyId: string;
  semana: { etiqueta: string; total: number; debe: number };
  mes: { etiqueta: string; total: number; debe: number };
  debeTotal: number;
  /** «Debe esta semana: S/ X · Este mes: S/ Y» */
  resumen: string;
  consumos: ConsumoItem[];
}

export interface TrabajadorCredito {
  partyId: string;
  nombre: string;
  rol: string;
  total: number;
  totalFormateado: string;
  tieneConsumo: boolean;
  cantidadConsumos: number;
  /** Lo que sigue sin pagarse (S/) */
  pendiente?: number;
  items: ConsumoItem[];
}

export interface ResumenCreditosTotales {
  totalMonto: number;
  totalFormateado: string;
  totalConsumos: number;
  trabajadoresConConsumo: number;
  totalTrabajadores: number;
  resumenTrabajadores: string;
}

export interface PeriodoCreditos {
  tipo: 'semana' | 'mes' | 'rango';
  etiqueta: string;
  desde: string;
  hasta: string;
  navegable: boolean;
}

export interface RespuestaResumenCreditos {
  descuentoPct: number;
  periodo: PeriodoCreditos;
  totales: ResumenCreditosTotales;
  trabajadores: TrabajadorCredito[];
}

export interface FiltrosCreditos {
  periodo?: 'semana' | 'mes' | 'rango';
  semanaOffset?: number;
  mesOffset?: number;
  desde?: string;
  hasta?: string;
}

export interface ColaboradorActivo {
  partyId: string;
  nombre: string;
  rol: string;
  descuentoPct?: number;
}

export async function obtenerResumenCreditos(
  filtros: FiltrosCreditos = {},
): Promise<RespuestaResumenCreditos> {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.semanaOffset !== undefined) params.set('semanaOffset', String(filtros.semanaOffset));
  if (filtros.mesOffset !== undefined) params.set('mesOffset', String(filtros.mesOffset));
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);

  const query = params.toString();
  return api.get<RespuestaResumenCreditos>(`/admin/creditos/resumen${query ? `?${query}` : ''}`);
}

export async function listarPersonalActivo(): Promise<ColaboradorActivo[]> {
  return api.get<ColaboradorActivo[]>('/admin/creditos/personal-activo');
}

export async function registrarConsumoCredito(
  pedidoId: string | number,
  partyId: string | number,
): Promise<any> {
  return api.post('/admin/creditos/consumo', { pedidoId, partyId });
}

export async function exportarCreditos(
  filtros: FiltrosCreditos = {},
): Promise<{ blob: Blob; nombreArchivo: string }> {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.semanaOffset !== undefined) params.set('semanaOffset', String(filtros.semanaOffset));
  if (filtros.mesOffset !== undefined) params.set('mesOffset', String(filtros.mesOffset));
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);

  const query = params.toString();
  const url = `/admin/creditos/exportar${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Error al descargar el archivo de exportación');
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const nombreArchivo = match ? match[1] : 'creditos-personal.csv';
  const blob = await res.blob();

  return { blob, nombreArchivo };
}

export async function obtenerCuentaCredito(partyId: string): Promise<CuentaCredito> {
  return api.get<CuentaCredito>(`/admin/creditos/cuenta?partyId=${encodeURIComponent(partyId)}`);
}

/** El trabajador paga en Caja uno o varios consumos pendientes (un solo ingreso por el total). */
export async function saldarConsumos(consumoIds: string[], medio: string): Promise<{ ok: boolean; total: number; cantidad: number }> {
  return api.post('/admin/creditos/saldar', { consumoIds, medio });
}

/** Cierre de periodo: descontado por planilla/sueldo, sin mover caja. */
export async function marcarPlanilla(desde: string, hasta: string, motivo: string, partyId?: string): Promise<{ ok: boolean; cantidad: number; total: number }> {
  return api.post('/admin/creditos/planilla', { desde, hasta, motivo, partyId });
}

/** ADMIN: marca (Ya se le descontó) o desmarca a mano un consumo; queda auditado. */
export async function marcarCobrado(consumoId: string, cobrado: boolean): Promise<{ ok: boolean; cobrado: boolean }> {
  return api.post('/admin/creditos/marcar-cobrado', { consumoId, cobrado });
}
