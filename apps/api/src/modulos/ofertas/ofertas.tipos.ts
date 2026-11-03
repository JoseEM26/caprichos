export type TipoOferta = 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO';
export type TipoDescuento = 'PORCENTAJE' | 'MONTO';
export type TipoComboParte = 'A_ELECCION' | 'UNA_DE' | 'FIJO';
export type ModoCupon = 'UNICO_COMPROBANTE' | 'COMPARTIDO';
export type EstadoCuponEmitido = 'VIGENTE' | 'CANJEADO' | 'VENCIDO' | 'ANULADO';

export interface ComboPrecioItem {
  tamanoValorId: string;
  tamanoNombre?: string;
  precio: number;
}

export interface ComboParteItem {
  id?: string;
  tipo: TipoComboParte;
  cantidad: number;
  categorias: string[];
  productos: string[];
  /** Plan B, plan C...: ids de producto en orden (solo FIJO). */
  reemplazos?: string[];
  reemplazosDetalle?: { id: string; nombre: string }[];
  /** Calculado en tiempo real. FIJO: principal si está, si no los reemplazos disponibles en orden. */
  disponible?: boolean;
  opcionesDisponibles?: string[];
  principalNombre?: string;
}

export interface OfertaItem {
  id: string;
  tipo: TipoOferta;
  nombre: string;
  descripcion: string | null;
  lleva: number | null;
  paga: number | null;
  alcanceCategoriaId: string | null;
  alcanceProductoId: string | null;
  descuentoTipo: TipoDescuento | null;
  descuentoValor: number | null;
  compraMinima: number | null;
  dias: number[];
  horaDesde: string | null;
  horaHasta: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  canales: string[];
  limiteUsos: number | null;
  usosActuales: number;
  noSumaBeneficios: boolean;
  /** Se muestra en el saludo del chat de WhatsApp (una sola, la de menor orden vigente) */
  mostrarEnSaludoBot: boolean;
  /** Descuento solo para la primera compra del cliente con sesión (celular sin pedidos válidos) */
  soloPrimeraCompra: boolean;
  orden: number;
  activo: boolean;
  creadoEn: string;
  combosPrecio?: ComboPrecioItem[];
  combosParte?: ComboParteItem[];
  /** Solo combos: se puede armar ahora (no cambia `activo`). */
  disponible?: boolean;
  motivoAgotado?: string | null;
  categoriaNombre?: string | null;
  productoNombre?: string | null;
  vigenteAhora?: boolean;
  imagenArchivoId?: string | null;
  imagenUrl?: string | null;
}

export interface ReglaAcumulacionItem {
  id: number;
  cuponConDescuento: boolean;
  promoConDescuento: boolean;
  cuponesPorComprobante: number;
  textoPie: string | null;
}

export interface CuponItem {
  id: string;
  modo: ModoCupon;
  codigoBase: string;
  descripcion: string | null;
  descuentoTipo: TipoDescuento;
  descuentoValor: number;
  compraMinima: number | null;
  categoriaId: string | null;
  productoId: string | null;
  canales: string[];
  requiereCuenta: boolean;
  diasValidez: number | null;
  topeUsos: number | null;
  usosActuales: number;
  maxPorCliente: number | null;
  orden: number;
  activo: boolean;
  creadoEn: string;
  categoriaNombre?: string | null;
  productoNombre?: string | null;
}

export interface CuponEmitidoItem {
  id: string;
  cuponId: string;
  codigo: string;
  pedidoOrigenId: string | null;
  venceEn: string | null;
  estado: EstadoCuponEmitido;
  canjeadoEn: string | null;
  pedidoCanjeId: string | null;
  motivoAnulacion: string | null;
  anuladoEn: string | null;
  anuladoPor: string | null;
  creadoEn: string;
  cuponCodigoBase?: string;
  cuponDescripcion?: string | null;
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export interface DetalleDescuentoAplicado {
  tipo: 'DESCUENTO' | 'CUPON' | 'PROMO';
  id?: string;
  codigo?: string;
  nombre: string;
  descuentoTipo: TipoDescuento;
  descuentoValor: number;
  montoDescontado: number;
  alcance?: 'TODA' | 'CATEGORIA' | 'PRODUCTO';
  alcanceId?: string | null;
  lineasAfectadas?: Array<{
    productoId: string;
    cantidad: number;
    subtotal: number;
    descuento: number;
  }>;
}

export interface DesgloseDescuentosPedido {
  descuentoTotal: number;
  ofertaId: string | null;
  cuponId: string | null;
  cuponEmitidoId: string | null;
  detalles: DetalleDescuentoAplicado[];
}
