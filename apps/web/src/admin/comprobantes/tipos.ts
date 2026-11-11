export type TipoComprobante = 'NOTA_VENTA' | 'BOLETA' | 'FACTURA';

export type EstadoEmision = 'POR_EMITIR' | 'EMITIDO' | 'INTERNA';

export interface ComprobantePorEmitir {
  id: string;
  pedido_id: string;
  codigo?: string;
  codigo_pedido?: string;
  tipo: TipoComprobante | string;
  serie: string;
  numero: number;
  numero_texto: string;
  documento: string | null;
  razon_social: string | null;
  total: number;
  fecha: string;
  fecha_lima?: string;
  emision: EstadoEmision | string;
  copias_impresas: number;
}

export interface RespuestaListarPorEmitir {
  total: number;
  pagina: number;
  limite: number;
  elementos: ComprobantePorEmitir[];
}

export interface LocalEncabezado {
  nombre: string;
  razon_social: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  direccion_fiscal?: string | null;
  datos_fiscales_completos?: boolean;
  aviso_datos_fiscales?: string | null;
}

export interface DetalleLineaNotaVenta {
  id: string;
  nombre: string;
  cantidad: number;
  tamano?: string | null;
  sabor?: string | null;
  precio_unit: number;
  subtotal: number;
  opciones?: Array<{ id?: string; nombre: string; grupo?: string }>;
  nota?: string | null;
}

export interface PagoLineaNotaVenta {
  id: string;
  medio: string;
  monto: number;
  recibido?: number | null;
  vuelto?: number | null;
}

export interface NotaVentaDatos {
  titulo: string;
  local: LocalEncabezado;
  comprobante: {
    id: string;
    pedido_id: string;
    tipo: TipoComprobante | string;
    serie: string;
    numero: number;
    numero_texto: string;
    documento: string | null;
    razon_social: string | null;
    emision: EstadoEmision | string;
    copias_impresas: number;
    es_copia?: boolean;
    copia_numero?: number | null;
    marca_copia?: string | null;
    aviso?: string | null;
  };
  pedido: {
    id: string;
    codigo: string;
    canal: string;
    modalidad: string;
    mesa_nombre?: string | null;
  };
  cliente: {
    nombre?: string | null;
    documento?: string | null;
    razon_social?: string | null;
  };
  fecha: string;
  fecha_iso: string;
  detalle: DetalleLineaNotaVenta[];
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  pagos: PagoLineaNotaVenta[];
  pago_metodo?: string;
  vuelto: number;
  aviso?: string | null;
  es_copia?: boolean;
  copia_numero?: number | null;
  marca_copia?: string | null;
}

export type TipoReclamo = 'RECLAMO' | 'QUEJA';
export type EstadoReclamo = 'RECIBIDO' | 'EN_REVISION' | 'RESPONDIDO';

export interface ReclamoAdminItem {
  id: string;
  numero: string;
  tipo: TipoReclamo;
  nombre: string;
  documento: string;
  domicilio: string;
  telefono: string;
  correo: string | null;
  pedido_id: string | null;
  pedidoId?: string | null;
  detalle: string;
  monto_reclamado: number | null;
  montoReclamado?: number | null;
  estado: EstadoReclamo;
  respuesta: string | null;
  respondido_por: string | null;
  respondidoPor?: any;
  respondido_en: string | null;
  respondidoEn?: string | null;
  fecha_limite: string;
  fechaLimite?: string;
  diasHabilesRestantes: number;
  plazoTexto: string;
  creado_en: string;
  creadoEn?: string;
}

export interface ReclamoAdminDetalle extends ReclamoAdminItem {
  pedido?: {
    id: string;
    codigo: string;
    creado_en: string;
    total: string | number;
  } | null;
}

export interface RespuestaListarReclamos {
  total: number;
  pagina: number;
  limite: number;
  items: ReclamoAdminItem[];
}

export interface ConstanciaReclamoPublico {
  numero: string;
  fechaRegistro: string;
  tipo: TipoReclamo;
  fechaLimite: string;
  mensaje: string;
}

export interface ConsultaConstanciaPublica {
  numero: string;
  fechaRegistro: string;
  tipo: TipoReclamo;
  fechaLimite: string;
  estado: EstadoReclamo;
  nombre: string;
  detalle: string;
  montoReclamado: number | null;
  respuesta: string | null;
  respondidoEn: string | null;
  mensaje: string;
}

export interface CartaLegalInfo {
  terminos: string;
  privacidad: string;
  terminosVersion?: string;
  privacidadVersion?: string;
  textoConsentimiento?: string;
  reclamoPlazoDiasHabiles: number;
}

