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
}

export interface TrabajadorCredito {
  partyId: string;
  nombre: string;
  rol: string;
  total: number;
  totalFormateado: string;
  tieneConsumo: boolean;
  cantidadConsumos: number;
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
