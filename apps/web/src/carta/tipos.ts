export interface TamanoCarta {
  id: string;
  nombre: string;
  precio: number;
}

export interface OpcionCarta {
  id: string;
  nombre: string;
  precioExtra: number;
  disponible: boolean;
}

export interface GrupoOpcionesCarta {
  id: string;
  nombre: string;
  obligatorio: boolean;
  minimo: number;
  maximo: number;
  opciones: OpcionCarta[];
}

export interface SaborCarta {
  id: string;
  nombre: string;
  disponible: boolean;
}

export interface ProductoCarta {
  id: string;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  precio: number;
  tamanos: TamanoCarta[];
  grupos: GrupoOpcionesCarta[];
  sabores: SaborCarta[];
  noSumaBeneficios: boolean;
  disponible: boolean;
  agotadoHasta: string | null;
  /** Producto terminado con conteo (donas, galletas). Ausente o false = sin control de stock. */
  controlaStock?: boolean;
  /** Unidades que quedan hoy; null si no controla stock o no hay conteo de apertura del día. */
  quedan?: number | null;
}

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
  productos: ProductoCarta[];
}

export interface EstadoLocalCarta {
  abierta: boolean;
  motivo: string;
  texto: string;
  abre: string | null;
  cierra: string | null;
  pausaAltaDemanda: boolean;
  tiempoPrometidoMin: number | null;
  altaDemandaMin: number;
  cartaAvisoEntrada?: boolean;
}

export interface MedioPagoInfo {
  activo: boolean;
  titular?: string;
  numero?: string;
  qrUrl?: string;
  banco?: string;
  tipoCuenta?: string;
  cuenta?: string;
  cci?: string;
}

export interface HorarioDiaCarta {
  dia_semana: number;
  dia: string;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

export interface DatosLocalCarta {
  nombre: string;
  direccion: string;
  telefono: string;
  whatsapp: string;
  redes: Record<string, string>;
  /** Frase bajo el nombre; el servidor manda «Cafetería artesanal» si el dueño no puso otra. */
  lema?: string;
  horario: HorarioDiaCarta[];
  mediosPago: Record<string, MedioPagoInfo>;
  envioGratisDesde: number | null;
  envioGratisModo?: 'desde' | 'mas_de' | string;
  pedidoMinimo: number | null;
  puntosPorcentaje?: number;
  /** Pedir como invitado (sin celular): lo decide el dueño en Configuración. Sin dato = no permitido. */
  invitadoPermitido?: boolean;
  lat?: number;
  lng?: number;
}

export interface ConsultaEnvioRespuesta {
  cubierto: boolean;
  zona: string | null;
  tarifa: number | null;
  tarifaZona: number | null;
  gratisDesde: number;
  modoGratis: 'desde' | 'mas_de';
  /** Promo ENVIO_GRATIS vigente en la carta (aditivo). */
  envioGratisPromo?: { nombre: string; hasta: string | null; compraMinima: number | null } | null;
}

/** Dirección de la libreta del cliente con cuenta (GET /carta/cuenta/direcciones). */
export interface DireccionCliente {
  id: string;
  direccion: string;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  alias: string | null;
  usos: number;
  ultimoUsoEn: string;
  origen: string;
}

export interface OpcionElegida {
  id: string;
  nombre: string;
  precioExtra: number;
  grupoId: string;
  grupoNombre: string;
}

export interface UnidadPersonalizada {
  persona?: string;
  opciones: OpcionElegida[];
}

export interface LineaCarrito {
  id: string;
  productoId: string;
  nombre: string;
  fotoUrl?: string | null;
  tamanoId?: string;
  tamanoNombre?: string;
  precioBase: number;
  cantidad: number;
  opciones: OpcionElegida[];
  nota?: string;
  personas?: string[];
  /** Combo con parte fija: el combo y qué producto se eligió en cada parte (principal o reemplazo) */
  ofertaId?: string;
  comboElecciones?: { parteId: string; productoId: string }[];
  unidades?: UnidadPersonalizada[];
  precioUnitario: number;
  subtotal: number;
}

export type ModalidadEntrega = 'DELIVERY' | 'RECOGER';
export type TipoComprobante = 'BOLETA' | 'FACTURA';
export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

export interface DatosClienteFormulario {
  nombre: string;
  telefono: string;
}

export interface DatosEntregaFormulario {
  direccion: string;
  referencia?: string;
  lat?: number;
  lng?: number;
  origen?: 'GPS' | 'ESCRITA' | 'MAPA' | 'WHATSAPP' | 'ENLACE';
  costoEnvio: number | null;
  zona: string | null;
  fueraDeCobertura: boolean;
}

export interface DatosComprobanteFormulario {
  tipo: TipoComprobante;
  dni?: string;
  ruc?: string;
  razonSocial?: string;
}

export interface DatosPagoFormulario {
  metodo: MetodoPago;
  pagaCon?: number;
}

export interface PedidoConfirmado {
  id: string;
  codigo: string;
  estado: string;
  subtotal: number;
  envio: number | null;
  total: number;
  mensaje: string;
  clienteNombre: string;
  modalidad: ModalidadEntrega;
  seguimientoToken: string;
}
