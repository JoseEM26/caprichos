import type { DescuentoTicket, LineaDetalleEntrada } from '@caprichos/compartido';
export type TipoElemento =
  | 'MESA'
  | 'PARED'
  | 'COCINA'
  | 'BARRA'
  | 'BANO'
  | 'ENTRADA'
  | 'ESCALERA'
  | 'CAJA'
  | 'OTRO';

export interface ElementoPlano {
  id: string;
  pisoId: string;
  tipo: TipoElemento | string;
  nombre: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  numero: number | null;
  asientos: number | null;
  activo: boolean;
}

export interface TotalesPiso {
  mesas: number;
  asientosTotales: number;
  mesasActivas: number;
}

export interface PisoPlano {
  id: string;
  nombre: string;
  activo: boolean;
  cuadriculaAncho: number;
  cuadriculaAlto: number;
  cuadricula_ancho?: number;
  cuadricula_alto?: number;
  mesas: number;
  asientosTotales: number;
  mesasActivas: number;
  totales: TotalesPiso;
  elementos: ElementoPlano[];
}

export interface MesaSalon {
  id: string;
  pisoId: string;
  pisoNombre?: string;
  tipo: string;
  numero: number | null;
  nombre: string | null;
  asientos: number | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  activo: boolean;
  estado: 'LIBRE' | 'OCUPADA';
  pedido?: {
    id: string;
    codigo: string;
    estado?: string;
    mozo: string | null;
    /** Nombre corto del cliente del pedido (o null) */
    cliente?: string | null;
    total?: number;
    /** Hora en que se tomó el pedido (ISO) */
    creadoEn?: string;
    /** Mesa principal del pedido (la que lleva su nombre) y su orden entre las mesas juntas */
    esPrincipal?: boolean;
    orden?: number;
    /** Cocina y entrega en vivo (misma función que «Mis pedidos») */
    progreso?: ProgresoPedido;
    lineas?: Array<{ cantidad: number; nombre: string; detalle: string; opciones?: string[]; precio?: number; entrada?: LineaDetalleEntrada }>;
    /** Precuenta detallada: descuentos desglosados, subtotal, envío y nota general */
    descuentos?: DescuentoTicket[];
    subtotal?: number;
    envio?: number;
    nota?: string | null;
  } | null;
  pedidoCodigo?: string | null;
  mozo?: string | null;
  reserva?: {
    id: string;
    hora: string;
    nombre: string;
    personas: number;
  } | null;
}

export interface PisoSalon {
  id: string;
  nombre: string;
  activo: boolean;
  cuadricula_ancho?: number;
  cuadricula_alto?: number;
  cuadriculaAncho?: number;
  cuadriculaAlto?: number;
  mesas: MesaSalon[];
  elementos?: ElementoPlano[];
}

export interface ReservaMesaItem {
  id?: string;
  mesa_id: string | null;
  numero: number | null;
  nombre: string | null;
  asientos: number | null;
}

export type EstadoReserva = 'ACTIVA' | 'SENTADA' | 'CANCELADA' | 'NO_ASISTIO';

export interface Reserva {
  id: string;
  nombre: string;
  telefono: string;
  personas: number;
  hora: string;
  tolerancia_min: number;
  estado: EstadoReserva;
  motivo_cancelacion: string | null;
  pedido_id: string | null;
  mesas: ReservaMesaItem[];
}

export interface DiaCalendarioReserva {
  fecha: string; // YYYY-MM-DD
  cantidad: number;
}

export interface ElementoDisenoJson {
  id: string;
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  seats?: number;
  on?: boolean;
}

export interface PisoDisenoJson {
  id: string;
  n: string;
  on: boolean;
}

export interface DisenoCompletoJson {
  floors: PisoDisenoJson[];
  dims?: Record<string, { c?: number; r?: number }>;
  plan: Record<string, ElementoDisenoJson[]>;
}

export interface AvisoPedidoListo {
  pedidoId: string;
  codigo: string;
  mesas: string[];
  mozoPartyId?: string;
  recibidoEn: string;
}

export type RangoMisPedidos = 'hoy' | 'ayer' | '7dias';

/** Progreso en cocina y entrega (mismo contrato que la API: progresoDelPedido). */
export type EtapaProgreso =
  | 'RECIBIDO'
  | 'EN_COCINA'
  | 'PARCIAL'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'LLEGO'
  | 'ESPERANDO_CLIENTE'
  | 'ENTREGADO'
  | 'ANULADO';

