import { api } from '../../comun/api';
import type { TicketCierreDatos } from '@caprichos/compartido';
import type { CobrarDto, CobroTurno, MovimientoCaja } from '../pedidos/pedidosApi';

/** Pedido sin cobrar de cualquier día: bloquea el cierre hasta cobrarlo o anularlo (RN-CAP-079). */
export interface PendienteCobro {
  id: number;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: string;
  total: number;
  fecha: string;
  /** PENDIENTE = por cobrar; COORDINADO = por confirmar (el repartidor/voucher ya lo coordinó) */
  pagoEstado?: string | null;
  /** Solo el nombre del cliente; nunca teléfono ni DNI. Null si no hay nombre. */
  clienteNombre?: string | null;
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
  /** Efectivo contado como un solo total, sin desglosar por billetes y monedas */
  efectivoTotal?: number;
  medios?: MediosVistos;
  nota?: string;
  /** Solo el administrador: justifica cerrar con pedidos entregados sin cobrar (mínimo 10 letras) */
  motivoEntregadosSinCobrar?: string;
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
  /** Suma de las diferencias de todos los medios (visto − sistema) */
  diferenciaTotal?: number;
  medios?: CierreMedioDetalle[];
}

/** Detalle de una venta cobrada del turno (solo para mostrar); se une a `cobrados` por `pedidoId`. */
export interface VentaDetalle {
  pedidoId: string;
  modalidad: string | null;
  canal: string | null;
  estadoPedido: string | null;
  mesa: string | null;
  /** Cuándo se registró el pedido */
  creadoEn: string | null;
  /** Mozo o cajero que tomó el pedido; null si lo hizo el cliente */
  registradoPor: string | null;
  cobradoPor: string | null;
  cobradoPorMozo: string | null;
  repartidor: string | null;
  categorias: string[];
  pagos: Array<{ medio: string; monto: number }>;
  propina: number;
  creditoPersonal: boolean;
  comprobante: { tipo: string; numero: string; estado: string | null } | null;
}

export interface MontosEsperados {
  cajaId: number;
  /** Fecha de la caja ABIERTA que se cierra (puede ser de un día anterior) */
  fecha: string;
  /** Cobros y movimientos de esa misma caja: los mismos que suman los montos de abajo */
  cobrados: CobroTurno[];
  /** Detalle de cada venta de `cobrados` (quién, tipo, categoría, repartidor…); puede faltar en servidores viejos */
  ventas?: VentaDetalle[];
  movimientos: MovimientoCaja[];
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
    /** Propinas del día, aparte de la venta. Efectivo ya suma al esperado; digital ya está en medios. */
    propinas?: { total: number; efectivo: number; digital: number };
    ingresos: number;
    egresos: number;
    /** Efectivo que los repartidores ya entregaron a la caja */
    liquidadoRepartidores?: number;
    /** Desglose llano del efectivo: apertura + cobrosEfectivo + repartidores + ingresos − egresos = esperado */
    apertura?: number;
    /** Cobros en efectivo con propinas, ya netos de vuelto */
    cobrosEfectivo?: number;
    /** Vueltos entregados (informativo: cobrosEfectivo ya los descuenta) */
    vueltos?: number;
    esperado?: number;
    porMedio?: { efectivo: number; yape: number; plin: number; transferencia: number; tarjeta: number };
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

/** Medios digitales que calcula el sistema: el cajero no los teclea. */
export type ClaveDigital = 'yape' | 'plin' | 'transferencia' | 'tarjeta';
export type MedioAjustable = 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA';

/**
 * Un medio digital de la caja. `cobrado` es lo que entró por ese medio; `devuelto` son las devoluciones
 * del día (negativo o 0); `sistema` es el esperado digital = cobrado + devuelto. `monto` es el que vale
 * en el cierre (el esperado, o la corrección aprobada).
 */
export interface DigitalCaja {
  monto: number;
  sistema: number;
  cobrado: number;
  devuelto: number;
  cobros: number;
  corregido: boolean;
}

export interface DigitalesCaja {
  cajaId: number;
  fecha: string;
  medios: Record<ClaveDigital, DigitalCaja>;
}

/** Corrección de un monto digital de la caja, con quién la hizo, quién la aprobó y cuándo. */
/** Devolución de un pedido en la caja abierta (informativa para el cuadre). */
export interface DevolucionTurno {
  id: string;
  pedidoCodigo: string;
  montoDevuelto: number;
  medio: string;
  codigoOperacion: string | null;
  motivo: string | null;
  porNombre: string | null;
  autorizadoPorNombre: string | null;
  comprobanteBajaEstado: string | null;
  creadoEn: string;
}

export interface AjusteMedio {
  id: number;
  medio: string;
  montoSistema: number;
  montoAnterior: number;
  montoNuevo: number;
  motivo: string;
  porNombre: string | null;
  autorizadoPorNombre: string | null;
  creadoEn: string;
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
  ajustesMedio?: AjusteMedio[];
  /** Todo el detalle del cierre ya armado (el mismo que se imprime); falta en respuestas de un API viejo. */
  ticket?: TicketCierreDatos;
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

  realizarArqueo: (dto: ArqueoDto) => api.post<ArqueoRespuesta>('/admin/cierre/arqueo', dto),

  cerrarCaja: (dto: CerrarCajaDto) => api.post<CierreCajaRespuesta>('/admin/cierre/cerrar', dto),

  // Pedidos sin cobrar que bloquean el cierre: los ve todo el que cierra la caja.
  listarPendientesDeCobro: () => api.get<PendienteCobro[]>('/admin/cierre/pendientes'),

  obtenerDigitales: () => api.get<DigitalesCaja>('/admin/cierre/digitales'),

  listarAjustesMedio: () => api.get<AjusteMedio[]>('/admin/cierre/ajustes-medio'),

  listarDevolucionesTurno: () => api.get<DevolucionTurno[]>('/admin/cierre/devoluciones'),

  // Corrección con motivo: queda auditada a nombre de quien la hace
  registrarAjusteMedio: (dto: { medio: MedioAjustable; montoNuevo: number; motivo: string }) =>
    api.post<AjusteMedio>('/admin/cierre/ajustes-medio', dto),

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

  /** Encola el ticket de cierre en la ticketera de Caja. */
  imprimirCierre: (id: string | number) =>
    api.post<{ ok: boolean; mensaje: string }>(`/admin/cierre/${id}/imprimir`, {}),
};
