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
    mozo: string | null;
    total?: number;
    lineas?: Array<{ cantidad: number; nombre: string; detalle: string }>;
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
