import { api, clienteFetch } from '../../comun/api';
import { reducirImagenVoucher } from '../vouchers/reducirImagenVoucher';
import { ConfigReparto, CONFIG_REPARTO_DEFECTO } from './calculoRuta';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';

export type ColorEspera = 'verde' | 'amarillo' | 'naranja' | 'rojo';

/** Estado de un área de cocina en un pedido (solo nombre y estado). */
export interface AreaCocinaReparto {
  areaId: string;
  areaNombre: string;
  listo: boolean;
  /** Lo de esa área ya salió en un despacho parcial. */
  despachada: boolean;
}

export interface PedidoReparto {
  /** Check «Cocina»: áreas que participan y cuáles ya están listas. */
  areas?: AreaCocinaReparto[];
  areasListas?: number;
  areasTotal?: number;
  completo?: boolean;
  id: string;
  codigo: string;
  /** Último cambio de ubicación (ISO); null si la dirección es la original */
  ubicacion_editada_en?: string | null;
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
  /** Efectivo que el repartidor debe cobrar en la puerta (según el plan de pago vigente) */
  efectivo_cobrar?: number;
  plan_pago?: Array<{ medio: string; monto: number }>;
  /** Solicitud de cambio de forma de pago esperando a Caja: el pedido no se puede entregar hasta que se resuelva */
  cambio_cobro_pendiente?: { id: string; plan_original: Array<{ medio: string; monto: number }>; plan_solicitado: Array<{ medio: string; monto: number }>; paga_con: number | null; solicitado_en: string } | null;
  repartidor_party_id: string | null;
  /** Posición del pedido en la ruta del repartidor (1, 2, 3...). Solo en /mios. */
  ordenRuta?: number | null;
  /** Número fijo de la parada en la ruta en curso (no cambia al entregar ni al saltar). */
  numeroRuta?: number | null;
  tomado_en: string | null;
  salio_en: string | null;
  llego_en: string | null;
  entregado_en: string | null;
  motivo_falla: string | null;
  alerta_tomado_sin_salir?: boolean;
  minutos_sin_salir?: number;
  creado_en: string;
  cantidad_productos?: number;
  cantidadProductos?: number;
  repartidor?: {
    id: string;
    nombre: string | null;
  } | null;
  por_rendir_efectivo?: number;
  efectivo_a_rendir?: number;
  espera_min?: number | null;
  /** Minutos de espera exigidos antes de poder reportar «cliente no salió». */
  espera_max_min?: number | null;
  espera_agotada?: boolean;
  /** POR_REPROGRAMAR: el cliente dijo SÍ y falta reenviar; REPROGRAMADO: ya volvió a reparto. */
  reprogramacion?: 'POR_REPROGRAMAR' | 'REPROGRAMADO' | null;
  /** Recargo que cobra el reenvío (el mismo que vio el cliente). Solo en POR_REPROGRAMAR. */
  recargoReprogramacion?: number | null;
  /** Pedido que volvió a Para elegir tras reprogramar (marca Reprogramado). */
  reprogramado?: boolean;
}

/** Pedido que aún no se puede tomar (en cocina o por validar): el repartidor solo lo ve. */
export interface PedidoProximo {
  id: string;
  codigo: string;
  clienteNombre: string;
  lat: number | null;
  lng: number | null;
  zona: string | null;
  estado: 'POR_VALIDAR' | 'EN_COCINA';
  estadoTexto: string;
  minutosEspera: number;
  creadoEn: string;
  cantidadProductos: number;
}

