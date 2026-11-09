import type { TamanoEtiquetaPc } from '../constantes/tamanoPc.js';
import type { LineaDetalleEntrada, DescuentoTicket } from '../etiquetas/detalleLinea.js';

export type TipoEtiqueta = 'ETIQUETA_GENERAL' | 'ETIQUETA_AREA' | 'ETIQUETA_BEBIDA';

/** Comandas por pedido para la ticketera: la de salón (Caja, al aceptarse) y la de cada área (su ticketera, o Caja). */
export type TipoTicketComanda = 'TICKET_COMANDA_SALON' | 'TICKET_COMANDA_AREA';

/** Tipo de trabajo de impresión: etiquetas (etiquetera), ticket de pago o comanda de salón (ticketera de Caja). */
export type TipoTrabajoImpresion = TipoEtiqueta | 'TICKET_PAGO' | 'TICKET_CIERRE' | TipoTicketComanda;

/** Máquina que imprime el trabajo: la etiquetera (stickers) o la ticketera (voucher/ticket de pago). */
export type RolImpresora = 'ETIQUETERA' | 'TICKETERA';

export const ROLES_IMPRESORA: RolImpresora[] = ['ETIQUETERA', 'TICKETERA'];

export function rolDeTrabajo(tipo: string): RolImpresora {
  return tipo === 'TICKET_PAGO' || tipo === 'TICKET_CIERRE' || tipo === 'TICKET_COMANDA_SALON' || tipo === 'TICKET_COMANDA_AREA' ? 'TICKETERA' : 'ETIQUETERA';
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
  /** Puerto del spooler o ruta del dispositivo (USB001, /dev/usb/lp0, tcp://...). */
  puerto?: string;
  driver?: string;
  /** Estado que informa el sistema (Normal, sin conexión...). */
  estado?: string;
  usb?: boolean;
}

/** Datos de la computadora que el programa informa en cada latido. */
export interface InfoEquipoLatido {
  /** Nombre de la computadora (hostname). */
  hostname?: string;
  /** Sistema operativo (ej. win32 10.0.19045). */
  sistema?: string;
  /** Direcciones IPv4 de la red local (interfaces no internas). */
  ipLocal?: string[];
  /** Identificador estable de la PC (hash, nunca el dato crudo): permite reconocerla al volver a vincularla. */
  equipoUid?: string;
}

/** Impresora elegida por rol en Configuración › Impresión (identificación estable). */
export type SeleccionImpresoras = Partial<Record<RolImpresora, string>>;

/** Respuesta del latido: lo que el dueño eligió en el panel (programas viejos la ignoran). */
export interface RespuestaLatido {
  seleccion?: SeleccionImpresoras;
  /** Lo que el dueño configuró para ESTA computadora (el programa la aplica sin reiniciar). */
  equipo?: ConfigEquipoParaAgente;
}

/** Lo que el programa necesita saber de su configuración: qué máquinas usar y si está en pausa. */
export interface ConfigEquipoParaAgente {
  ticketera: boolean;
  etiquetera: boolean;
  pausado: boolean;
  configurado: boolean;
  tamanoGeneral?: TamanoEtiquetaPc | null;
  tamanoBebida?: TamanoEtiquetaPc | null;
}

/**
 * Configuración de impresión de UNA computadora (cada PC manda). Una PC nueva llega con todo apagado y
 * `configurado = false`: no imprime nada hasta que el dueño guarda por primera vez.
 */
export type ModalidadBebida = 'COMER_LOCAL' | 'LLEVAR' | 'RECOGER' | 'DELIVERY';
export const MODALIDADES_BEBIDA: readonly ModalidadBebida[] = ['COMER_LOCAL', 'LLEVAR', 'RECOGER', 'DELIVERY'];
export type BebidaCategoriasPorModalidad = Partial<Record<ModalidadBebida, string[] | null>>;

/** Modalidad del pedido → tipo de pedido del filtro de vasos (MESA y LOCAL = en el local); null si no se conoce. */
export function modalidadDeFiltroBebida(m: unknown): ModalidadBebida | null {
  switch (String(m ?? '').toUpperCase()) {
    case 'MESA':
    case 'LOCAL':
    case 'COMER_LOCAL':
      return 'COMER_LOCAL';
    case 'LLEVAR':
      return 'LLEVAR';
    case 'RECOGER':
      return 'RECOGER';
    case 'DELIVERY':
      return 'DELIVERY';
    default:
      return null;
  }
}