export interface ProductoProgreso {
  lineaId?: string;
  nombre: string;
  cantidad: number;
  listas?: number;
  despachadas?: number;
}

export interface AreaProgreso {
  nombre: string;
  estado: 'PENDIENTE' | 'PREPARANDO' | 'LISTA';
  lineas: number;
  /** Líneas del área: unidades, listas y despachadas por producto. */
  productos?: ProductoProgreso[];
}

export interface ProgresoPedido {
  etapa: EtapaProgreso;
  etiqueta: string;
  areas: AreaProgreso[];
  listasDe: number;
  totalAreas: number;
  porcentaje: number;
  enCamino: boolean;
  etaMin?: number;
  etaMax?: number;
  /** Minutos para que esté listo lo que falta (solo mientras cocina trabaja). */
  estimadoMin?: number;
}

/** Línea de un pedido del mozo. Los campos nuevos pueden faltar en respuestas anteriores. */
export interface MiPedidoLinea {
  id?: string;
  nombre: string;
  cantidad: number;
  tamano?: string | null;
  /** Nombres de las opciones elegidas (sin grupo) */
  opciones?: string[];
  nota?: string | null;
  precioUnit?: number;
  subtotal?: number | null;
  /** Cocina ya tiene todas las unidades listas */
  lista?: boolean;
}

/** Pedido que tomó el mozo (GET /admin/pedidos/mis-pedidos). */
export interface MiPedido {
  id: string;
  codigo: string;
  estado: string;
  modalidad: string;
  mesaNombre: string | null;
  /** Último cambio de ubicación (ISO): insignia «Dirección editada»; null si la dirección es la original */
  ubicacionEditadaEn?: string | null;
  /** Nombre del cliente (o la mesa si no hay nombre). Nunca teléfono ni DNI. */
  clienteNombre?: string | null;
  total: number;
  /** Propina del pedido (aparte de la venta; 0 = sin propina) */
  propina?: number;
  pagoEstado: string | null;
  /** YAPE | PLIN | TRANSFERENCIA | EFECTIVO | … (null si no se eligió) */
  pagoMetodo: string | null;
  /** Pago dividido: monto por medio (vacío si el pedido no tiene plan) */
  plan?: Array<{ medio: string; monto: number }>;
  /** Parte del plan que lleva voucher (YAPE, PLIN, TRANSFERENCIA) */
  montoDigital?: number;
  /** Cantidad de fotos de voucher ligadas al pedido */
  vouchers: number;
  /** Alguna foto vigente se lee. El mozo nunca ve semáforo ni datos extraídos. */
  tieneVoucherLegible: boolean;
  /** Vigentes (no reemplazados) y total con reemplazados (historial) */
  historialVouchers?: number;
  /** Un voucher por medio digital del plan: subido o falta, con su monto */
  vouchersPorMedio?: Array<{ medio: string; monto: number; subido: boolean; voucherId?: string | null }>;
  /** Regla del servidor (regla-cambio-voucher.ts): la web no la duplica */
  puedeCambiarVoucher?: boolean;
  puedeSubirVoucher?: boolean;
  creadoEn: string;
  /** Lista del pedido, siempre visible en la tarjeta */
  lineas: MiPedidoLinea[];
  /** Cocina y entrega en vivo. Puede faltar en respuestas anteriores. */
  progreso?: ProgresoPedido;
}

export interface RespuestaMisPedidos {
  pedidos: MiPedido[];
  resumen: { cantidad: number; total: number; enCurso: number; entregados: number };
}

/** Un pedido de mesa que espera mesa (GET /admin/salon/espera). El celular viene enmascarado según el rol. */
export interface PedidoEnEspera {
  pedidoId: string;
  codigo: string;
  estado: string;
  nombre: string | null;
  celular: string | null;
  personas: number | null;
  productos: number;
  total: number;
  /** Hora de llegada a la lista (ISO): el minuto de espera se calcula con ella. */
  desde: string;
  minutos: number;
  /** «Mesa 4»: de dónde lo movieron para dar su lugar a otro; null = esperó desde el inicio. */
  movidoDesde?: string | null;
}

export interface RespuestaEspera {
  total: number;
  items: PedidoEnEspera[];
}
