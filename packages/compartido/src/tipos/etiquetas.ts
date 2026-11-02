export type TipoEtiqueta = 'ETIQUETA_GENERAL' | 'ETIQUETA_AREA' | 'ETIQUETA_BEBIDA';

/** Tipo de trabajo de impresión: etiquetas (etiquetera) o ticket de pago (ticketera térmica). */
export type TipoTrabajoImpresion = TipoEtiqueta | 'TICKET_PAGO';

/** Máquina que imprime el trabajo: la etiquetera (stickers) o la ticketera (voucher/ticket de pago). */
export type RolImpresora = 'ETIQUETERA' | 'TICKETERA';

export const ROLES_IMPRESORA: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];

export function rolDeTrabajo(tipo: string): RolImpresora {
  return tipo === 'TICKET_PAGO' ? 'TICKETERA' : 'ETIQUETERA';
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
  total: number;
  pagos: { medio: string; monto: number; recibido?: number | null; vuelto?: number | null }[];
  plan?: { medio: string; monto: number }[];
  /** Boleta/factura emitida: representación impresa, hash de SUNAT y marca de prueba. El QR aún no se imprime. */
  comprobante?: {
    tipo: string;
    numero: string;
    representacion?: string | null;
    hash?: string | null;
    simulado?: boolean;
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

export type PayloadEtiqueta =
  | EtiquetaGeneralDatos
  | EtiquetaAreaDatos
  | EtiquetaBebidaDatos
  | TicketPagoDatos;

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
