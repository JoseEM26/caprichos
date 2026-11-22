import { api } from '../../comun/api';

/** Respuesta de GET /admin/salon/en-vivo (solo lectura, sin teléfonos ni documentos ni montos). */
export type EstadoMesaVivo = 'LIBRE' | 'ESPERANDO' | 'COMIENDO' | 'POR_COBRAR' | 'RESERVADA';

export interface ElementoVivo {
  id: string;
  tipo: string;
  nombre: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  numero: number | null;
  asientos: number | null;
  activo: boolean;
}

export interface PisoVivo {
  id: string;
  nombre: string;
  cuadriculaAncho: number;
  cuadriculaAlto: number;
  elementos: ElementoVivo[];
}

/** Avatar del cliente del pedido: solo retrato (URL pública) y configuración 3D. */
export interface AvatarVivo {
  url: string | null;
  config: object | null;
}

export interface PedidoVivo {
  id: string;
  codigo: string;
  modalidad: string;
  estado: string;
  cliente: string | null;
  mesas: string[];
  mesaIds: string[];
  minutos: number;
  productos: number;
  bebidas?: number;
  items: string[];
  areas: Array<{ nombre: string; estado: 'PENDIENTE' | 'LISTA' }>;
  avatar?: AvatarVivo | null;
}

export interface MesaVivo {
  id: string;
  pisoId: string;
  numero: number | null;
  nombre: string;
  asientos: number;
  estado: EstadoMesaVivo;
  pedido: { codigo: string; personas: number | null; bebidas?: number; minutos: number; areasPendientes: string[]; avatar?: AvatarVivo | null } | null;
  reserva: { hora: string; nombre: string; personas: number } | null;
}

export interface SalonVivo {
  generadoEn: string;
  cajaAbierta: boolean;
  pisos: PisoVivo[];
  mesas: MesaVivo[];
  caja: PedidoVivo[];
  cocina: PedidoVivo[];
  despacho: PedidoVivo[];
  enReparto: PedidoVivo[];
  reservas: Array<{ hora: string; nombre: string; personas: number; mesas: string[] }>;
  cargaCocina: Array<{ area: string; pendientes: number }>;
  conteos: {
    pedidosHoy: number;
    entregadosHoy: number;
    deliveryEntregadosHoy: number;
    mesasOcupadas: number;
    mesasTotal: number;
    personas: number;
    minutosCocinaPromedio: number | null;
  };
}

export const salonVivoApi = {
  obtener: () => api.get<SalonVivo>('/admin/salon/en-vivo'),
};
