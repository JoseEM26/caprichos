export type SemaforoColor = 'rojo' | 'naranja' | 'verde';
export type EstadoInsumoTexto = 'Agotado' | 'Poco' | 'Por acabarse' | 'Bien' | 'Lleno';

export interface LugarStockItem {
  id: string;
  nombre: string;
  tipo: string;
  area_id: string | null;
  areaNombre?: string | null;
}

export interface InsumoStockPorLugar {
  lugarId: string;
  lugarNombre: string;
  cantidad: number;
}

export interface InsumoItem {
  id: string;
  nombre: string;
  unidad_compra: string;
  unidad_almacen: string;
  unidad_receta: string;
  factor_compra: number;
  factor_receta: number;
  minimo: number;
  intermedio: number | null;
  maximo: number;
  costo_unit: number | null;
  /** Merma habitual % (el API solo la manda si es mayor que 0) */
  merma_pct?: number;
  lugar_consumo_id: string | null;
  lugar_consumo_nombre: string | null;
  proveedor_a: string | null;
  proveedor_b: string | null;
  proveedor_c: string | null;
  activo: boolean;
  stock_total: number;
  stock_por_lugar: InsumoStockPorLugar[];
  semaforo: SemaforoColor;
  estado: EstadoInsumoTexto;
  porcentaje_llenado: number;
}

export interface MovimientoItem {
  id: string;
  tipo: string;
  insumoId: string | null;
  insumoNombre: string | null;
  unidadAlmacen: string | null;
  lugarId: string;
  lugarNombre: string;
  cantidad: number;
  nota: string | null;
  pedidoId: string | null;
  por: string;
  en: string;
}

export interface ProductoRecetaItem {
  id: string;
  nombre: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  tieneReceta: boolean;
  esProduccion?: boolean;
  tipoReceta?: 'VENTA' | 'PRODUCCION' | 'NINGUNA';
  rinde?: number | null;
  precio: number;
  costo: number | null;
  margenSoles: number | null;
  margenPorcentaje: number | null;
  cantidadTamanos: number;
}

export interface RecetaLineaCalculada {
  insumoId: string;
  insumoNombre: string;
  unidadReceta: string;
  cantidad: number;
  costoUnitarioReceta: number;
  subtotalCosto: number;
}

export interface RecetaTamanoDetalle {
  tamanoId: string;
  tamanoNombre: string;
  precio: number;
  costo: number | null;
  margenSoles: number | null;
  margenPorcentaje: number | null;
  tieneRecetaTamano: boolean;
  lineas: RecetaLineaCalculada[];
}

export interface RecetaProductoDetalle {
  productoId: string;
  productoNombre: string;
  categoria: string | null;
  tieneReceta: boolean;
  esProduccion?: boolean;
  tipoReceta?: 'VENTA' | 'PRODUCCION' | 'NINGUNA';
  rinde?: number | null;
  tamanos: RecetaTamanoDetalle[];
}

export interface ExistenciasMatriz {
  lugares: Array<{
    id: string;
    nombre: string;
    tipo: string;
    areaId: string | null;
    areaNombre: string | null;
  }>;
  insumos: Array<{
    id: string;
    nombre: string;
    unidadAlmacen: string;
    minimo: number;
    intermedio: number | null;
    maximo: number;
    lugarConsumoId: string | null;
    lugarConsumoNombre: string | null;
    existencias: Record<string, number>;
    total: number;
  }>;
  alertas: Array<{
    insumoId: string;
    nombre: string;
    lugarId: string;
    lugarNombre: string;
    saldo: number;
    minimo: number;
    tipo: 'NEGATIVO' | 'BAJO' | 'AGOTADO';
  }>;
}

export interface AjusteOpcionItem {
  opcionId: string;
  opcionNombre: string | null;
  insumoId: string;
  insumoNombre: string;
  efecto: 'SUMA' | 'QUITA' | 'REEMPLAZA';
  reemplazaInsumoId: string | null;
  reemplazaInsumoNombre: string | null;
  cantidad: number | null;
}
