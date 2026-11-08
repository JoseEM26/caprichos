export type ColorComanda = 'VERDE' | 'NARANJA' | 'ROJO';

/** Minutos de espera a partir de los que la comanda pasa a naranja (atención) y a rojo (urgente). Vienen de Ajustes de cocina. */
export interface UmbralesCocina {
  naranjaMin: number;
  rojoMin: number;
}

export interface AreaCocina {
  id: string;
  nombre: string;
  propia?: boolean;
  comandasPendientes?: number;
  comandas_pendientes?: number;
}

/** «3 Fresa · 3 Oreo» si la línea reparte sus unidades por sabor; si no, el sabor simple (o null). */
export function textoSabores(l: { sabor?: string | null; sabores?: Array<{ nombre: string; cantidad: number }> }): string | null {
  const reparto = (l.sabores ?? []).map((s) => `${s.cantidad} ${s.nombre}`).join(' · ');
  return reparto || l.sabor || null;
}

export interface LineaComanda {
  /** Id de la línea del pedido: lo que se marca como lista o se despacha. */
  id: string;
  nombre: string;
  cantidad: number;
  /** Unidades ya listas en cocina (0..cantidad). */
  listas?: number;
  /** Unidades ya despachadas (entregadas al cliente o al mozo). */
  despachadas?: number;
  tamano?: string | null;
  sabor?: string | null;
  /** Reparto de unidades por sabor (producto por sabor): media docena = 3 Fresa + 3 Oreo. */
  sabores?: Array<{ nombre: string; cantidad: number }>;
  combo?: string | null;
  combo_nombre?: string | null;
  /** pocoPedida: esta opción elegida es la menos pedida de su grupo (últimos 30 días) y el producto tiene el check. */
  opciones?: Array<string | { id?: string; nombre: string; grupo?: string; pocoPedida?: boolean }>;
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
  /** Número del día en cocina (referencial). null en pedidos anteriores a la función. */
  numeroDia?: number | null;
  /** Pedido extra: código del pedido original («EXTRA de CP-W045») */
  extraDe?: string | null;
  /** Hora del servidor al responder (ISO): el navegador cuenta el tiempo con su desfase. */
  ahoraServidor?: string;
  /** Umbrales de color vigentes en el servidor. */
  umbrales?: UmbralesCocina;
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
  /** Número del día en cocina (referencial). */
  numeroDia?: number | null;
  canal: string;
  modalidad: string;
  mesa?: string | null;
  llego_en: string | null;
  despejada_en: string | null;
  despejada_por?: string | null;
  tiempoPreparacionMin: number;
  lineas: LineaComanda[];
}

export type TipoAgotado = 'PRODUCTO' | 'SABOR' | 'OPCION';
export type DuracionAgotado = 'HOY' | 'HASTA_REACTIVAR';

export interface AgotadoItem {
  id: string;
  tipo: TipoAgotado;
  /** MANUAL (no vuelve solo) o AUTOMATICO (saldo 0; vuelve al reponer). */
  origen?: 'MANUAL' | 'AUTOMATICO';
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


/** Una área dentro de un pedido de la pantalla Despacho: sus productos y si ya está lista. */
export interface AreaDespacho {
  areaId: string;
  areaNombre: string;
  listo: boolean;
  /** Lo de esta área ya salió en un despacho parcial. */
  despachada?: boolean;
  lineas: LineaComanda[];
}

/** Pedido completo (todas las áreas juntas) de la pantalla Despacho. */
export interface PedidoDespacho {
  pedidoId: string;
  codigo: string;
  modalidad: string;
  cliente: string | null;
  mesa: string | null;
  nota: string | null;
  creado_en: string;
  minutos: number;
  direccion: string | null;
  referencia: string | null;
  telefono: string | null;
  areas: AreaDespacho[];
  /** Todas sus áreas están listas. */
  completo: boolean;
  /** COLA o PREPARANDO mientras espera a Despacho; LISTO o posterior una vez despachado. */
  estado?: string;
  /** Ya pasó a LISTO (o salió): solo se ve con «Ver despachados». */
  despachado?: boolean;
  despachado_en?: string | null;
  atendido: boolean;
  atendido_en: string | null;
  atendido_por: string | null;
}

export interface DespachoRespuesta {
  ahoraServidor: string;
  umbrales: UmbralesCocina;
  pedidos: PedidoDespacho[];
}