/** Detalle de un pedido para la hoja del repartidor. dirección y teléfono solo vienen si el pedido es suyo. */
export interface ResumenRepartidor {
  id: string;
  codigo: string;
  clienteNombre: string;
  estado: string;
  estadoTexto: string;
  minutosEspera: number;
  productos: Array<{
    cantidad: number;
    nombre: string;
    /** Solo en pedidos propios: lo que pidió el cliente */
    tamano?: string | null;
    sabores?: string[];
    opciones?: string[];
    nota?: string | null;
    es_cortesia?: boolean;
  }>;
  nota: string | null;
  zona: string | null;
  puedeTomar: boolean;
  motivoNoTomar: string | null;
  direccion?: string | null;
  referencia?: string | null;
  telefono?: string | null;
  /** Solo en pedidos propios: cobro detallado */
  cobro?: {
    estado: 'PAGADO' | 'FALTA_COBRAR';
    medio: string | null;
    plan: Array<{ medio: string; monto: number }>;
    mixto: boolean;
    total: number;
    propina: number;
    total_cobrable: number;
    efectivo_cobrar: number;
    paga_con: number | null;
    vuelto: number;
    vouchers: Array<{ id: string; medio: string | null; estado: 'VALIDADO' | 'PENDIENTE' | 'ILEGIBLE' }>;
    cortesias: Array<{ nombre: string; cantidad: number }>;
    cambio_pendiente: PedidoReparto['cambio_cobro_pendiente'];
  };
  /** Solo en pedidos propios: horas de cada paso */
  tiempos?: {
    creado_en: string;
    pasa_cocina_en: string | null;
    listo_en: string | null;
    tomado_en: string | null;
    salio_en: string | null;
    llego_en: string | null;
    entregado_en: string | null;
    espera_max_min: number | null;
  };
}

export interface AvisoRepartidor {
  pedido_id: string;
  codigo: string;
  mensaje: string;
  en: string;
}

export type EstadoFinalPedido = 'ENTREGADO' | 'NO_ENTREGADO' | 'ANULADO';

/** Pedido de la ruta en curso: los terminados traen estadoFinal y horaFinal; los pendientes, estadoFinal null. */
export interface PedidoDeRuta extends PedidoReparto {
  estadoFinal: EstadoFinalPedido | null;
  horaFinal: string | null;
  /** Posición en la ruta (los terminados primero, por hora de cierre). */
  orden: number;
}

/** Salida del repartidor con TODOS sus pedidos, también los ya terminados. */
export interface RutaEnCurso {
  id: string;
  iniciadaEn: string;
  estado: 'EN_CURSO' | 'TERMINADA';
  pedidos: PedidoDeRuta[];
}

export interface PedidoHistorialRuta {
  id: string;
  codigo: string;
  clienteNombre: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  estadoFinal: EstadoFinalPedido | null;
  horaFinal: string | null;
  orden: number;
  numeroRuta?: number | null;
}

/** Una ruta ya hecha (o en curso) para el historial: sin montos. */
export interface RutaHistorial {
  id: string;
  repartidorId: string;
  repartidorNombre: string;
  iniciadaEn: string;
  terminadaEn: string | null;
  estado: 'EN_CURSO' | 'TERMINADA';
  totalPedidos: number;
  entregados: number;
  fallidos: number;
  distanciaKm: number;
  pedidos: PedidoHistorialRuta[];
}

