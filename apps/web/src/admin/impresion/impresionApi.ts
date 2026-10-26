import { api } from '../../comun/api';
import { EstadoAdminImpresion, EstadoImpresora } from '@caprichos/compartido';

export interface TrabajoImpresionAdmin {
  id: string;
  pedidoId: string;
  pedidoCodigo: string;
  clienteNombre: string;
  tipo: string;
  estado: string;
  intentos: number;
  error?: string | null;
  copia: boolean;
  en: string;
  tomadoEn?: string | null;
  impresoEn?: string | null;
  payload: any;
}

export interface LlaveAgenteAdmin {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
  ultimoLatido?: string | null;
  version?: string | null;
  impresora?: EstadoImpresora | null;
  llaveMuestra: string;
}

export interface RespuestaCrearLlave {
  id: string;
  nombre: string;
  llave: string;
  creadoEn: string;
  mensaje: string;
}

export const impresionApi = {
  obtenerEstado: async (): Promise<EstadoAdminImpresion> => {
    return api.get<EstadoAdminImpresion>('/admin/impresion/estado');
  },

  listarTrabajos: async (filtros?: {
    estado?: string;
    pedido?: string;
    pagina?: number;
    limite?: number;
  }): Promise<{ items: TrabajoImpresionAdmin[]; total: number; pagina: number; paginas: number }> => {
    const params = new URLSearchParams();
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.pedido) params.set('pedido', filtros.pedido);
    if (filtros?.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros?.limite) params.set('limite', String(filtros.limite));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api.get(`/admin/impresion/trabajos${qs}`);
  },

  reintentarTrabajo: async (id: string): Promise<{ ok: boolean; mensaje: string }> => {
    return api.post(`/admin/impresion/trabajos/${id}/reintentar`);
  },

  reimprimirEtiquetas: async (
    pedidoId: string,
    tipo: 'general' | 'area' | 'bebida',
    areaId?: string,
    indice?: number,
  ): Promise<{ ok: boolean; mensaje: string; cantidad?: number }> => {
    return api.post(`/admin/pedidos/${pedidoId}/etiquetas/reimprimir`, {
      tipo,
      area_id: areaId,
      indice,
    });
  },

  listarLlaves: async (): Promise<LlaveAgenteAdmin[]> => {
    return api.get<LlaveAgenteAdmin[]>('/admin/impresion/llaves');
  },

  crearLlave: async (nombre?: string): Promise<RespuestaCrearLlave> => {
    return api.post<RespuestaCrearLlave>('/admin/impresion/llaves', { nombre });
  },

  desactivarLlave: async (id: string): Promise<{ ok: boolean; mensaje: string }> => {
    return api.patch<{ ok: boolean; mensaje: string }>(`/admin/impresion/llaves/${id}/desactivar`);
  },
};
