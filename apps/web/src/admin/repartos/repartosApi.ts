import { api } from '../../comun/api';
import { ConfigReparto, CONFIG_REPARTO_DEFECTO } from './calculoRuta';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';

export type ColorEspera = 'verde' | 'amarillo' | 'naranja' | 'rojo';

export interface PedidoReparto {
  id: string;
  codigo: string;
  modalidad: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string | null;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  zona: string | null;
  zona_id: string | null;
  minutosEspera: number;
  color: ColorEspera;
  total: number;
  pago_estado: string;
  pago_metodo: string;
  cobro_pendiente_efectivo: boolean;
  cobroPendienteEfectivo?: boolean;
  paga_con: number | null;
  repartidor_party_id: string | null;
  tomado_en: string | null;
  salio_en: string | null;
  llego_en: string | null;
  entregado_en: string | null;
  motivo_falla: string | null;
  alerta_tomado_sin_salir?: boolean;
  minutos_sin_salir?: number;
  creado_en: string;
  repartidor?: {
    id: string;
    nombre: string | null;
  } | null;
  por_rendir_efectivo?: number;
  efectivo_a_rendir?: number;
}

export interface RespuestaMios {
  pedidos: PedidoReparto[];
  orden: string[];
  paso: string[];
  ruta: Array<[number, number]>;
}

export interface ResumenRepartos {
  lados?: Record<string, number>;
  zonas?: Record<string, number>;
  [key: string]: any;
}

export interface PedidoPerdido {
  pedidoId: string;
  codigo: string;
  motivo: 'OTRO_REPARTIDOR' | 'NO_DISPONIBLE' | 'LIMITE' | 'ANULADO';
  tomadoPor?: string;
}

export interface RespuestaIniciarRuta {
  tomados: PedidoReparto[];
  perdidos: PedidoPerdido[];
}

export interface LiberarPedidoDto {
  motivo: string;
}

export interface ReasignarPedidoDto {
  repartidorPartyId: string;
  motivo: string;
}

export interface MensajeReparto {
  pedido_id: string;
  numero: number;
  enviado_en: string;
  respondido_en: string | null;
  estado: string;
}

export interface ContactoIntento {
  tipo: 'LLAMADA' | 'WHATSAPP';
  en?: string;
}

export interface ReportarFallaDto {
  motivo: 'NO_CONTESTA' | 'DIRECCION_NO_ENCONTRADA';
  contactos: ContactoIntento[];
  fotoArchivoId?: number | string;
}

export interface ResolverFallaDto {
  nota: string;
  cierre?: 'REPROGRAMADO' | 'DEVUELTO' | 'COBRADO_IGUAL';
  recargo?: number;
}

export const repartosApi = {
  listarDisponibles: () =>
    api.get<PedidoReparto[]>('/admin/repartos/disponibles'),

  listarMios: () =>
    api.get<RespuestaMios>('/admin/repartos/mios'),

  obtenerResumen: () =>
    api.get<ResumenRepartos>('/admin/repartos/resumen'),

  consultarMensajes: (id: string) =>
    api.get<MensajeReparto[]>(`/admin/repartos/${id}/mensajes`),

  listarTodos: (filtros?: { repartidor?: string; estado?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.repartidor) params.set('repartidor', filtros.repartidor);
    if (filtros?.estado) params.set('estado', filtros.estado);
    const qs = params.toString();
    return api.get<PedidoReparto[]>(`/admin/repartos${qs ? `?${qs}` : ''}`);
  },

  tomarPedido: (id: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/tomar`),

  iniciarRuta: (body: { pedidoIds: string[] }) =>
    api.post<RespuestaIniciarRuta>('/admin/repartos/iniciar-ruta', body),

  liberarPedido: (id: string, motivo: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/liberar`, { motivo }),

  reasignarPedido: (id: string, repartidorPartyId: string, motivo: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/reasignar`, { repartidorPartyId, motivo }),

  salir: (id: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/salir`),

  llegue: (id: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/llegue`),

  entregar: (id: string) =>
    api.post<PedidoReparto & { por_rendir_efectivo?: number; efectivo_a_rendir?: number }>(
      `/admin/repartos/${id}/entregar`,
    ),

  reportarFalla: (id: string, dto: ReportarFallaDto) =>
    api.post<{ ok: boolean; incidenteId: string; intento: number; pedido: any }>(
      `/admin/repartos/${id}/reportar`,
      dto,
    ),

  resolverFalla: (id: string, dto: ResolverFallaDto) =>
    api.post<{ ok: boolean; pedido: any }>(
      `/admin/repartos/${id}/resolver`,
      dto,
    ),

  obtenerConfig: async (): Promise<ConfigReparto> => {
    try {
      const res = await api.get<ConfigReparto>('/admin/repartos/config');
      return {
        ...CONFIG_REPARTO_DEFECTO,
        ...res,
      };
    } catch {
      return CONFIG_REPARTO_DEFECTO;
    }
  },

  obtenerZonasPoligonos: async (): Promise<ZonaGeoItem[]> => {
    try {
      const zonas = await api.get<Array<{ codigo: string; poligono: any }>>('/admin/zonas');
      if (Array.isArray(zonas) && zonas.length > 0) {
        return ZONAS_GEO_DEFECTO.map((def) => {
          const match = zonas.find((z) => z.codigo === def.codigo);
          if (match && Array.isArray(match.poligono) && match.poligono.length > 0) {
            return {
              ...def,
              poligonos: [match.poligono],
            };
          }
          return def;
        });
      }
    } catch {
      // Fallback a los polígonos oficiales
    }
    return ZONAS_GEO_DEFECTO;
  },
};
