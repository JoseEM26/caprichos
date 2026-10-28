export type ColorComanda = 'VERDE' | 'NARANJA' | 'ROJO';

export interface AreaCocina {
  id: string;
  nombre: string;
  propia?: boolean;
  comandasPendientes?: number;
  comandas_pendientes?: number;
}

export interface LineaComanda {
  id: string;
  nombre: string;
  cantidad: number;
  tamano?: string | null;
  sabor?: string | null;
  combo?: string | null;
  combo_nombre?: string | null;
  opciones?: Array<string | { id?: string; nombre: string; grupo?: string }>;
  personas?: string[];
  nota?: string | null;
  area?: string;
}

/** Una de las áreas de un pedido: si ya despejó y sus líneas. */
export interface AreaComandaPedido {
  areaId: string;
  areaNombre: string;
  despejada: boolean;
  lineas: LineaComanda[];
}

export interface Comanda {
  id: string;
  pedidoId: string;
  areaId: string;
  areaNombre: string;
  ticket: string;
  codigo: string;
  canal: string;
  modalidad: string;
  cliente?: string | null;
  mesa?: string | null;
  mozo?: string | null;
  nota?: string | null;
  minutos: number;
  minutosEspera?: number;
  color: ColorComanda;
  colorEspera?: ColorComanda;
  llego_en?: string;
  creado_en: string;
  lineas: LineaComanda[];
  /** La propia área ya despejó: la comanda es solo seguimiento (sin Despejar). */
  despejada?: boolean;
  /** Todas las áreas del pedido con su estado (la propia incluida). */
  areas?: AreaComandaPedido[];
}

export interface HistorialComanda {
  id: string;
  pedidoId: string;
  areaId: string;
  areaNombre: string;
  ticket: string;
  codigo: string;
  canal: string;
  modalidad: string;
  mesa?: string | null;
  llego_en: string | null;
  despejada_en: string | null;
  despejada_por?: string | null;
  tiempoPreparacionMin: number;
  lineas: LineaComanda[];
}

export interface AreaDespacho {
  areaId: string;
  areaNombre: string;
  despejado: boolean;
  estado: string;
  despejada_en: string | null;
}

export interface PedidoDespacho {
  id: string;
  codigo: string;
  ticket: string;
  cliente: string | null;
  cliente_nombre?: string | null;
  estado: string;
  canal: string;
  modalidad: string;
  mesa?: string | null;
  creado_en: string;
  listo_en: string | null;
  areas: AreaDespacho[];
  completo: boolean;
  estadoDespacho: string;
}

export type TipoAgotado = 'PRODUCTO' | 'SABOR' | 'OPCION';
export type DuracionAgotado = 'HOY' | 'HASTA_REACTIVAR';

export interface AgotadoItem {
  id: string;
  tipo: TipoAgotado;
  alcance: string;
  duracion: string;
  productoId?: string | null;
  producto_id?: string | null;
  productoNombre?: string | null;
  saborId?: string | null;
  sabor_id?: string | null;
  saborNombre?: string | null;
  opcionId?: string | null;
  opcion_id?: string | null;
  opcionNombre?: string | null;
  nombre?: string | null;
  desde: string;
  hasta: string | null;
  por: string;
  activado_por?: string | null;
}

export interface AltaDemandaEstado {
  activa: boolean;
  minutos: number;
  pausa: boolean;
  desde?: string;
  por?: string;
  mensaje?: string;
  activado_por?: string;
}

export interface ItemCartaBuscable {
  tipo: TipoAgotado;
  id: string;
  nombre: string;
  subtitulo: string;
  categoriaNombre?: string;
  fotoUrl?: string | null;
  categoriaId?: string;
  precio?: number;
  sabores?: Array<{ id: string; nombre: string; disponible: boolean }>;
  opciones?: Array<{ id: string; nombre: string; disponible: boolean; grupoNombre?: string }>;
}

export interface InsumoExistenciaCocina {
  insumoId: string;
  nombre: string;
  unidad: string;
  stockCocina: number;
  stockMinimo: number;
  stockAlmacen: number;
}

export interface PedidoInternoItem {
  id: string;
  area: string;
  detalle: {
    items: Array<{ insumoId?: string | number; insumo: string; cantidad: number; unidad?: string }>;
    nota?: string | null;
  };
  estado: string; // 'PENDIENTE' | 'ENTREGADO' | 'RECIBIDO'
  en: string;
}

export interface TrasladoItem {
  id: string;
  insumoId: string;
  insumoNombre: string;
  destino: string;
  enviado: number;
  recibido: number | null;
  diferencia: number | null;
  estado: string; // 'POR_RECIBIR' | 'RECIBIDO'
  enviadoEn: string;
  recibidoEn?: string | null;
}