/** Lista efectiva de categorías para una modalidad: la suya, si no la general (null = todas). */
export function categoriasBebidaEfectivas(
  general: string[] | null,
  porModalidad: BebidaCategoriasPorModalidad | undefined,
  modalidad: ModalidadBebida | null,
): string[] | null {
  if (!modalidad || !porModalidad) return general;
  const propia = porModalidad[modalidad] ?? (modalidad === 'RECOGER' ? porModalidad.LLEVAR : undefined);
  return propia === undefined || propia === null ? general : propia;
}

export interface ConfigEquipoImpresion {
  ticketera: boolean;
  etiquetera: boolean;
  /** Ticket / voucher de pago. */
  ticketPago: boolean;
  /** Comanda completa de salón. */
  comandaSalon: boolean;
  /** Ids de las áreas cuya comanda sale aquí. */
  comandaAreas: string[];
  /** Sticker general (resumen del pedido). */
  stickerGeneral: boolean;
  /** Ids de las áreas cuyo sticker por área sale aquí. */
  stickerAreas: string[];
  /** Ids de las áreas cuyos vasos (sticker de bebida) salen aquí. */
  stickerBebidaAreas: string[];
  /** Ids de las categorías de bebida cuyo vaso sale aquí; null = todas (como siempre). */
  stickerBebidaCategorias: string[] | null;
  /**
   * Regla por tipo de pedido (ids de categoría que SÍ imprimen en ese tipo). Clave ausente o null = la regla general
   * (`stickerBebidaCategorias`); [] = ninguna. RECOGER usa la de LLEVAR si no tiene la suya.
   */
  stickerBebidaCategoriasPorModalidad?: BebidaCategoriasPorModalidad;
  /** Tamaño propio del sticker general en esta PC; null = el general del local. */
  tamanoGeneral: TamanoEtiquetaPc | null;
  /** Tamaño propio del sticker de bebida en esta PC; null = el general del local. */
  tamanoBebida: TamanoEtiquetaPc | null;
  pausado: boolean;
  configurado: boolean;
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
  /** Reimpresión: rótulo grande arriba («ANULADO», «PRE-CUENTA / PENDIENTE DE PAGO»). Un .exe viejo no lo imprime. */
  marca?: string | null;
  /** Simulación de pedido: el ticket imprime «*** PRUEBA ***». */
  simulacion?: boolean;
  local: { nombre: string; razonSocial?: string | null; ruc?: string | null; direccion?: string | null };
  codigo: string;
  fecha: string;
  hora: string;
  who: string;
  modalidad: string;
  /** Detalle opcional por línea (sabores, opciones, nota, combo, cortesía): un ticket antiguo sin ellos sale igual que antes. */
  lineas: LineaDetalleEntrada[];
  /** Subtotal de productos antes de descuentos y envío. */
  subtotal?: number;
  /** Descuentos desglosados (promoción, cupón, personal, puntos) con su monto. */
  descuentos?: DescuentoTicket[];
  envio?: number;
  /** Nota general del pedido. */
  notaPedido?: string | null;
  /** Mesa o dirección de entrega, ya en texto. */
  entrega?: string | null;
  /** Celular del cliente (ya enmascarado si corresponde). */
  clienteTelefono?: string | null;
  /** Con cuánto paga el cliente en efectivo. */
  pagaCon?: number | null;
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
  /**
   * Consumo del personal: ticket interno (nunca boleta/factura electrónica). `pagado` = el trabajador ya lo pagó en Caja;
   * si no, queda cargado a su crédito y se paga en su cuenta semanal.
   */
  personal?: { trabajador?: string | null; pagado?: boolean } | null;
  /** Cupón real y vigente del cliente para su próxima compra (solo si el dueño activó «Imprimir cupón en el ticket»). */
  cuponSiguiente?: { codigo: string; descripcion?: string | null; vence?: string | null } | null;
  /**
   * Tipo de comprobante que se imprime y los datos del cliente de ESE comprobante (nunca de su cuenta).
   * SIMPLE = ticket interno sin SUNAT; BOLETA y FACTURA muestran cliente, documento y desglose del IGV.
   * Sin este campo el ticket sale como antes.
   */
  documento?: {
    tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA';
    clienteNombre?: string | null;
    docTipo?: 'DNI' | 'RUC' | 'CE' | null;
    docNumero?: string | null;
    direccion?: string | null;
    igvPct?: number | null;
  } | null;
}

export type EstadoPrintJob = 'PENDIENTE' | 'IMPRIMIENDO' | 'IMPRESO' | 'FALLIDO';

export type EstadoImpresora = 'lista' | 'sin_papel' | 'desconectada' | 'sin_permiso' | 'error';

export interface EtiquetaGeneralProducto {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
}

