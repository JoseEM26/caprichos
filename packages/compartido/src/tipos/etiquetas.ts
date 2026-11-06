export type TipoEtiqueta = 'ETIQUETA_GENERAL' | 'ETIQUETA_AREA' | 'ETIQUETA_BEBIDA';

/** Comandas por pedido para la ticketera: la de salón (Caja, al aceptarse) y la de cada área (su ticketera, o Caja). */
export type TipoTicketComanda = 'TICKET_COMANDA_SALON' | 'TICKET_COMANDA_AREA';

/** Tipo de trabajo de impresión: etiquetas (etiquetera), ticket de pago o comanda de salón (ticketera de Caja). */
export type TipoTrabajoImpresion = TipoEtiqueta | 'TICKET_PAGO' | TipoTicketComanda;

/** Máquina que imprime el trabajo: la etiquetera (stickers) o la ticketera (voucher/ticket de pago). */
export type RolImpresora = 'ETIQUETERA' | 'TICKETERA';

export const ROLES_IMPRESORA: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];

export function rolDeTrabajo(tipo: string): RolImpresora {
  return tipo === 'TICKET_PAGO' || tipo === 'TICKET_COMANDA_SALON' || tipo === 'TICKET_COMANDA_AREA' ? 'TICKETERA' : 'ETIQUETERA';
}

/** Estado de una máquina reportado por el agente local en su latido. */
export interface ImpresoraReportada {
  rol: RolImpresora;
  estado: EstadoImpresora;
  detalle?: string;
}

/** Estado de una máquina tal como lo ve el admin (con el motivo si no está bien). */
export interface EstadoMaquinaImpresion {
  conectada: boolean;
  estado: EstadoImpresora | 'no_configurada' | 'sin_programa';
  motivo: string | null;
  /** Dato de conexión cuando lo hay (ej. «Red 192.168.1.50:9100»). */
  detalle?: string;
}

export interface TicketPagoDatos {
  tipo?: 'TICKET_PAGO';
  local: { nombre: string; razonSocial?: string | null; ruc?: string | null; direccion?: string | null };
  codigo: string;
  fecha: string;
  hora: string;
  who: string;
  modalidad: string;
  lineas: { cantidad: number; nombre: string; tamano?: string | null; subtotal: number }[];
  /** Venta (sin propina): es la base del comprobante */
  total: number;
  /** Propina aparte de la venta: línea propia en el ticket interno; no entra al comprobante */
  propina?: number;
  /** Cambio de dirección con ajuste todavía sin resolver: saldo por cobrar (SALDO) o devolución pendiente (DEVOLUCION) */
  ajusteUbicacion?: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  pagos: { medio: string; monto: number; recibido?: number | null; vuelto?: number | null }[];
  plan?: { medio: string; monto: number }[];
  /**
   * Boleta/factura electrónica: representación impresa, hash y marca de prueba. `situacion` dice si el XML está
   * firmado (FIRMADO), aún no (EN_PROCESO) o SUNAT no lo aceptó (REGULARIZAR: no lleva hash válido).
   * `cadenaQr` viaja en el trabajo y el agente lo imprime como QR desde su versión nueva (ver docs/operacion/configurar-sunat.md).
   */
  comprobante?: {
    tipo: string;
    numero: string;
    representacion?: string | null;
    hash?: string | null;
    cadenaQr?: string | null;
    simulado?: boolean;
    situacion?: 'FIRMADO' | 'EN_PROCESO' | 'REGULARIZAR';
  } | null;
  /** Nota de venta enviada por el mozo: nombre de quien cobró en mesa. */
  cobradoPorMozo?: string | null;
}

export type EstadoPrintJob = 'PENDIENTE' | 'IMPRIMIENDO' | 'IMPRESO' | 'FALLIDO';

export type EstadoImpresora = 'lista' | 'sin_papel' | 'desconectada' | 'sin_permiso' | 'error';

export interface EtiquetaGeneralProducto {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
}

export interface EtiquetaGeneralDatos {
  tipo?: 'ETIQUETA_GENERAL';
  codigo: string;
  modalidad: string;
  modalidadPill: string;
  who: string;
  canal: string;
  hora: string;
  fecha: string;
  cantidadProductos: number;
  productos: EtiquetaGeneralProducto[];
  nota?: string | null;
  /** Monto total del pedido (sticker de resumen para llevar/recoger y delivery). Ausente en trabajos viejos. */
  total?: number | null;
  printer: string;
}

export interface EtiquetaAreaLinea {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
  opciones: string[];
  nota?: string | null;
}

export interface EtiquetaAreaDatos {
  tipo?: 'ETIQUETA_AREA';
  areaNombre: string;
  areaIndex: number;
  totalAreas: number;
  codigo: string;
  modalidadPill: string;
  who: string;
  canal: string;
  hora: string;
  fecha: string;
  lineas: EtiquetaAreaLinea[];
  esCompacta: boolean;
  nota?: string | null;
  printer: string;
}

export interface EtiquetaBebidaDatos {
  tipo?: 'ETIQUETA_BEBIDA';
  bebidaIndex: number;
  totalBebidas: number;
  codigo: string;
  persona: string;
  bebidaNombre: string;
  tamano?: string | null;
  opciones: string[];
  contiene?: string | null;
  who: string;
  hora: string;
}

/** Comanda de salón: todas las líneas del pedido con tamaño, opciones y notas, para la cocina y el mozo. */
export interface TicketComandaSalonDatos {
  tipo?: TipoTicketComanda;
  codigo: string;
  /** Nombre de la mesa (salón); null si no hay. */
  mesa: string | null;
  /** Solo en la comanda de área: nombre del área cuyas líneas trae la hoja. */
  area?: string | null;
  cliente: string;
  canal: string;
  hora: string;
  fecha: string;
  lineas: { cantidad: number; nombre: string; tamano?: string | null; opciones: string[]; nota?: string | null }[];
  nota?: string | null;
}

export type PayloadEtiqueta =
  | EtiquetaGeneralDatos
  | EtiquetaAreaDatos
  | EtiquetaBebidaDatos
  | TicketPagoDatos
  | TicketComandaSalonDatos;

export interface TrabajoImpresion {
  id: string;
  tipo: TipoTrabajoImpresion;
  payload: PayloadEtiqueta;
  copia: boolean;
  intentos: number;
}

export interface PeticionTomarTrabajos {
  max: number;
  /** Solo trabajos de estos roles (los que el agente puede imprimir ahora). Sin roles: todos. */
  roles?: RolImpresora[];
}

export interface RespuestaTomarTrabajos {
  trabajos: TrabajoImpresion[];
}

export interface PeticionResultadoTrabajo {
  id: string;
  ok: boolean;
  error?: string;
}

export interface PeticionLatido {
  version: string;
  impresora: EstadoImpresora;
  detalle?: string;
  /** Estado de cada máquina configurada (etiquetera y ticketera). */
  impresoras?: ImpresoraReportada[];
}

export interface EstadoAdminImpresion {
  agente: 'conectado' | 'sin_conexion';
  ultimoLatido?: string | null;
  impresora: EstadoImpresora;
  pendientes: number;
  fallidos: number;
  /** Estado por máquina; sin latido, ambas «el programa del local no está corriendo». */
  impresoras?: Record<RolImpresora, EstadoMaquinaImpresion>;
}
