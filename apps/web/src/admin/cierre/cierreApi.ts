import { api } from '../../comun/api';
import type { CobrarDto } from '../pedidos/pedidosApi';

/** Pedido sin cobrar de cualquier día: bloquea el cierre hasta cobrarlo o anularlo (RN-CAP-079). */
export interface PendienteCobro {
  id: number;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: string;
  total: number;
  fecha: string;
}

export interface ConteoDenominaciones {
  '200'?: number;
  '100'?: number;
  '50'?: number;
  '20'?: number;
  '10'?: number;
  '5'?: number;
  '2'?: number;
  '1'?: number;
  '0.5'?: number;
  '0.2'?: number;
  '0.1'?: number;
  [key: string]: number | undefined;
}

export interface MediosVistos {
  yape?: number;
  plin?: number;
  transferencia?: number;
  tarjeta?: number;
  [key: string]: number | undefined;
}

export interface ArqueoDto {
  conteo: Record<string, number>;
  medios: MediosVistos;
}

export interface ArqueoRespuesta {
  resultado: 'CUADRA' | 'NO_CUADRA';
  intento: number;
}

export interface CerrarCajaDto {
  conteo?: Record<string, number>;
  medios?: MediosVistos;
  nota?: string;
}

export interface CierreMedioDetalle {
  medio: string;
  sistema: number;
  visto: number;
  diferencia: number | null;
}

export interface CierreCajaRespuesta {
  cajaId: number;
  fecha: string;
  resultado: 'CUADRA' | 'NO_CUADRA';
  aprobadoPor: number | null;
  nota: string | null;
  medios?: CierreMedioDetalle[];
}

export interface MontosEsperados {
  cajaId: number;
  fecha: string;
  apertura: number;
  efectivoEsperado: number;
  medios: {
    efectivo: number;
    yape: number;
    plin: number;
    transferencia: number;
    tarjeta: number;
  };
  desglose: {
    ventasEfectivo: number;
    ingresos: number;
    egresos: number;
  };
}

export interface RepartidorPorLiquidar {
  repartidorPartyId: number;
  nombre: string;
  pedidos: Array<{
    id: number;
    codigo: string;
    total: number;
    entregadoEn: string | null;
  }>;
  totalCobrado: number;
  totalLiquidado: number;
  pendiente: number;
}

export interface LiquidarRepartidorDto {
  repartidorPartyId: number | string;
  entregado: number;
}

export interface LiquidacionRespuesta {
  id: number;
  cajaId: number;
  repartidorPartyId: number;
  esperado: number;
  entregado: number;
  diferencia: number;
}

export interface ItemHistorialCierre {
  cajaId: number;
  fecha: string;
  apertura: number;
  cerradaPor: number | null;
  cerradaPorNombre?: string | null;
  cerradaEn: string | null;
  cierre: {
    resultado: 'CUADRA' | 'NO_CUADRA';
    aprobadoPor: number | null;
    nota: string | null;
    medios: CierreMedioDetalle[];
  } | null;
}

