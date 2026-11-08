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
  /** Producto por sabor: el desglose de lo que hay de cada sabor (su merma va por «Botar a merma»). */
  sabores?: Array<{ saborId: string; nombre: string; sistema: number }>;
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

/** Conteo de apertura de un sabor de un producto (donas, galletas con sabores). */
export interface AperturaSaborItem {
  saborId: string;
  nombre: string;
  saldo: number;
  aperturaHoy: boolean;
  aperturaCantidad: number | null;
  /** Lo que se produjo hoy (ya sumado al saldo). */
  producidoHoy: number;
  /** Lo que quedó de ayer: el saldo sin lo producido hoy. Se propone en la apertura y se puede corregir. */
  quedaronAyer: number;
}

/** Conteo de apertura del día: un producto controlado con su saldo y si ya se contó hoy. */
export interface AperturaProductoItem {
  productoId: string;
  nombre: string;
  areaNombre: string | null;
  saldo: number;
  aperturaHoy: boolean;
  aperturaCantidad: number | null;
  producidoHoy: number;
  quedaronAyer: number;
  /** Solo productos con sabores: el conteo se hace por sabor. */
  sabores?: AperturaSaborItem[];
}

export interface AperturaDiaRespuesta {
  /** YYYY-MM-DD (día de Lima) */
  fecha: string;
  productos: AperturaProductoItem[];
}

/**
 * ¿Falta contar hoy? Con sabores falta si algún sabor no tiene apertura; sin sabores, si el producto no la tiene.
 */
export function productoPendienteApertura(p: AperturaProductoItem): boolean {
  return p.sabores && p.sabores.length > 0 ? p.sabores.some((s) => !s.aperturaHoy) : !p.aperturaHoy;
}

/**
 * Una línea del envío: el producto entero o uno de sus sabores.
 * `cantidad` = lo que quedó de ayer (contado); `produccion` = lo que se produjo hoy (se suma).
 */
export type ItemApertura = { productoId: string; saborId?: string; cantidad: number; produccion?: number } & {
  /** Si la cantidad BAJA el saldo: el saldo que la pantalla vio, el motivo de la merma y su nota (obligatoria si es Otro). */
  saldoEsperado?: number;
  motivo?: MotivoMermaProducto;
  nota?: string;
};

export type MotivoMermaProducto =
  | 'SE_CAYO'
  | 'VENCIDO'
  | 'DANADO'
  | 'ERROR_COCINA'
  | 'DEGUSTACION'
  | 'CONSUMO_PERSONAL'
  | 'CONTEO'
  | 'OTRO';

/** Mismos motivos y orden que el servidor (stock/producto-controlado.ts). */
export const MOTIVOS_MERMA: Array<{ valor: MotivoMermaProducto; etiqueta: string }> = [
  { valor: 'SE_CAYO', etiqueta: 'Se cayó o se rompió' },
  { valor: 'VENCIDO', etiqueta: 'Vencido' },
  { valor: 'DANADO', etiqueta: 'Mal estado o dañado' },
  { valor: 'ERROR_COCINA', etiqueta: 'Error de cocina o preparación' },
  { valor: 'DEGUSTACION', etiqueta: 'Degustación o cortesía interna' },
  { valor: 'CONSUMO_PERSONAL', etiqueta: 'Consumo del personal' },
  { valor: 'CONTEO', etiqueta: 'Conteo o ajuste' },
  { valor: 'OTRO', etiqueta: 'Otro (con nota)' },
];

/** El motivo «Otro» exige una nota de al menos 5 letras. */
export const notaOtroValida = (nota?: string) => (nota?.trim().length ?? 0) >= 5;

export interface MermaHoy {
  id: string;
  producto: string;
  sabor: string | null;
  cantidad: number;
  motivo: string;
  nota: string | null;
  en: string;
  por: string | null;
  anulada: boolean;
}

export interface MermaProductoDto {
  productoId: string;
  saborId?: string;
  cantidad: number;
  motivo: MotivoMermaProducto;
  nota?: string;
}

export type GrupoHistorial = 'subidas' | 'pedidos' | 'mermas' | 'ajustes';
export interface EventoHistorial {
  id: string;
  categoria: string;
  grupo: GrupoHistorial;
  etiqueta: string;
  cantidad: number;
  saldoAntes: number;
  saldoDespues: number;
  fecha: string;
  hora: string;
  en: string;
  sabor: string | null;
  saborId: string | null;
  por: string | null;
  detalle: string | null;
  origenRegistrado: boolean;
  pedido?: {
    id: string;
    codigo: string;
    estado: string;
    modalidad: string;
    cliente: string | null;
    enlace: string;
    anulado: boolean;
    devuelto: number | null;
  };
}
export interface HistorialProductoRespuesta {
  producto: { id: string; nombre: string; sabores: Array<{ id: string; nombre: string }> };
  desde: string;
  hasta: string;
  sabor: string | null;
  resumen: { inicio: number; subido: number; vendido: number; mermas: number; ajustes: number; saldo: number; diferencia: number; cuadra: boolean };
  existenciaActual: number;
  truncado: boolean;
  pagina: number;
  porPagina: number;
  total: number;
  eventos: EventoHistorial[];
}

export const almacenApi = {
  /** Historial de movimientos de un producto (y sus sabores) por día de Lima (permiso almacen/apertura). */
  historialProducto: (
    productoId: string,
    f: { desde?: string; hasta?: string; sabor?: string; tipo?: string; pagina?: number } = {},
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') qs.append(k, String(v));
    return api.get<HistorialProductoRespuesta>(`/admin/almacen/productos/${productoId}/historial${qs.size ? `?${qs}` : ''}`);
  },

  /** Productos con control de stock propio y su conteo de apertura de hoy (permiso almacen/apertura). */
  obtenerApertura: () => api.get<AperturaDiaRespuesta>('/admin/almacen/apertura'),

  /** Registra el conteo de apertura de hoy; solo las líneas enviadas (producto o sabor). */
  registrarApertura: (items: ItemApertura[]) =>
    api.post<{ ok: true; registrados: number; mermas?: number }>('/admin/almacen/apertura', { items }),

  /** Mermas de productos de hoy (las que salen de Apertura), con motivo, hora y quién. */
  mermasHoy: () => api.get<{ fecha: string; mermas: MermaHoy[] }>('/admin/almacen/apertura/mermas'),


  /** Botar a merma de un producto o sabor (permiso almacen/merma_producto). */
  mermaProducto: (dto: MermaProductoDto) =>
    api.post<{ ok: true; id: string; saldo: number }>('/admin/almacen/merma-producto', dto),

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

  anularMovimiento: (id: string, motivo: string) =>
    api.post<{ ok: boolean }>(`/admin/almacen/movimientos/${id}/anular`, { motivo }),

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
