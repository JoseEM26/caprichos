import type { PlanPagoItem } from '../pedidos/planPago';
import { api } from '../../comun/api';
import { CategoriaCarta } from '../../carta/tipos';
import {
  DiaCalendarioReserva,
  DisenoCompletoJson,
  PisoPlano,
  PisoSalon,
  RangoMisPedidos,
  Reserva,
  RespuestaMisPedidos,
} from './tipos';

export interface CrearElementoPayload {
  pisoId: string;
  tipo: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  nombre?: string;
  asientos?: number;
}

export interface ActualizarElementoPayload {
  x?: number;
  y?: number;
  ancho?: number;
  alto?: number;
  nombre?: string;
  asientos?: number;
  activo?: boolean;
}

export interface ActualizarPisoPayload {
  nombre?: string;
  activo?: boolean;
  cuadriculaAncho?: number;
  cuadriculaAlto?: number;
}

export interface AbrirPedidoMesaPayload {
  mesas: string[];
  lineas: Array<{
    productoId: string | number;
    tamanoId?: string | number;
    cantidad: number;
    opciones?: (string | number)[];
    nota?: string;
    personas?: string[];
    ofertaId?: string;
    comboElecciones?: { parteId: string; productoId: string }[];
  }>;
  nota?: string;
  reservaId?: string;
  cuponCodigo?: string;
  canal?: 'MOZO' | 'CAJA';
  esPersonal?: boolean;
  colaboradorPartyId?: string | number;
  /** Cliente con cuenta elegido en «¿Quién pide?» (id del party); suma puntos al cobrar */
  clientePartyId?: string;
  /** Mesa sin cuenta: el nombre es obligatorio; el teléfono es opcional (si va, recibe la encuesta). */
  cliente?: {
    nombre: string;
    telefono?: string;
  };
  /** Cómo paga: un medio o pago dividido (plan). */
  pago?: {
    metodo: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';
    pagaCon?: number;
    plan?: PlanPagoItem[];
  };
  /** Comprobante que pide Caja: boleta o factura, obligatorio */
  comprobante?: { tipo: 'BOLETA' | 'FACTURA'; dni?: string; ruc?: string; razonSocial?: string; direccion?: string };
}

export interface CrearReservaPayload {
  nombre: string;
  telefono: string;
  personas: number;
  hora: string;
  mesas: (string | number)[];
}

export interface ActualizarReservaPayload {
  nombre?: string;
  telefono?: string;
  personas?: number;
  hora?: string;
  mesas?: (string | number)[];
}

export const salonApi = {
  // =========================================================================
  // PLANO
  // =========================================================================
  obtenerPlano: () => api.get<PisoPlano[]>('/admin/plano'),

  actualizarPiso: (id: string, payload: ActualizarPisoPayload) =>
    api.patch<PisoPlano>(`/admin/plano/pisos/${id}`, payload),

  crearElemento: (payload: CrearElementoPayload) =>
    api.post('/admin/plano/elementos', payload),

  actualizarElemento: (id: string, payload: ActualizarElementoPayload) =>
    api.patch(`/admin/plano/elementos/${id}`, payload),

  girarElemento: (id: string) =>
    api.post(`/admin/plano/elementos/${id}/girar`),

  eliminarElemento: (id: string) =>
    api.delete<{ ok: boolean; eliminado: boolean; id: string }>(
      `/admin/plano/elementos/${id}`,
    ),

  obtenerDiseno: () => api.get<DisenoCompletoJson>('/admin/plano/diseno'),

  aplicarDiseno: (diseno: DisenoCompletoJson | string) =>
    api.put<{ ok: boolean; mensaje: string }>('/admin/plano/diseno', diseno),

  // =========================================================================
  // SALÓN / MESAS
  // =========================================================================
  obtenerMesas: () => api.get<{ pisos: PisoSalon[] }>('/admin/salon/mesas'),

  misPedidos: (rango: RangoMisPedidos) =>
    api.get<RespuestaMisPedidos>(`/admin/pedidos/mis-pedidos?rango=${rango}`),

  abrirPedidoMesa: (payload: AbrirPedidoMesaPayload, idempotencyKey: string) =>
    api.post('/admin/salon/pedidos', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }),

  liberarMesaManual: (mesaId: string, motivo: string, forzar?: boolean) =>
    api.post<{ ok: boolean; mensaje: string }>(
      `/admin/salon/mesas/${mesaId}/liberar`,
      { motivo, ...(forzar ? { forzar: true } : {}) },
    ),

  /** Pasa el pedido de mesa a otra mesa libre (409 MESA_OCUPADA si no lo está) */
  cambiarMesaPedido: (pedidoId: string, mesaId: string) =>
    api.post<{ ok: boolean; mesa: string }>(`/admin/salon/pedidos/${pedidoId}/cambiar-mesa`, { mesaId }),

  marcarEntregadoMesa: (pedidoId: string) =>
    api.post<{ ok: boolean; id: string; codigo: string }>(
      `/admin/salon/pedidos/${pedidoId}/entregado-mesa`,
    ),

  // =========================================================================
  // RESERVAS
  // =========================================================================
  listarReservas: (filtros?: { desde?: string; hasta?: string; estado?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.desde) params.append('desde', filtros.desde);
    if (filtros?.hasta) params.append('hasta', filtros.hasta);
    if (filtros?.estado) params.append('estado', filtros.estado);
    const qs = params.toString();
    return api.get<Reserva[]>(`/admin/reservas${qs ? `?${qs}` : ''}`);
  },

  calendario: (mes: string) =>
    api.get<DiaCalendarioReserva[]>(`/admin/reservas/calendario?mes=${mes}`),

  agenda: (fecha: string) =>
    api.get<Reserva[]>(`/admin/reservas/agenda?fecha=${fecha}`),

  crearReserva: (payload: CrearReservaPayload) =>
    api.post<Reserva>('/admin/reservas', payload),

  actualizarReserva: (id: string, payload: ActualizarReservaPayload) =>
    api.patch<Reserva>(`/admin/reservas/${id}`, payload),

  cancelarReserva: (id: string, motivo: string) =>
    api.post<Reserva>(`/admin/reservas/${id}/cancelar`, { motivo }),

  sentarReserva: (id: string) =>
    api.post<{ mesas: string[]; personas: number; nombre: string }>(
      `/admin/reservas/${id}/sentar`,
    ),

  listarSolicitudes: (estado?: string) => {
    const qs = estado ? `?estado=${estado}` : '';
    return api.get<any[]>(`/admin/reservas/solicitudes${qs}`);
  },

  aprobarSolicitud: (
    id: string,
    payload: { mesas: string[]; personas?: number; hora?: string; nombre?: string; telefono?: string },
  ) => api.post<{ solicitud: any; reserva: Reserva }>(`/admin/reservas/solicitudes/${id}/aprobar`, payload),

  rechazarSolicitud: (id: string, payload: { motivo: string; alternativas?: string }) =>
    api.post<any>(`/admin/reservas/solicitudes/${id}/rechazar`, payload),

  // =========================================================================
  // CARTA (para armar pedido del mozo)
  // =========================================================================
  /** GET /carta devuelve la lista de categorías; se acepta también { categorias } */
  obtenerCarta: async (): Promise<{ categorias: CategoriaCarta[]; local?: any }> => {
    const r = await api.get<CategoriaCarta[] | { categorias: CategoriaCarta[]; local?: any }>('/carta');
    return Array.isArray(r) ? { categorias: r } : r;
  },
};
