import { api } from '../../comun/api';

export interface AlmacenResumen {
  alertasStockBajo: number;
  movimientosHoy: number;
  conteosPorTipo: {
    ENTRADA: number;
    SALIDA: number;
    MERMA: number;
    DEVOLUCION: number;
    AJUSTE: number;
  };
}

export interface MovimientoItem {
  id: string;
  fecha: string;
  fechaFormateada: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'AJUSTE' | 'ANULACION';
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
  unidad: string;
  cantidadTexto: string;
  origen: string;
  destino: string;
  documento: string;
  motivo?: string;
  nota?: string;
  responsable?: string;
  esAnulable: boolean;
}

export interface RecetaProduccionItem {
  id: string;
  nombre: string;
  rindePorTanda: number;
  unidadResultado: string;
  productoNombre?: string;
  insumos: Array<{
    insumoId: string;
    nombre: string;
    cantidadPorTanda: number;
    unidad: string;
    stockCocina: number;
    stockAlmacen: number;
  }>;
}

export interface LugarItem {
  id: string;
  nombre: string;
  tipo: string;
}

export interface InsumoStockItem {
  id: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  costoUnit: number;
}

export interface RegistrarMovimientoDto {
  tipo: 'ENTRADA' | 'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'AJUSTE';
  insumoId: string | number;
  cantidad: number;
  origen: string;
  destino?: string;
  motivo?: string;
  nota?: string;
}

export interface RegistrarProduccionDto {
  recetaId: string | number;
  unidadesObtenidas?: number;
  tandas?: number;
  unidadesReales?: number;
}

export interface ProductoCierreDiaItem {
  productoId?: string;
  insumoId?: string;
  nombre: string;
  sistema: number;
  unidad: string;
}

export interface FilaCierreDiaDto {
  insumoId?: string | number;
  productoId?: string | number;
  nombre: string;
  sistema: number;
  contado: number;
  botar: number;
  destino: string;
  unidad?: string;
}

export interface CierreDiaDto {
  lugarId?: string | number;
  fecha?: string;
  filas: FilaCierreDiaDto[];
}

export type CierreDiaResumen = ProductoCierreDiaItem[];
export type CerrarDiaDto = CierreDiaDto;

export interface ListarMovimientosRespuesta {
  conteos: {
    todos: number;
    entradas: number;
    salidas: number;
    mermas: number;
    devoluciones: number;
  };
  movimientos: MovimientoItem[];
}

export const almacenApi = {
  listarMovimientos: async (filtros?: { tipo?: string; insumoId?: string; buscar?: string; desde?: string; hasta?: string }): Promise<ListarMovimientosRespuesta> => {
    const params = new URLSearchParams();
    if (filtros?.tipo && filtros.tipo !== 'Todos') params.append('tipo', filtros.tipo);
    if (filtros?.insumoId) params.append('insumoId', filtros.insumoId);
    if (filtros?.buscar) params.append('q', filtros.buscar);
    if (filtros?.desde) params.append('desde', filtros.desde);
    if (filtros?.hasta) params.append('hasta', filtros.hasta);
    const qs = params.toString();
    const res = await api.get<any>(`/admin/almacen/movimientos${qs ? `?${qs}` : ''}`);
    if (res && Array.isArray(res.movimientos)) {
      return {
        conteos: res.conteos || { todos: 0, entradas: 0, salidas: 0, mermas: 0, devoluciones: 0 },
        movimientos: res.movimientos.map((m: any) => ({
          id: String(m.id),
          fecha: m.fecha,
          fechaFormateada: m.fecha,
          tipo: m.tipoRaw || m.tipo?.toUpperCase(),
          insumoId: String(m.insumoId || ''),
          insumoNombre: m.insumo,
          cantidad: m.cantidadNum || 0,
          unidad: m.cantidad?.split(' ')[1] || '',
          cantidadTexto: m.cantidad,
          origen: m.origen,
          destino: m.destino,
          documento: m.documento,
          nota: m.nota,
          esAnulable: !m.anulado && !['VENTA', 'ANULACION'].includes(String(m.tipoRaw || m.tipo).toUpperCase()),
        })),
      };
    }
    return {
      conteos: { todos: 0, entradas: 0, salidas: 0, mermas: 0, devoluciones: 0 },
      movimientos: [],
    };
  },

  registrarMovimiento: (dto: RegistrarMovimientoDto) =>
    api.post<MovimientoItem>('/admin/almacen/movimientos', dto),

  anularMovimiento: (id: string, motivo: string, codigoSupervisor?: string) => {
    const headers: Record<string, string> = {};
    if (codigoSupervisor?.trim()) {
      headers['x-codigo-supervisor'] = codigoSupervisor.trim();
      headers['x-pin-supervisor'] = codigoSupervisor.trim();
    }
    return api.post<{ ok: boolean }>(
      `/admin/almacen/movimientos/${id}/anular`,
      { motivo },
      { headers },
    );
  },

  listarRecetasProduccion: () =>
    api.get<RecetaProduccionItem[]>('/admin/almacen/produccion/recetas'),

  registrarProduccion: (dto: RegistrarProduccionDto) =>
    api.post<{ ok: boolean; documento: string; tandas: number; unidades: number }>('/admin/almacen/produccion', dto),

  obtenerProductosCierreDia: () =>
    api.get<ProductoCierreDiaItem[]>('/admin/almacen/cierre-dia/productos'),

  obtenerResumenCierreDia: () =>
    api.get<ProductoCierreDiaItem[]>('/admin/almacen/cierre-dia/productos'),

  cerrarDia: (dto: CierreDiaDto) =>
    api.post<{ ok: boolean; id?: string }>('/admin/almacen/cierre-dia', dto),

  listarLugares: () =>
    api.get<LugarItem[]>('/admin/stock/lugares'),

  listarPedidosInternos: async (): Promise<any[]> => {
    return api.get<any[]>('/admin/almacen/pedidos-internos');
  },

  entregarPedidoInterno: async (id: string): Promise<any> => {
    return api.post<any>(`/admin/almacen/pedidos-internos/${id}/entregar`);
  },

  listarInsumos: async (): Promise<InsumoStockItem[]> => {
    const res = await api.get<any[]>('/admin/stock/insumos');
    if (!Array.isArray(res)) return [];
    return res.map((i) => ({
      id: String(i.id),
      nombre: i.nombre,
      unidad: i.unidad_almacen || i.unidad || '',
      stockActual: Number(i.stock_total ?? i.stockActual ?? 0),
      stockMinimo: Number(i.minimo ?? i.stockMinimo ?? 0),
      costoUnit: Number(i.costo_unit ?? i.costoUnit ?? 0),
    }));
  },
};
