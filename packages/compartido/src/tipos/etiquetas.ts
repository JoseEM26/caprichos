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
  /** Identificación estable de la impresora en uso (nombre del spooler, MFG MDL|serie o ruta). */
  id?: string;
  /** Nombre legible de la impresora en uso. */
  nombre?: string;
}

/** Impresora que el programa del local ve en su equipo (sin las virtuales: PDF, OneNote, Fax, XPS). */
export interface ImpresoraCandidata {
  /** Identificación estable: no cambia al reiniciar la computadora. */
  id: string;
  nombre: string;
  /** Puerto, modelo o ruta, para reconocerla. */
  detalle?: string;
  /** Por su lenguaje o nombre parece de este tipo. */
  sugerido?: RolImpresora;
}

/** Impresora elegida por rol en Configuración › Impresión (identificación estable). */
export type SeleccionImpresoras = Partial<Record<RolImpresora, string>>;

/** Respuesta del latido: lo que el dueño eligió en el panel (programas viejos la ignoran). */
export interface RespuestaLatido {
  seleccion?: SeleccionImpresoras;
}

/** Estado de una máquina tal como lo ve el admin (con el motivo si no está bien). */
export interface EstadoMaquinaImpresion {
  conectada: boolean;
  estado: EstadoImpresora | 'no_configurada' | 'sin_programa';
  motivo: string | null;
  /** Dato de conexión cuando lo hay (ej. «Red 192.168.1.50:9100»). */
  detalle?: string;
  /** Impresora en uso (identificación estable y nombre), si el programa la informa. */
  impresoraId?: string;
  impresoraNombre?: string;
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
  /** Solo delivery: dirección de entrega y celular del cliente (van en el sticker para el repartidor). */
  direccion?: string | null;
  telefono?: string | null;
  /** Tamaño del sticker en mm; la API lo pone al entregar el trabajo al programa de impresión. Ausente: el de fábrica. */
  tamanoMm?: { anchoMm: number; altoMm: number };
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
  /** Tamaño del sticker en mm; la API lo pone al entregar el trabajo al programa de impresión. Ausente: el de fábrica. */
  tamanoMm?: { anchoMm: number; altoMm: number };
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
  /** Además, pruebas dirigidas a una impresora concreta (payload.prueba.impresoraId), aunque no haya máquina lista. */
  pruebas?: boolean;
}

/** Marca de una prueba dirigida a una impresora concreta del equipo (dentro del payload del trabajo). */
export interface PruebaDirigida {
  impresoraId: string;
  nombre?: string;
  /** «Impresora 3 de 15»: número grande en la hoja de «Probar todas». */
  marca?: string;
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
  /** Impresoras que ve el equipo (aditivo: los programas viejos no la mandan). */
  candidatas?: ImpresoraCandidata[];
}

/** Una computadora con el programa vinculado (Caja, Bebidas...), con su propia llave, impresoras y elección. */
export interface EquipoEstadoImpresion {
  deviceKeyId: string;
  nombre: string;
  /** null = Caja */
  areaId: string | null;
  areaNombre: string | null;
  conectado: boolean;
  impresoras: Record<RolImpresora, EstadoMaquinaImpresion>;
  candidatas: ImpresoraCandidata[];
  seleccion: SeleccionImpresoras;
  /** Trabajos esperando a ESTA computadora (si está apagada, no se pierden: esperan aquí). */
  pendientes: number;
}

export interface EstadoAdminImpresion {
  agente: 'conectado' | 'sin_conexion';
  ultimoLatido?: string | null;
  impresora: EstadoImpresora;
  pendientes: number;
  fallidos: number;
  /** Estado por máquina; sin latido, ambas «el programa del local no está corriendo». */
  impresoras?: Record<RolImpresora, EstadoMaquinaImpresion>;
  /** Cada computadora vinculada por separado (las pruebas y la impresora fija son POR computadora). */
  equipos?: EquipoEstadoImpresion[];
  /** Impresoras detectadas en el equipo del local (vacío si el programa es viejo o no está). */
  candidatas?: ImpresoraCandidata[];
  /** Lo elegido en el panel por rol (puede no haberse aplicado aún). */
  seleccion?: SeleccionImpresoras;
}
