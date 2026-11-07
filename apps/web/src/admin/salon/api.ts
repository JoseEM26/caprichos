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
    comboElecciones?: { parteId: string; productoId: string; saborId?: string }[];
    /** Cortesía de la línea (solo con permiso cortesias/dar): sale a S/ 0 */
    cortesia?: { motivo: string; nota?: string };
  }>;
  nota?: string;
  reservaId?: string;
  cuponCodigo?: string;
  canal?: 'MOZO' | 'CAJA';
  /** Personas de la mesa: el servidor valida los asientos (confirmarCapacidad la permite si faltan) */
  personas?: number;
  confirmarCapacidad?: boolean;
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
  comprobante?: { tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA'; dni?: string; ruc?: string; razonSocial?: string; direccion?: string };
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

  /** codigoSupervisor: solo si hay líneas de cortesía y quien envía es SUPERVISOR (6 dígitos) */
  abrirPedidoMesa: (payload: AbrirPedidoMesaPayload, idempotencyKey: string, codigoSupervisor?: string) =>
    api.post('/admin/salon/pedidos', payload, {
      headers: {
        'Idempotency-Key': idempotencyKey,
        ...(codigoSupervisor ? { 'x-codigo-supervisor': codigoSupervisor } : {}),
      },
    }),

  liberarMesaManual: (mesaId: string, motivo: string, forzar?: boolean) =>
    api.post<{ ok: boolean; mensaje: string }>(
      `/admin/salon/mesas/${mesaId}/liberar`,
      { motivo, ...(forzar ? { forzar: true } : {}) },
    ),

  /** Pasa el pedido de mesa a otra mesa libre (409 MESA_OCUPADA si no lo está). Con desdeMesaId mueve solo esa mesa. */
  cambiarMesaPedido: (pedidoId: string, mesaId: string, desdeMesaId?: string) =>
    api.post<{ ok: boolean; mesa: string }>(`/admin/salon/pedidos/${pedidoId}/cambiar-mesa`, {
      mesaId,
      ...(desdeMesaId ? { desdeMesaId } : {}),
    }),

  /** Suma mesas libres a un pedido de salón abierto (máximo 6 en total). Devuelve el nombre «Mesas 3 y 4». */
  agregarMesasPedido: (pedidoId: string, mesaIds: string[]) =>
    api.post<{ ok: boolean; mesa: string; mesas: Array<{ id: string | null }> }>(
      `/admin/salon/pedidos/${pedidoId}/mesas`,
      { mesaIds },
    ),

  /** Quita una mesa del pedido; la mesa queda libre. El pedido conserva al menos una. */
  quitarMesaPedido: (pedidoId: string, mesaId: string) =>
    api.delete<{ ok: boolean; mesa: string; mesas: Array<{ id: string | null }> }>(
      `/admin/salon/pedidos/${pedidoId}/mesas/${mesaId}`,
    ),

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

  /** Vuelve a ACTIVA una reserva «No llegó» de hoy (el cliente llegó tarde). Auditada en el servidor. */
  reactivarReserva: (id: string) => api.post<Reserva>(`/admin/reservas/${id}/reactivar`, {}),

  /** Avisos suaves (no bloquean) para las mesas elegidas a esa fecha y hora (YYYY-MM-DD, HH:mm). */
  avisosMesas: (fecha: string, hora: string, mesaIds: string[]) =>
    api.get<{ avisos: string[] }>(
      `/admin/reservas/avisos-mesas?fecha=${encodeURIComponent(fecha)}&hora=${encodeURIComponent(hora)}&mesas=${mesaIds.join(',')}`,
    ).then((r) => r.avisos),

  listarSolicitudes: (estado?: string) => {
    const qs = estado ? `?estado=${estado}` : '';
    return api.get<any[]>(`/admin/reservas/solicitudes${qs}`);
  },

  aprobarSolicitud: (
    id: string,
    payload: {
      mesas: string[];
      personas?: number;
      hora?: string;
      nombre?: string;
      telefono?: string;
      confirmarCapacidad?: boolean;
    },
  ) => api.post<{ solicitud: any; reserva: Reserva }>(`/admin/reservas/solicitudes/${id}/aprobar`, payload),

  /** Mesas que otras reservas ocupan a esa fecha (YYYY-MM-DD) y hora (HH:mm, Lima). */
  mesasOcupadas: (fecha: string, hora: string) =>
    api.get<Array<{ mesa_id: string; reserva_id: string; nombre: string; hora: string }>>(
      `/admin/reservas/mesas-ocupadas?fecha=${encodeURIComponent(fecha)}&hora=${encodeURIComponent(hora)}`,
    ),

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