export interface HistorialRespuesta {
  cierres: ItemHistorialCierre[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface DetalleCierreCompleto {
  cajaId: number;
  fecha: string;
  apertura: number;
  resultado: 'CUADRA' | 'NO_CUADRA';
  aprobadoPor: number | null;
  nota: string | null;
  cerradaPor: number | null;
  cerradaPorNombre?: string | null;
  cerradaEn: string | null;
  conteo: Record<string, number> | null;
  medios: CierreMedioDetalle[];
}

export const DENOMINACIONES_LISTA: Array<{ valor: number; clave: string; tipo: 'billete' | 'moneda'; etiqueta: string }> = [
  { valor: 200, clave: '200', tipo: 'billete', etiqueta: 'S/ 200' },
  { valor: 100, clave: '100', tipo: 'billete', etiqueta: 'S/ 100' },
  { valor: 50, clave: '50', tipo: 'billete', etiqueta: 'S/ 50' },
  { valor: 20, clave: '20', tipo: 'billete', etiqueta: 'S/ 20' },
  { valor: 10, clave: '10', tipo: 'billete', etiqueta: 'S/ 10' },
  { valor: 5, clave: '5', tipo: 'moneda', etiqueta: 'S/ 5.00' },
  { valor: 2, clave: '2', tipo: 'moneda', etiqueta: 'S/ 2.00' },
  { valor: 1, clave: '1', tipo: 'moneda', etiqueta: 'S/ 1.00' },
  { valor: 0.5, clave: '0.5', tipo: 'moneda', etiqueta: 'S/ 0.50' },
  { valor: 0.2, clave: '0.2', tipo: 'moneda', etiqueta: 'S/ 0.20' },
  { valor: 0.1, clave: '0.1', tipo: 'moneda', etiqueta: 'S/ 0.10' },
];

export function calcularTotalEfectivo(conteo: Record<string, number | string | undefined>): number {
  let suma = 0;
  for (const d of DENOMINACIONES_LISTA) {
    const vStr = conteo[d.clave] ?? (d.clave === '0.5' ? conteo['0.50'] : d.clave === '0.2' ? conteo['0.20'] : d.clave === '0.1' ? conteo['0.10'] : undefined);
    const cant = typeof vStr === 'number' ? vStr : parseFloat(String(vStr || '0'));
    if (!isNaN(cant) && cant > 0) {
      suma += cant * d.valor;
    }
  }
  return Math.round(suma * 100) / 100;
}

export const cierreApi = {
  obtenerEsperado: () =>
    api.get<MontosEsperados>('/admin/cierre/esperado'),

  realizarArqueo: (dto: ArqueoDto, pinSupervisor?: string) => {
    const headers: Record<string, string> = {};
    if (pinSupervisor?.trim()) {
      headers['x-codigo-supervisor'] = pinSupervisor.trim();
      headers['x-pin-supervisor'] = pinSupervisor.trim();
    }
    return api.post<ArqueoRespuesta>('/admin/cierre/arqueo', dto, { headers });
  },

  cerrarCaja: (dto: CerrarCajaDto, pinSupervisor?: string) => {
    const headers: Record<string, string> = {};
    if (pinSupervisor?.trim()) {
      headers['x-codigo-supervisor'] = pinSupervisor.trim();
      headers['x-pin-supervisor'] = pinSupervisor.trim();
    }
    return api.post<CierreCajaRespuesta>('/admin/cierre/cerrar', dto, { headers });
  },

  // El servidor valida el código/PIN de supervisora y solo entonces entrega el esperado.
  verificarPinSupervisor: (pinSupervisor: string) =>
    api.get<MontosEsperados>('/admin/cierre/esperado', {
      headers: {
        'x-codigo-supervisor': pinSupervisor.trim(),
        'x-pin-supervisor': pinSupervisor.trim(),
      },
    }),

  // Solo admin o con el código de supervisor (el servidor lo exige).
  listarPendientesDeCobro: (pinSupervisor?: string) => {
    const headers: Record<string, string> = {};
    if (pinSupervisor?.trim()) {
      headers['x-codigo-supervisor'] = pinSupervisor.trim();
      headers['x-pin-supervisor'] = pinSupervisor.trim();
    }
    return api.get<PendienteCobro[]>('/admin/cierre/pendientes', { headers });
  },

  cobrarPendiente: (id: string | number, dto: CobrarDto) =>
    api.post<unknown>(`/admin/cierre/pendientes/${id}/cobrar`, dto),

  listarRepartidoresPorLiquidar: () =>
    api.get<RepartidorPorLiquidar[]>('/admin/cierre/repartidores'),

  liquidarRepartidor: (dto: LiquidarRepartidorDto) =>
    api.post<LiquidacionRespuesta>('/admin/cierre/liquidar', dto),

  obtenerHistorial: (filtros?: { pagina?: number; limite?: number; desde?: string; hasta?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros?.limite) params.set('limite', String(filtros.limite));
    if (filtros?.desde) params.set('desde', filtros.desde);
    if (filtros?.hasta) params.set('hasta', filtros.hasta);
    const qs = params.toString();
    return api.get<HistorialRespuesta>(`/admin/cierre/historial${qs ? `?${qs}` : ''}`);
  },

  obtenerCierrePorId: (id: string | number) =>
    api.get<DetalleCierreCompleto>(`/admin/cierre/${id}`),
};
