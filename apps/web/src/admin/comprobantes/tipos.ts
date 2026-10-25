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
  razon_social: string;
  ruc: string;
  direccion: string;
  telefono: string;
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
