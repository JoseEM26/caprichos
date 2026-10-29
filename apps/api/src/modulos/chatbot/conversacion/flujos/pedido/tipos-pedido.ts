/**
 * Estados específicos del flujo transaccional de Pedido por WhatsApp (Ola 2, Agente C).
 */
export type EstadoPedidoFlujo =
  | 'PEDIDO_MODALIDAD'
  | 'PEDIDO_UBICACION'
  | 'PEDIDO_DIRECCION_ELEGIR'
  | 'PEDIDO_DIRECCION_TEXTO'
  | 'PEDIDO_REFERENCIA'
  | 'PEDIDO_CATEGORIAS'
  | 'PEDIDO_PRODUCTOS'
  | 'PEDIDO_TAMANO'
  | 'PEDIDO_GRUPO_OPCION'
  | 'PEDIDO_SABOR'
  | 'PEDIDO_NOTA'
  | 'PEDIDO_NOMBRES_ENVASE'
  | 'PEDIDO_NOMBRES_CONFIRMAR'
  | 'PEDIDO_CANTIDAD'
  | 'PEDIDO_ACCION_CARRITO'
  | 'PEDIDO_VER_CARRITO'
  | 'PEDIDO_QUITAR_ITEM'
  | 'PEDIDO_OFERTA_APLICAR'
  | 'PEDIDO_OFERTA_FALTA'
  | 'PEDIDO_PREGUNTA_CUPON'
  | 'PEDIDO_INGRESAR_CUPON'
  | 'PEDIDO_CONFIRMAR_NOMBRE'
  | 'PEDIDO_INGRESAR_NOMBRE'
  | 'PEDIDO_INGRESAR_TELEFONO'
  | 'PEDIDO_MEDIO_PAGO'
  | 'PEDIDO_MONTO_EFECTIVO'
  | 'PEDIDO_COMPROBANTE_TIPO'
  | 'PEDIDO_COMPROBANTE_DNI'
  | 'PEDIDO_COMPROBANTE_RUC'
  | 'PEDIDO_COMPROBANTE_RAZON'
  | 'PEDIDO_PUNTOS_PREGUNTA'
  | 'PEDIDO_PUNTOS_NUMERO'
  | 'PEDIDO_RESUMEN_CONFIRMAR'
  | 'PEDIDO_CANCELAR_CONFIRMAR';

export interface OpcionElegidaBot {
  opcionId: string;
  nombre: string;
  precioExtra: number;
  grupoId?: string;
  grupoNombre?: string;
}

export interface LineaCarritoBot {
  lineaId: string;
  productoId: string;
  productoNombre: string;
  categoriaId: string;
  categoriaNombre: string;
  tamanoId?: string;
  tamanoNombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  opciones: OpcionElegidaBot[];
  sabor?: string;
  nota?: string;
  noSumaBeneficios: boolean;
  /** Un nombre por envase (bebidas): va en la etiqueta pegada al envase */
  personas?: string[];
}

export interface ItemEnConfiguracionBot {
  productoId: string;
  productoNombre: string;
  categoriaId: string;
  categoriaNombre: string;
  tamanoId?: string;
  tamanoNombre?: string;
  precioBase: number;
  opciones: OpcionElegidaBot[];
  grupoIndexActual: number;
  sabor?: string;
  nota?: string;
  cantidad: number;
  noSumaBeneficios: boolean;
  /** Nombres de envase ya escritos mientras se pregunta uno por uno */
  nombresEnvase?: string[];
}

export interface DatosEntregaBot {
  modalidad: 'DELIVERY' | 'RECOGER';
  direccion?: string;
  referencia?: string;
  lat?: number;
  lng?: number;
  origen?: 'GPS' | 'ESCRITA' | 'MAPA' | 'WHATSAPP' | 'ENLACE';
  zonaId?: string;
  zonaNombre?: string;
  tarifaEnvio?: number | null;
}

export interface DatosClienteBot {
  nombre?: string;
  telefono?: string;
}

export interface DatosPagoBot {
  metodo?: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';
  pagaCon?: number;
}

export interface DatosComprobanteBot {
  tipo: 'BOLETA' | 'FACTURA' | 'NINGUNO';
  dni?: string;
  ruc?: string;
  razonSocial?: string;
}

/**
 * Estado completo del carrito y progreso del pedido persistido en `conversacion.flujo.pedido`.
 */
export interface EstadoCarritoPedido {
  estadoInterno: EstadoPedidoFlujo;
  modalidad?: 'DELIVERY' | 'RECOGER';
  entrega?: DatosEntregaBot;
  cliente?: DatosClienteBot;
  items: LineaCarritoBot[];
  telefonoSugerido?: string;
  itemEnConfiguracion?: ItemEnConfiguracionBot;
  paginaCategorias?: number;
  paginaProductos?: number;
  categoriaSeleccionadaId?: string;
  productoSeleccionadoId?: string;
  descuentoAplicado?: number;
  descuentoNombre?: string;
  ofertaPendiente?: {
    id: string;
    nombre: string;
    ahorro: number;
  };
  ofertaFaltaPoco?: {
    id: string;
    nombre: string;
    faltan: number;
    miss: string[];
    precio: number;
  };
  ofertasRechazadas?: string[];
  cuponCodigo?: string;
  cuponDescuento?: number;
  cuponPreguntado?: boolean;
  pago?: DatosPagoBot;
  comprobante?: DatosComprobanteBot;
  idempotenciaPaso?: string;
  timestampUltimaAccion?: number;
  estadoPrevioCancelacion?: EstadoPedidoFlujo;
  /** Ya se resolvió a qué cuenta suman los puntos de este pedido */
  puntosResuelto?: boolean;
  /** Qué se le está preguntando al cliente en PEDIDO_PUNTOS_PREGUNTA */
  puntosModo?: 'PROPIA' | 'RECORDATORIO' | 'DICTADO_CONFIRMAR';
  /** Cuenta encontrada con el número dictado, a la espera del Sí del cliente */
  puntosPendiente?: { partyId: string; terminacion: string };
}