/** Bloque de pago del sticker de despacho y de la pantalla de Despacho (lo calcula `calcularPagoPedido`). */
export interface PagoEtiqueta {
  estado: 'PAGADO' | 'COBRADO_MOZO' | 'POR_COBRAR';
  medios: Array<{ medio: string; monto: number }>;
  total: number;
  descuento: number;
  propina: number;
  efectivo: number;
  recibido: number | null;
  vuelto: number | null;
  llevaVuelto: boolean | null;
  esPersonal: boolean;
  /** Delivery sin pagar: efectivo que el repartidor cobra al entregar. */
  cobrarAlEntregar: number | null;
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
  /** Delivery con coordenadas: Plus Code corto («7P7J+2X Lima») para ubicar al cliente */
  plus?: string | null;
  /** Pago vigente al armar el trabajo (opcional: un programa viejo lo ignora y dibuja el sticker anterior). */
  pago?: PagoEtiqueta | null;
  /** Tamaño del sticker en mm; la API lo pone al entregar el trabajo al programa de impresión. Ausente: el de fábrica. */
  tamanoMm?: { anchoMm: number; altoMm: number; margenMm?: number };
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
  /** Área de la línea (id): decide en qué PC sale el vaso. */
  areaId?: string;
  /** Categoría del producto (id): solo el servidor la usa para filtrar por PC; el programa de impresión la ignora. */
  categoriaId?: string;
  /** Tamaño del sticker en mm; la API lo pone al entregar el trabajo al programa de impresión. Ausente: el de fábrica. */
  tamanoMm?: { anchoMm: number; altoMm: number; margenMm?: number };
}

/** Comanda de salón: todas las líneas del pedido con tamaño, opciones y notas, para la cocina y el mozo. */
export interface TicketComandaSalonDatos {
  tipo?: TipoTicketComanda;
  /** Reimpresión de un pedido anulado: rótulo «ANULADO» arriba. */
  marca?: string | null;
  /** Simulación de pedido: la comanda imprime «*** PRUEBA ***». */
  simulacion?: boolean;
  codigo: string;
  /** Nombre de la mesa (salón); null si no hay. */
  mesa: string | null;
  /** Solo en la comanda de área: nombre del área cuyas líneas trae la hoja. */
  area?: string | null;
  cliente: string;
  canal: string;
  hora: string;
  fecha: string;
  lineas: LineaComandaDatos[];
  nota?: string | null;
}

/**
 * Línea de la comanda. `opciones` y `nota` son lo de siempre (un .exe viejo solo imprime esto). `detalles` sale de
 * `detalleLinea` (sabores, opciones con su grupo, «Para», nota, cortesía) y, si viene, manda sobre `opciones`/`nota`;
 * `partes` son las piezas de un combo con su propio tamaño, sabor y opciones.
 */
export interface LineaComandaDatos {
  cantidad: number;
  nombre: string;
  tamano?: string | null;
  opciones: string[];
  nota?: string | null;
  detalles?: string[];
  partes?: LineaComandaDatos[];
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
  /** Nombre, sistema y red de la computadora (aditivo). */
  equipo?: InfoEquipoLatido;
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
  /** Ver el módulo de configuración por PC (aditivo). */
  config?: ConfigEquipoImpresion;
  /** Hace cuántos segundos latió por última vez (null = nunca). */
  ultimoLatido?: string | null;
  ipLocal?: string[];
  ipPublica?: string | null;
  hostname?: string | null;
  sistema?: string | null;
  version?: string | null;
  /** PC apagada con otra más nueva del mismo nombre: el panel la guarda en «Antiguas». */
  antigua?: boolean;
  /** Otra PC con la que se confunde: «¿es la misma que ...?» */
  repetidaDe?: { deviceKeyId: string; nombre: string } | null;
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
  /** PC eliminadas o reemplazadas (solo consulta; las últimas 20). */
  eliminadas?: { deviceKeyId: string; nombre: string; hostname: string | null; ipLocal: string[]; ultimoLatido: string | null; eliminadaEn: string | null }[];
  /** Impresoras detectadas en el equipo del local (vacío si el programa es viejo o no está). */
  candidatas?: ImpresoraCandidata[];
  /** Lo elegido en el panel por rol (puede no haberse aplicado aún). */
  seleccion?: SeleccionImpresoras;
  /** Trabajos esperando que alguna PC los imprima: ninguna está configurada para recibirlos. */
  sinReceptor?: number;
  /** Tamaño de los stickers del local: lo que hereda una PC sin tamaño propio. */
  tamanosLocal?: { bebida: { anchoMm: number; altoMm: number }; general: { anchoMm: number; altoMm: number } };
}
