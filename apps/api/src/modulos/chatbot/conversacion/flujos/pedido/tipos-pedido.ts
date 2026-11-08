/**
 * Estados específicos del flujo transaccional de Pedido por WhatsApp (Ola 2, Agente C).
 */
export type EstadoPedidoFlujo =
  | 'PEDIDO_MODALIDAD'
  | 'PEDIDO_UBICACION'
  | 'PEDIDO_CATEGORIAS'
  | 'PEDIDO_PRODUCTOS'
  | 'PEDIDO_TAMANO'
  | 'PEDIDO_GRUPO_OPCION'
  | 'PEDIDO_SABOR'
  | 'PEDIDO_COMBO_PARTE'
  | 'PEDIDO_COMBO_CONFIRMAR'
  | 'PEDIDO_NOTA'
  | 'PEDIDO_NOMBRES_ENVASE'
  | 'PEDIDO_NOMBRES_CONFIRMAR'
  | 'PEDIDO_CANTIDAD'
  | 'PEDIDO_ACCION_CARRITO'
  | 'PEDIDO_VER_CARRITO'
  | 'PEDIDO_QUITAR_ITEM'
  | 'PEDIDO_OFERTA_APLICAR'
  | 'PEDIDO_OFERTA_FALTA'
  | 'PEDIDO_CONFIRMAR_NOMBRE'
  | 'PEDIDO_INGRESAR_NOMBRE'
  | 'PEDIDO_INGRESAR_TELEFONO'
  | 'PEDIDO_MEDIO_PAGO'
  | 'PEDIDO_MONTO_EFECTIVO'
  | 'PEDIDO_PAGO_DIV_MEDIO1'
  | 'PEDIDO_PAGO_DIV_MONTO'
  | 'PEDIDO_PAGO_DIV_MEDIO2'
  | 'PEDIDO_COMPROBANTE_TIPO'
  | 'PEDIDO_COMPROBANTE_DNI'
  | 'PEDIDO_COMPROBANTE_RUC'
  | 'PEDIDO_COMPROBANTE_RAZON'
  | 'PEDIDO_RESUMEN_CONFIRMAR'
  | 'PEDIDO_PROPINA'
  | 'PEDIDO_PROPINA_MONTO'
  | 'PEDIDO_CANCELAR_CONFIRMAR';

export interface OpcionElegidaBot {
  opcionId: string;
  nombre: string;
  precioExtra: number;
  grupoId?: string;
  grupoNombre?: string;
}

/** Sabor de un producto con stock por sabor: unidades que consume la línea (tamaño × cantidad). */
export interface SaborLineaBot {
  saborId: string;
  nombre: string;
  cantidad: number;
}

/** Opción de una parte del combo (alternativa o producto de la lista). Con sabores, cada unidad lleva su sabor. */
export interface OpcionComboBot {
  id: string;
  nombre: string;
  /** Alternativas: unidades por combo (p. ej. 2 galletas). */
  cantidad?: number;
  sabores?: { id: string; nombre: string; saldo: number }[];
}

/** Lo que el cliente elige en una parte del combo: la alternativa (plan B) o N opciones de una lista. */
export interface PasoComboBot {
  parteId: string;
  tipo: 'ALTERNATIVA' | 'ELECCION';
  /** Lo que falta (alternativa) o categoría de la lista (elección), para el texto del paso. */
  etiqueta: string;
  /** ELECCION: unidades por elegir (cantidad de la parte × cantidad del combo). ALTERNATIVA: una alternativa. */
  total: number;
  hechos: number;
  opciones: OpcionComboBot[];
  /** ALTERNATIVA elegida: faltan sus unidades (cantidad × combos) por repartir en sabores. */
  alternativa?: OpcionComboBot;
  /** Unidades de la alternativa ya con producto y sabor. */
  unidadesAlternativa?: number;
}

export interface EleccionComboBot {
  parteId: string;
  productoId: string;
  saborId?: string;
  /** «Sirena» o «Fresa (Dona)»: para el resumen. */
  nombre: string;
}

/** Combo en armado (o ya armado) dentro de una línea del bot. */
export interface ComboEnConfiguracionBot {
  ofertaId: string;
  nombre: string;
  pasos: PasoComboBot[];
  /** Paso en curso y página de la lista de opciones («Ver más»). */
  idx: number;
  pagina: number;
  elecciones: EleccionComboBot[];
  /** Partes con producto fijo que viajan solas (parte y producto). */
  fijas: { parteId: string; productoId: string; nombre: string }[];
  /** El combo trae sus bebidas por categoría como pasos: los grupos «Bebida N · Sabor» del producto no se preguntan. */
  ocultaGruposBebida?: boolean;
  /** Combos que lleva la línea: cada alternativa o lista pide cantidad × unidades elecciones. */
  unidades: number;
  /** Se pidió ya elegir las partes (evita repetir el paso al volver del nombre de envase). */
  partesListas?: boolean;
  /** El cliente vio el resumen y lo confirmó. */
  confirmado?: boolean;
  /** Producto con sabor elegido a la espera de su sabor. */
  saborDe?: { parteId: string; opcion: OpcionComboBot };
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
  /** Producto con stock por sabor: un solo sabor por línea (todas las unidades del tamaño) */
  sabores?: SaborLineaBot[];
  nota?: string;
  noSumaBeneficios: boolean;
  /** Un nombre por envase (bebidas): va en la etiqueta pegada al envase */
  personas?: string[];
  /** Combo con elecciones (mismo contrato que la carta): el servidor crea las líneas hijas y descuenta stock. */
  ofertaId?: string;
  comboElecciones?: { parteId: string; productoId: string; saborId?: string }[];
  /** Lo que lleva el combo, para el resumen («Club Sándwich», «Sirena»). */
  comboDetalle?: string[];
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
  sabores?: SaborLineaBot[];
  nota?: string;
  cantidad: number;
  noSumaBeneficios: boolean;
  /** Nombres de envase ya escritos mientras se pregunta uno por uno */
  nombresEnvase?: string[];
  /** Producto anfitrión de un combo vendible por el bot: tras la cantidad se eligen sus partes. */
  combo?: ComboEnConfiguracionBot;
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
  /** Tarifa de la zona (sin promociones), para recalcular el envio con la vista previa en los pasos siguientes */
  tarifaZona?: number | null;
}

export interface DatosClienteBot {
  nombre?: string;
  telefono?: string;
}

export type MedioPagoBot = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

export interface DatosPagoBot {
  metodo?: MedioPagoBot;
  pagaCon?: number;
  /** Pago dividido: monto por medio (mismo formato que pago.plan de PedidosService). */
  plan?: Array<{ medio: MedioPagoBot; monto: number }>;
}

export interface DatosComprobanteBot {
  tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA' | 'NINGUNO';
  dni?: string;
  ruc?: string;
  razonSocial?: string;
}

/**
 * Estado completo del carrito y progreso del pedido persistido en `conversacion.flujo.pedido`.
 */
export interface EstadoCarritoPedido {
  estadoInterno: EstadoPedidoFlujo;
  /** Pago dividido en curso: primer medio y su monto mientras se elige el segundo. */
  pagoDiv?: { medio1?: MedioPagoBot; monto1?: number };
  /** Propina opcional en soles (aparte de la venta). undefined = aún no se preguntó. */
  propina?: number;
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
  pago?: DatosPagoBot;
  comprobante?: DatosComprobanteBot;
  idempotenciaPaso?: string;
  timestampUltimaAccion?: number;
  estadoPrevioCancelacion?: EstadoPedidoFlujo;
}
