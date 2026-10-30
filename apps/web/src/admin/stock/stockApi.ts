import { api } from '../../comun/api';
import {
  InsumoItem,
  LugarStockItem,
  MovimientoItem,
  ProductoRecetaItem,
  RecetaProductoDetalle,
  ExistenciasMatriz,
  AjusteOpcionItem,
} from './tipos';

export interface EstadoControlAlmacen {
  activo: boolean;
  insumosConReceta: number;
  insumosSinStock: number;
  productosEnRiesgo: number;
}

export const stockApi = {
  /** Interruptor «Control de almacén»: si está encendido y cuántos productos se agotarían al primer cobro. */
  estadoControl: (): Promise<EstadoControlAlmacen> => api.get<EstadoControlAlmacen>('/admin/stock/control'),

  // Lugares
  listarLugares: async (): Promise<LugarStockItem[]> => {
    try {
      const res = await api.get<LugarStockItem[]>('/admin/stock/lugares');
      return res || [];
    } catch {
      return [];
    }
  },

  // Insumos
  listarInsumos: async (params?: { q?: string; estado?: string; lugar?: string; activo?: string }): Promise<InsumoItem[]> => {
    try {
      const sp = new URLSearchParams();
      if (params?.q) sp.set('q', params.q);
      if (params?.estado) sp.set('estado', params.estado);
      if (params?.lugar) sp.set('lugar', params.lugar);
      if (params?.activo) sp.set('activo', params.activo);
      const qs = sp.toString();
      const res = await api.get<InsumoItem[]>(`/admin/stock/insumos${qs ? `?${qs}` : ''}`);
      return res || [];
    } catch {
      return [];
    }
  },

  obtenerInsumo: async (id: string): Promise<InsumoItem> => {
    return await api.get<InsumoItem>(`/admin/stock/insumos/${id}`);
  },

  crearInsumo: (data: any) => api.post<InsumoItem>('/admin/stock/insumos', data),

  actualizarInsumo: (id: string, data: any) =>
    api.patch<InsumoItem>(`/admin/stock/insumos/${id}`, data),

  desactivarInsumo: (id: string) =>
    api.post<{ ok: boolean; activo: boolean }>(`/admin/stock/insumos/${id}/desactivar`),

  activarInsumo: (id: string) =>
    api.post<{ ok: boolean; activo: boolean }>(`/admin/stock/insumos/${id}/activar`),

  // Existencias
  obtenerExistencias: async (): Promise<ExistenciasMatriz> => {
    try {
      const res = await api.get<ExistenciasMatriz>('/admin/stock/existencias');
      return res || { lugares: [], insumos: [], alertas: [] };
    } catch {
      return { lugares: [], insumos: [], alertas: [] };
    }
  },

  // Movimientos
  registrarMovimiento: (data: {
    insumoId: string;
    lugarId: string;
    tipo: string;
    lugarDestinoId?: string;
    cantidad: number;
    unidad?: string;
    motivo?: string;
    accionAjuste?: string;
  }) => api.post('/admin/stock/movimientos', data),

  listarMovimientos: async (params?: {
    insumo?: string;
    lugar?: string;
    tipo?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    limite?: number;
  }): Promise<{
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
    items: MovimientoItem[];
  }> => {
    try {
      const sp = new URLSearchParams();
      if (params?.insumo) sp.set('insumo', params.insumo);
      if (params?.lugar) sp.set('lugar', params.lugar);
      if (params?.tipo) sp.set('tipo', params.tipo);
      if (params?.desde) sp.set('desde', params.desde);
      if (params?.hasta) sp.set('hasta', params.hasta);
      if (params?.pagina) sp.set('pagina', String(params.pagina));
      if (params?.limite) sp.set('limite', String(params.limite));
      const qs = sp.toString();
      const res = await api.get<{
        total: number;
        pagina: number;
        limite: number;
        totalPaginas: number;
        items: MovimientoItem[];
      }>(`/admin/stock/movimientos${qs ? `?${qs}` : ''}`);
      return (
        res || {
          total: 0,
          pagina: 1,
          limite: 20,
          totalPaginas: 0,
          items: [],
        }
      );
    } catch {
      return {
        total: 0,
        pagina: 1,
        limite: 20,
        totalPaginas: 0,
        items: [],
      };
    }
  },

  // Recetas
  listarRecetas: async (): Promise<{
    productos: ProductoRecetaItem[];
    totalProductos: number;
    platosSinMargen: number;
  }> => {
    try {
      const res = await api.get<{
        productos: ProductoRecetaItem[];
        totalProductos: number;
        platosSinMargen: number;
      }>('/admin/stock/recetas');
      return (
        res || {
          productos: [],
          totalProductos: 0,
          platosSinMargen: 0,
        }
      );
    } catch {
      return {
        productos: [],
        totalProductos: 0,
        platosSinMargen: 0,
      };
    }
  },

  obtenerReceta: async (productoId: string): Promise<RecetaProductoDetalle> => {
    return await api.get<RecetaProductoDetalle>(`/admin/stock/recetas/${productoId}`);
  },

  guardarReceta: (
    productoId: string,
    data: {
      tamano_valor_id?: string | null;
      es_produccion?: boolean;
      rinde?: number;
      lineas: Array<{ insumo_id: string; cantidad: number }>;
    },
  ) => api.put(`/admin/stock/recetas/${productoId}`, data),

  // Ajustes de opción
  guardarAjusteOpcion: (data: {
    opcion_id: string;
    insumo_id: string;
    accion: 'SUMA' | 'QUITA' | 'REEMPLAZA';
    insumo_reemplazado_id?: string | null;
    cantidad: number;
  }) => api.put(`/admin/recetas/opciones/${data.opcion_id}`, data),

  listarAjustesOpcion: async (opcionId: string): Promise<AjusteOpcionItem[]> => {
    try {
      const res = await api.get<AjusteOpcionItem>(`/admin/recetas/opciones/${opcionId}`);
      return res ? [res] : [];
    } catch {
      return [];
    }
  },
};