export interface RespuestaRutas {
  rutas: RutaHistorial[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface RespuestaMios {
  pedidos: PedidoReparto[];
  /** Ruta en curso con todos sus pedidos (la API la llama rutaReparto porque `ruta` es el trazado). */
  rutaReparto?: RutaEnCurso | null;
  orden: string[];
  paso: string[];
  ruta: Array<[number, number]>;
  avisos?: AvisoRepartidor[];
}

export interface ResumenRepartos {
  lados?: Record<string, number>;
  zonas?: Record<string, number>;
  [key: string]: any;
}

export type EtapaReparto = 'TOMADO' | 'EN_CAMINO' | 'LLEGADO';

export interface RepartidorPanel {
  party_id: string;
  nombre: string;
  /** El administrador que tomó pedidos: reparte como uno más (su nombre lleva «(admin)»). */
  es_admin?: boolean;
  libre: boolean;
  pedidos: Array<PedidoReparto & { etapa: EtapaReparto }>;
  efectivo_por_rendir: number;
}

/** GET /admin/repartos/panel: quién lleva qué, quién está libre y qué falta por tomar. */
export interface PanelRepartidores {
  generado_en: string;
  max_pedidos: number;
  resumen: { repartidores_libres: number; repartidores_ocupados: number; pedidos_sin_tomar: number };
  repartidores: RepartidorPanel[];
  sin_tomar: PedidoReparto[];
}

export type SeccionSeguimiento = 'ESPERANDO' | 'PREPARACION' | 'EN_CAMINO' | 'ENTREGADOS' | 'INCIDENTE';

/** Pedido delivery de hoy en cualquier estado, con su sección y quién lo lleva. */
export interface PedidoSeguimiento extends PedidoReparto {
  seccion: SeccionSeguimiento;
  etapa: EtapaReparto | null;
}

export interface Seguimiento {
  generado_en: string;
  pedidos: PedidoSeguimiento[];
}

export interface PedidoPerdido {
  pedidoId: string;
  codigo: string;
  motivo: 'OTRO_REPARTIDOR' | 'NO_DISPONIBLE' | 'LIMITE' | 'ANULADO' | 'COBRO_PENDIENTE';
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

/** Chat de WhatsApp de un pedido propio del repartidor (solo esa conversación). */
export interface MensajeChatRepartidor {
  id: string;
  de: 'cliente' | 'local';
  texto: string;
  en: string;
}

export interface ChatRepartidor {
  disponible: boolean;
  motivo?: string;
  cliente?: { nombre: string; telefono: string };
  ventanaAbierta?: boolean;
  atendidoPorLocal?: boolean;
  mensajes?: MensajeChatRepartidor[];
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
  /** Prueba de entrega fallida (cliente no salió): de 1 a 3 fotos privadas del lugar. */
  fotoArchivoIds?: string[];
}

export interface ResolverFallaDto {
  nota: string;
  cierre?: 'REPROGRAMADO' | 'DEVUELTO' | 'COBRADO_IGUAL';
  recargo?: number;
}

export type MotivoSalto = 'NO_CONTESTA' | 'DIRECCION_NO_ENCONTRADA' | 'TRAFICO' | 'OTRO';

export interface ParadaOpcionRuta {
  id: string;
  codigo: string;
  cliente: string;
  orden: number;
  lat: number;
  lng: number;
  llegadaMin: number;
  llegadaEstimada: string;
  retrasoMin: number;
  yaTarde: boolean;
}

export interface OpcionRutaSugerida {
  id: string;
  sector: string;
  rumbo: number;
  pedidos: ParadaOpcionRuta[];
  distanciaKm: number;
  tiempoMin: number;
  retrasoTotalMin: number;
  yaTarde: number;
  urgente: boolean;
  razon: string;
  puntaje: number;
  ruta: Array<[number, number]>;
}

export interface RespuestaRutasSugeridas {
  opciones: OpcionRutaSugerida[];
  sinUbicacion: Array<{ id: string; codigo: string; cliente: string }>;
  cupo: number;
}

function consultaRutas(filtros?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros ?? {})) if (v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface ContadoresDelivery {
  enCocina: number;
  listos: number;
  enCamino: number;
  pendientes: number;
  entregadosHoy: number;
}

export const repartosApi = {
  contadoresDelivery: () => api.get<ContadoresDelivery>('/admin/repartos/contadores'),

  listarRutasSugeridas: () =>
    api.get<RespuestaRutasSugeridas>('/admin/repartos/rutas-sugeridas'),

  tomarRutaSugerida: (opcion: OpcionRutaSugerida, repartidorPartyId?: string) =>
    api.post<{ idOpcion: string; tomados: PedidoReparto[] }>(
      `/admin/repartos/rutas-sugeridas/${opcion.id}/tomar`,
      { pedidoIds: opcion.pedidos.map((p) => p.id), ...(repartidorPartyId ? { repartidorPartyId } : {}) },
    ),

  listarDisponibles: () =>
    api.get<PedidoReparto[]>('/admin/repartos/disponibles'),

  listarMios: () =>
    api.get<RespuestaMios>('/admin/repartos/mios'),

  /** Rutas propias del repartidor (por defecto hoy, hora de Lima). Fechas YYYY-MM-DD. */
  listarMisRutas: (filtros?: { desde?: string; hasta?: string; pagina?: number }) =>
    api.get<RespuestaRutas>(`/admin/repartos/mis-rutas${consultaRutas(filtros)}`),

  /** Rutas de cualquier repartidor (caja/admin). */
  listarRutas: (filtros?: { repartidor?: string; desde?: string; hasta?: string; pagina?: number }) =>
    api.get<RespuestaRutas>(`/admin/repartos/rutas${consultaRutas(filtros)}`),

  listarProximos: () =>
    api.get<PedidoProximo[]>('/admin/repartos/proximos'),

  obtenerResumenRepartidor: (id: string) =>
    api.get<ResumenRepartidor>(`/admin/repartos/${id}/resumen-repartidor`),

  /** Toma varios pedidos a la vez en el orden elegido. Un 409 trae el motivo en el mensaje. */
  tomarRuta: (ids: string[]) =>
    api.post<unknown>('/admin/repartos/tomar-ruta', { ids }),

  obtenerResumen: () =>
    api.get<ResumenRepartos>('/admin/repartos/resumen'),

  obtenerPanel: () => api.get<PanelRepartidores>('/admin/repartos/panel'),

  obtenerSeguimiento: () => api.get<Seguimiento>('/admin/repartos/seguimiento'),

  obtenerChat: (pedidoId: string) =>
    api.get<ChatRepartidor>(`/admin/repartos/${pedidoId}/chat/mensajes`),

  enviarChat: (pedidoId: string, texto: string) =>
    api.post<{ id: string }>(`/admin/repartos/${pedidoId}/chat/mensajes`, { texto }),

  consultarMensajes: (id: string) =>
    api.get<MensajeReparto[]>(`/admin/repartos/${id}/mensajes`),

  listarTodos: (filtros?: { repartidor?: string; estado?: string; historial?: string }) => {
    const params = new URLSearchParams();
    if (filtros?.repartidor) params.set('repartidor', filtros.repartidor);
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.historial) params.set('historial', filtros.historial);
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

  /** ADMIN y SUPERVISOR: asigna el repartidor (si hace falta) y cierra el reparto por él; el repartidor figura como quien entregó. */
  cerrarPorRepartidor: (id: string, repartidorPartyId: string, motivo: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/cerrar-por-repartidor`, { repartidorPartyId, motivo }),

  /** `sinCobro`: solo el administrador, con motivo, cuando el pedido digital aún no está cobrado. */
  salir: (id: string, sinCobro?: { forzarSinCobro: true; motivo: string }) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/salir`, sinCobro ?? {}),

  /** Reordena la ruta por cercanía empezando por este pedido (solo antes de salir). */
  empezarPor: (id: string) =>
    api.post<{ orden: Array<{ id: string; codigo: string; ordenRuta: number; numeroRuta?: number }> }>(`/admin/repartos/${id}/empezar-por`),

  /** El pedido que toca pasa al final del orden; la API guarda el motivo y limita a 2 saltos. */
  saltar: (id: string, dto: { motivo: MotivoSalto; detalle?: string }) =>
    api.post<{ id: string; ordenRuta: number; numeroRuta?: number | null; siguienteNumeroRuta?: number | null }>(`/admin/repartos/${id}/saltar`, dto),

  llegue: (id: string) =>
    api.post<PedidoReparto>(`/admin/repartos/${id}/llegue`),

  /** Cierra la ruta en curso sin orden; con EN_CAMINO sin resolver responde 409 RUTA_CON_PENDIENTES (detalles.pedidos). */
  cerrarRuta: (repartidorId?: string) =>
    api.post<{ ok: boolean; rutaId: string; cerrada: boolean; liberados: number }>('/admin/repartos/ruta/cerrar', repartidorId ? { repartidorId } : {}),

  /** El repartidor devuelve al local un pedido suyo que ya salió. */
  devolverAlLocal: (id: string) => api.post<{ ok: boolean }>(`/admin/repartos/${id}/devolver-local`),

  entregar: (id: string, sinCobro?: { forzarSinCobro: true; motivo: string }) =>
    api.post<PedidoReparto & { por_rendir_efectivo?: number; efectivo_a_rendir?: number }>(
      `/admin/repartos/${id}/entregar`,
      sinCobro ?? {},
    ),

  /** Sube una foto del lugar como archivo privado (reducida antes, para conexiones lentas). Devuelve su id. */
  subirFotoPrueba: async (foto: File): Promise<string> => {
    const reducida = await reducirImagenVoucher(foto, 1280, 0.8);
    const fd = new FormData();
    fd.append('archivo', reducida, 'prueba-entrega.jpg');
    fd.append('privado', 'true');
    const r = await clienteFetch<{ id: string }>('/admin/archivos', { method: 'POST', body: fd });
    return r.id;
  },

  reportarFalla: (id: string, dto: ReportarFallaDto) =>
    api.post<{ ok: boolean; incidenteId: string; intento: number; pedido: any }>(
      `/admin/repartos/${id}/reportar`,
      dto,
    ),

  reprogramarPedido: (id: string) =>
    api.post<{ ok: boolean; pedido: any }>(`/admin/repartos/${id}/reprogramar`, {}),

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