export interface QuejaWhatsAppItem {
  id: string;
  origen: string;
  pedidoId: string | null;
  pedidoCodigo: string | null;
  cliente: string;
  telefonoEnmascarado: string;
  puntaje: number | null;
  texto: string;
  estado: 'NUEVA' | 'EN_REVISION' | 'RESUELTA';
  atendidaPor: string | null;
  resolucion: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

export interface ResumenQuejasWhatsApp {
  promedio: number;
  totalEncuestas: number;
  totalQuejas: number;
  todas: number;
  nuevas: number;
  enRevision: number;
  resueltas: number;
}

export interface RespuestaListarQuejasWhatsApp {
  resumen: ResumenQuejasWhatsApp;
  quejas: QuejaWhatsAppItem[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface EstadoConexionWhatsAppInfo {
  conectado: boolean;
  modo: 'meta' | 'simulado';
  razon?: string;
}

/** Estado de la BOLETA/FACTURA ante SUNAT (la lista de «Electrónicos»): PENDIENTE_RESUMEN y ENVIADA_RESUMEN son de la boleta (resumen diario). */
export type EstadoFacturacion = 'EMITIDO_SUNAT' | 'RECHAZADO' | 'PENDIENTE_ENVIO' | 'PENDIENTE_RESUMEN' | 'ENVIADA_RESUMEN' | 'REVISION_MANUAL';

/** Proveedor de facturación electrónica (parámetro facturacion_proveedor). */
export type ProveedorFacturacion = 'SIMULADO' | 'SUNAT';

/** Estado de la comunicación de baja (factura) o de la anulación en resumen (boleta). */
export type EstadoBaja = 'SOLICITADA' | 'ACEPTADA' | 'RECHAZADA' | 'PENDIENTE_RESUMEN';

/** Estado del envío automático de la factura por WhatsApp (solo facturas; null si nunca se intentó). */
export type EstadoEnvioWhatsapp = 'PENDIENTE' | 'ENVIADO' | 'SIN_CELULAR' | 'SIN_VENTANA' | 'ERROR' | 'APAGADO' | 'OMITIDO';
export interface EnvioWhatsappFactura {
  estado: EstadoEnvioWhatsapp;
  via: 'DOCUMENTO' | 'PLANTILLA' | null;
  enviado_en: string | null;
  intentos: number;
  detalle: string | null;
}
export interface ConfigFacturaWhatsapp {
  activo: boolean;
  plantilla: string;
}

export interface ComprobanteElectronico {
  id: string;
  pedido_id: string;
  codigo_pedido: string;
  tipo: 'BOLETA' | 'FACTURA' | string;
  serie: string;
  numero: number;
  numero_texto: string;
  documento: string | null;
  razon_social: string | null;
  total: number;
  fecha_lima: string;
  emision: string;
  facturacion_estado: EstadoFacturacion | null;
  /** Proveedor que emitió: SIMULADO | SUNAT (null en filas anteriores). */
  emisor?: ProveedorFacturacion | null;
  facturacion_intentos: number;
  /** Motivo de la cola de fallos (REVISION_MANUAL): rechazo permanente o intentos agotados. */
  revision_motivo?: string | null;
  enlace_pdf: string | null;
  cadena_qr: string | null;
  hash: string | null;
  respuesta_sunat: string | null;
  simulado: boolean;
  baja_estado: EstadoBaja | null;
  baja_motivo: string | null;
  baja_en: string | null;
  /** Envío de la factura por WhatsApp (solo FACTURA). */
  envio_whatsapp?: EnvioWhatsappFactura | null;
}

/** Comprobante de un pedido (o de un extra suyo) tal como lo da GET /admin/comprobantes/pedido/:id/lista. */
export interface ComprobantePedido extends ComprobanteElectronico {
  anulado_en: string | null;
  anulado_motivo: string | null;
  tiene_xml: boolean;
  tiene_cdr: boolean;
}

export interface RespuestaListarElectronicos {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  elementos: ComprobanteElectronico[];
}

export interface ConfigFacturacion {
  igvPct: number;
  serieBoleta: string;
  serieFactura: string;
  /** Lo que eligió el ADMIN. */
  proveedor: ProveedorFacturacion;
  /** Lo que de verdad emite (cae a SIMULADO sin credenciales). */
  proveedor_efectivo: ProveedorFacturacion;
  sunat: { ambiente: 'beta' | 'prod'; credenciales: boolean; vence_certificado: string | null };
  /** Fecha de corte (ISO): los pedidos cobrados antes no se emiten a SUNAT. Null si aún no se fijó. */
  facturacion_desde?: string | null;
}

/** Conteos de salud de la facturación (solo ADMIN; sin datos personales). */
export interface SaludFacturacion {
  pendientes: number;
  con_problemas: number;
  revision_manual: number;
  rechazados: number;
  pendientes_mas_15_min: number;
  edad_pendiente_min: number | null;
  boletas_por_reportar: number;
  resumenes_sin_respuesta: number;
  certificado_vence_en_dias: number | null;
  circuito_abierto: boolean;
  credenciales_invalidas: boolean;
  generado_en: string;
}

/** Comprobante por defecto: boleta electrónica si hay SUNAT real (en simulado no cambia nada). */
export interface BoletaPorDefecto {
  activo: boolean;
  proveedor_efectivo: ProveedorFacturacion;
  aplica: boolean;
}
