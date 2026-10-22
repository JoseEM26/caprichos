import { api } from '../../comun/api';

export type EstadoPedido =
  | 'COLA'
  | 'PREPARANDO'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'ANULADO';

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

export interface LineaPedidoOpcion {
  id?: string;
  grupo?: string;
  nombre?: string;
  precio_extra?: number;
  grupo_nombre?: string;
  opcion_nombre?: string;
  nombre_persona?: string | null;
}

export interface LineaPedido {
  id: string;
  pedido_id?: string;
  nombre: string;
  tamano?: string | null;
  cantidad: number;
  precio_unit: string | number;
  subtotal: string | number;
  nota?: string | null;
  nombres_persona?: string[] | null;
  opciones?: LineaPedidoOpcion[];
  opcionesElegidas?: LineaPedidoOpcion[];
  area?: {
    id: string;
    nombre: string;
  } | null;
}

export interface HistorialEstado {
  id: string;
  pedido_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  por_party_id: string;
  en: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: EstadoPedido | string;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  entrega_direccion?: string | null;
  entrega_referencia?: string | null;
  entrega_lat?: number | string | null;
  entrega_lng?: number | string | null;
  pago_metodo?: string | null;
  pago_estado?: string | null;
  pago_preferido?: string | null;
  paga_con?: string | number | null;
  subtotal: string | number;
  descuento: string | number;
  envio?: string | number | null;
  total: string | number;
  comprobante_tipo?: string | null;
  comprobante_doc?: string | null;
  comprobante_razon?: string | null;
  nota?: string | null;
  mesa_nombre?: string | null;
  creado_en: string;
  minutosEspera?: number;
  color?: ColorEspera;
  colorEspera?: ColorEspera;
  lineas?: LineaPedido[];
  historial?: HistorialEstado[];
  zona?: {
    id: string;
    nombre: string;
    precio: number | string;
  } | null;
}

export interface FiltrosListarPedidos {
  estado?: string;
  canal?: string;
  modalidad?: string;
  buscar?: string;
  pagina?: number;
  limite?: number;
  desde?: string;
  hasta?: string;
}

export interface RespuestaListarPedidos {
  total: number;
  pagina: number;
  limite: number;
  items: Pedido[];
}

export interface CajaInfo {
  id: string;
  fecha: string;
  apertura: number;
  estado: 'ABIERTA' | 'CERRADA';
  abierta_por: string;
  cerrada_por: string | null;
  cerrada_en: string | null;
}

export interface CajaActualRespuesta {
  caja: CajaInfo | null;
  abierta: boolean;
  totalesPorMedio: Record<string, number>;
  resumen: {
    apertura: number;
    cobrosEfectivo: number;
    vueltosEfectivo: number;
    ingresos: number;
    egresos: number;
  };
  efectivoEsperado: number;
}

export interface MovimientoCaja {
  id: string;
  caja_id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  motivo: string;
  anulado_en: string | null;
  motivo_anulacion: string | null;
}

export interface PedidoPorCobrar {
  id: string;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: string;
  pago_estado: string;
  pago_metodo: string | null;
  total: number;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  comprobante_tipo: string;
  comprobante_doc: string | null;
  comprobante_razon: string | null;
  creado_en: string;
  minutosEspera: number;
}

export interface PagoItem {
  medio: string;
  monto: number;
  recibido?: number;
}

export interface CobrarDto {
  pedidoId: string | number;
  pagos: PagoItem[];
}

export const pedidosApi = {
  async listar(filtros: FiltrosListarPedidos = {}): Promise<RespuestaListarPedidos> {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.canal) params.append('canal', filtros.canal);
    if (filtros.modalidad) params.append('modalidad', filtros.modalidad);
    if (filtros.buscar) params.append('buscar', filtros.buscar);
    if (filtros.pagina) params.append('pagina', String(filtros.pagina));
    if (filtros.limite) params.append('limite', String(filtros.limite));
    if (filtros.desde) params.append('desde', filtros.desde);
    if (filtros.hasta) params.append('hasta', filtros.hasta);

    const query = params.toString();
    const ruta = query ? `/admin/pedidos?${query}` : '/admin/pedidos';
    return api.get<RespuestaListarPedidos>(ruta);
  },

  async obtenerPorId(id: string | number): Promise<Pedido> {
    return api.get<Pedido>(`/admin/pedidos/${id}`);
  },

  async cambiarEstado(
    id: string | number,
    estado: string,
    motivo?: string,
    pinSupervisor?: string,
  ): Promise<Pedido> {
    const headers: Record<string, string> = {};
    if (pinSupervisor) {
      headers['X-Pin-Supervisor'] = pinSupervisor.trim();
    }
    return api.post<Pedido>(
      `/admin/pedidos/${id}/estado`,
      { estado, motivo },
      { headers },
    );
  },

  async marcarPagoCoordinado(id: string | number): Promise<{ id: string; pago_estado: string }> {
    return api.post<{ id: string; pago_estado: string }>(`/admin/caja/pedidos/${id}/coordinado`);
  },

  async obtenerCajaActual(): Promise<CajaActualRespuesta> {
    return api.get<CajaActualRespuesta>('/admin/caja/actual');
  },

  async abrirCaja(apertura: number): Promise<CajaInfo> {
    return api.post<CajaInfo>('/admin/caja/abrir', { apertura });
  },

  async cobrar(dto: CobrarDto): Promise<any> {
    return api.post<any>('/admin/caja/cobrar', dto);
  },

  async anularCobro(id: string | number, motivo: string, pinSupervisor: string): Promise<any> {
    const headers: Record<string, string> = {
      'X-Pin-Supervisor': pinSupervisor.trim(),
    };
    return api.post<any>(
      `/admin/caja/cobros/${id}/anular`,
      { motivo },
      { headers },
    );
  },

  async listarMovimientos(): Promise<MovimientoCaja[]> {
    return api.get<MovimientoCaja[]>('/admin/caja/movimientos');
  },

  async crearMovimiento(tipo: 'INGRESO' | 'EGRESO', monto: number, motivo: string): Promise<MovimientoCaja> {
    return api.post<MovimientoCaja>('/admin/caja/movimientos', { tipo, monto, motivo });
  },

  async anularMovimiento(id: string | number, motivo: string): Promise<any> {
    return api.post<any>(`/admin/caja/movimientos/${id}/anular`, { motivo });
  },

  async listarPorCobrar(): Promise<PedidoPorCobrar[]> {
    return api.get<PedidoPorCobrar[]>('/admin/caja/por-cobrar');
  },
};
