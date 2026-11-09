export type TipoOferta = 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'ENVIO_GRATIS';
export type TipoDescuento = 'PORCENTAJE' | 'MONTO' | 'ENVIO_GRATIS';
export type TipoComboParte = 'A_ELECCION' | 'UNA_DE' | 'FIJO';
export type ModoCupon = 'UNICO_COMPROBANTE' | 'COMPARTIDO';
export type EstadoCuponEmitido = 'VIGENTE' | 'CANJEADO' | 'VENCIDO' | 'ANULADO';

export interface ComboPrecioItem {
  tamanoValorId: string;
  tamanoNombre?: string;
  precio: number;
}

/** Opción de una parte A_ELECCION con lista de productos. Producto por sabor: cada sabor con su saldo. */
export interface OpcionDetalleCombo {
  id: string;
  nombre: string;
  disponible: boolean;
  /** Bloqueada por saldo 0 (producto o sabores), no por agotado a mano. */
  sinStock?: boolean;
  /** Foto del producto (bebidas por categorías). */
  fotoUrl?: string;
  /** Nombre de la categoría del producto: la carta arma chips (Frappes, Iced...) cuando hay dos o más. */
  categoria?: string;
  sabores?: { id: string; nombre: string; disponible: boolean; saldo: number }[];
}

/** Alternativa de una parte: producto y cantidad («si no hay stock, el cliente podrá elegir»). Mismo precio del combo. */
export interface AlternativaParteItem extends OpcionDetalleCombo {
  cantidad: number;
}

export interface ComboParteItem {
  id?: string;
  tipo: TipoComboParte;
  cantidad: number;
  categorias: string[];
  productos: string[];
  /** Alternativas en orden. Entrada: producto y cantidad; salida: además su disponibilidad ahora. */
  alternativas?: AlternativaParteItem[];
  /** Calculado en tiempo real: el original no alcanza y hay alguna alternativa con stock. */
  alternativasActivas?: boolean;
  /** Complemento a elegir: las partes con el mismo grupo se reparten en paquetes por nombre y el cliente elige UNO. Null = parte normal. */
  paqueteGrupo?: string | null;
  paqueteNombre?: string | null;
  /** Sabores permitidos en la parte (id de sabor); vacío = todos. */
  saboresIds?: string[];
  /** Productos que no entran en la parte aunque su categoría sí. */
  productosExcluidos?: string[];
  /**
   * Parte FIJO opcional: el cliente puede quitarla o pedir extras. `cantidad` = unidades incluidas en el precio;
   * puede llevar de `cantidadMin` (0) a `cantidadMax` (null = `cantidad`); cada unidad sobre las incluidas cobra `precioExtra`.
   */
  opcional?: boolean;
  cantidadMin?: number;
  cantidadMax?: number | null;
  incluidaPorDefecto?: boolean;
  precioExtra?: number | null;
  /** FIJO de un producto: tamaño elegido (producto_tamano) y su nombre; las unidades las usa el stock. */
  tamanoId?: string | null;
  tamanoNombre?: string | null;
  tamanoUnidades?: number;
  /** Calculado en tiempo real. FIJO: principal si está, si no las alternativas disponibles en orden. */
  disponible?: boolean;
  opcionesDisponibles?: string[];
  principalNombre?: string;
  /** A_ELECCION con lista de productos: cada opción y si se puede elegir ahora (sin saldo = no). */
  opcionesDetalle?: OpcionDetalleCombo[];
  /** Calculado: parte de bebidas por categorías (el cliente elige «Bebida 1..N»); sus opciones van en `opcionesDetalle`. */
  bebidas?: boolean;
}

export interface OfertaItem {
  id: string;
  tipo: TipoOferta;
  nombre: string;
  descripcion: string | null;
  lleva: number | null;
  paga: number | null;
  alcanceCategoriaId: string | null;
  /** Todas las categorías del alcance (una sola marcada = lista de uno). */
  alcanceCategoriaIds: string[];
  categoriasNombres?: string[];
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
  /** Tipos de pedido donde vale (COMER_LOCAL, LLEVAR, RECOGER, DELIVERY). Vacío = todos. */
  modalidades: string[];
  limiteUsos: number | null;
  usosActuales: number;
  noSumaBeneficios: boolean;
  /** Se muestra en el saludo del chat de WhatsApp (una sola, la de menor orden vigente) */
  mostrarEnSaludoBot: boolean;
  /** Descuento solo para la primera compra del cliente con sesión (celular sin pedidos válidos) */
  soloPrimeraCompra: boolean;
  orden: number;
  activo: boolean;
  /** Se muestra en la carta virtual (el descuento sigue vigente aunque esté oculta) */
  visibleCarta: boolean;
  creadoEn: string;
  combosPrecio?: ComboPrecioItem[];
  combosParte?: ComboParteItem[];
  /** Solo combos: se puede armar ahora (no cambia `activo`). */
  disponible?: boolean;
  motivoAgotado?: string | null;
  /** Solo panel: piezas del combo que lo bloquean y por qué («Agotado hasta 15:40», «Stock 0»). */
  piezasBloqueadas?: { productoId: string; nombre: string; motivo: string }[];
  /** Combo no armable porque sus productos se acabaron (saldo 0): la carta dice «No disponible», no «Agotado». */
  sinStock?: boolean;
  /** Última vez que alguien la desactivó a mano (de la auditoría); solo en el listado del panel. */
  desactivadaEn?: string | null;
  desactivadaPor?: string | null;
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
  /** Horario del cupón (vacío = siempre): días 1..7, hora desde inclusiva, hasta exclusiva, fechas inclusivas. */
  dias?: number[];
  horaDesde?: string | null;
  horaHasta?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
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
  alcanceIds?: string[];
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
  /** El cupón canjeado da envío gratis (no descuenta productos). Solo delivery; lo aplica el pedido. */
  envioGratisCupon?: boolean;
}

/** Una línea de cocina que sale de una parte de combo (FIJO o A_ELECCION), por producto. */
export interface ParteResueltaCombo {
  parteId: bigint;
  tipo: 'FIJO' | 'A_ELECCION';
  productoId: bigint;
  nombre: string;
  /** Unidades de este producto (parte.cantidad × unidades del combo, o las elegidas). */
  cantidad: number;
  areaId: bigint | null;
  areaNombre: string | null;
  categoriaNombre: string | null;
  /** Texto para la comanda: el cambio de reemplazo, «EXTRA +n», «SIN …» y «Combo: …». */
  nota: string;
  /** Parte opcional: unidades por encima de las incluidas (por todo el pedido de combos), para el marcador EXTRA. */
  extras?: number;
  /** Tamaño de la parte (nombre, p. ej. «Regular 12 oz») y sus unidades: van a la línea hija y al stock. */
  tamano?: string | null;
  unidadesTamano?: number;
  /** Producto por sabor: unidades de cada sabor elegido (suman la cantidad de la parte). Sin sabor, no va. */
  sabores?: { saborId: bigint; nombre: string; cantidad: number }[];
}

export interface ResolucionCombo {
  /** Nota de la línea madre (reemplazos del combo), como antes. */
  nota: string;
  partes: ParteResueltaCombo[];
  /** El combo tiene una parte de bebidas por categorías: los grupos «Bebida N · Sabor» del anfitrión no se exigen. */
  conBebidas?: boolean;
  /** Cobro extra por cada combo pedido (partes opcionales sobre lo incluido): se suma al precio unitario de la línea. */
  recargoPorCombo?: number;
}
