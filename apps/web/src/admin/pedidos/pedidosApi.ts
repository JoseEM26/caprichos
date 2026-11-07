import type { PruebaEntregaFallida } from './PruebaEntregaFallida';
import { marcarAutorizacionSupervisor } from '../../comun/autorizacionSupervisor';
import { api } from '../../comun/api';
import type { PlanPagoItem } from './planPago';

export type EstadoPedido =
  | 'COLA'
  | 'PREPARANDO'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'ANULADO';

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

export interface LineaPedidoOpcion {
  id?: string;
  grupo?: string;
  nombre?: string;
  precio_extra?: number;
  grupo_nombre?: string;
  opcion_nombre?: string;
  nombre_persona?: string | null;
}

export interface LineaPedido {
  id: string;
  pedido_id?: string;
  nombre: string;
  tamano?: string | null;
  cantidad: number;
  precio_unit: string | number;
  subtotal: string | number;
  nota?: string | null;
  nombres_persona?: string[] | null;
  opciones?: LineaPedidoOpcion[];
  opcionesElegidas?: LineaPedidoOpcion[];
  area?: {
    id: string;
    nombre: string;
  } | null;
  /** Cortesía: la línea sale a S/ 0 y su valor de lista va en cortesia.valor_lista */
  es_cortesia?: boolean;
  cortesia?: { valor_lista: string | number } | null;
  producto_id?: string | null;
  oferta_id?: string | null;
  linea_combo_id?: string | null;
}

export interface HistorialEstado {
  id: string;
  pedido_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  por_party_id: string;
  en: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  prueba_entrega?: PruebaEntregaFallida | null;
  canal: string;
  modalidad: string;
  repartidor_party_id?: string | number | null;
  estado: EstadoPedido | string;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  entrega_direccion?: string | null;
  entrega_referencia?: string | null;
  entrega_lat?: number | string | null;
  entrega_lng?: number | string | null;
  zona_id?: number | string | null;
  pago_metodo?: string | null;
  pago_estado?: string | null;
  pago_preferido?: string | null;
  cobro_vigente_id?: string | number | null;
  /** Número del día en cocina (referencial); null si no llegó a cocina */
  numero_dia?: number | null;
  fecha_dia?: string | null;
  /** Último cambio de ubicación (ISO); null si la dirección es la original */
  ubicacion_editada_en?: string | null;
  /** Saldo por cobrar o devolución pendiente por el cambio de ubicación (solo si aplica) */
  ajusteUbicacionPendiente?: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  /** Cobro por mozo (envío a Caja): null si no lo envió o el pedido ya está PAGADO */
  cobroMozo?: {
    en: string;
    medio: string;
    mozo: string | null;
    faltaVoucher: boolean;
    /** Efectivo que recibió el mozo (Pagó con) y el vuelto; null si no hubo efectivo */
    recibido?: number | null;
    vuelto?: number | null;
    /** Comprobante que pidió el mozo (Caja lo emite al cobrar); null si es nota de venta */
    pide?: 'BOLETA' | 'FACTURA' | null;
  } | null;
  paga_con?: string | number | null;
  /** Propina aparte de la venta (el cobro pide venta + propina) */
  propina?: string | number | null;
  /** Pago dividido: monto por medio (vacío si el pedido no tiene plan) */
  planPago?: Array<{ medio: string; monto: string | number }>;
  /** Puntos del pedido (ganados, por ganar o motivo por el que no suma) */
  puntos?: { estado: 'SUMADO' | 'PENDIENTE_DE_COBRO' | 'NO_SUMA'; puntos?: number; estimado?: number; motivo?: string; texto: string } | null;
  subtotal: string | number;
  descuento: string | number;
  envio?: string | number | null;
  total: string | number;
  comprobante_tipo?: string | null;
  comprobante_doc?: string | null;
  comprobante_razon?: string | null;
  comprobante_direccion?: string | null;
  nota?: string | null;
  mesa_nombre?: string | null;
  es_personal?: boolean;
  pago_coordinado_en?: string | null;
  entregado_mesa_en?: string | null;
  creado_en: string;
  minutosEspera?: number;
  color?: ColorEspera;
  colorEspera?: ColorEspera;
  lineas?: LineaPedido[];
  historial?: HistorialEstado[];
  zona?: {
    id: string;
    nombre: string;
    precio: number | string;
  } | null;
}

export interface FiltrosListarPedidos {
  estado?: string;
  canal?: string;
  modalidad?: string;
  buscar?: string;
  pagina?: number;
  limite?: number;
  desde?: string;
  hasta?: string;
  /** Solo días anteriores en curso o con pago pendiente (ignora desde/hasta) */
  pendientes?: boolean;
}

/** Pregunta de reprogramar tras el retiro: esperando, dijo sí/no, sin respuesta, tope o sin pregunta. */
export type PreguntaNoEntregado = 'ESPERANDO' | 'SI' | 'NO' | 'SIN_RESPUESTA' | 'TOPE' | 'SIN_PREGUNTA';

/** Devolución ya registrada de un pedido cancelado por no recibir. */
export interface DevolucionRegistrada {
  id: string;
  montoDevuelto: number;
  medio: string;
  motivo: string | null;
  porNombre: string | null;
  autorizadoPorNombre: string | null;
  comprobanteBajaEstado: string | null;
  creadoEn: string;
}

/** Datos para prellenar la devolución: lo pagado, el envío, el monto sugerido, el medio y el comprobante vigente. */
export interface SugerenciaDevolucion {
  pedidoId: string;
  codigo: string;
  montoPagado: number;
  montoEnvio: number;
  montoSugerido: number;
  medioOriginal: string | null;
  comprobante: { tipo: string; numero: string; bajaEstado: string | null } | null;
}

export interface RegistroDevolucion extends DevolucionRegistrada {
  pedidoId: string;
  /** Si la baja del comprobante no se pudo hacer: consultar al contador. */
  avisoComprobante: string | null;
}

export interface NoEntregado {
  id: string;
  codigo: string;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  total: number;
  motivo: string;
  retirado_en: string | null;
  pregunta: PreguntaNoEntregado;
  pago_estado: string | null;
  revisar_devolucion: boolean;
  devolucion?: DevolucionRegistrada | null;
  prueba_entrega?: PruebaEntregaFallida | null;
}

export interface RespuestaNoEntregados {
  reprogramar: NoEntregado[];
  cancelados: NoEntregado[];
  total: number;
}

export interface RespuestaListarPedidos {
  total: number;
  pagina: number;
  limite: number;
  items: Pedido[];
}

export interface CajaInfo {
  id: string;
  fecha: string;
  apertura: number;
  estado: 'ABIERTA' | 'CERRADA';
  abierta_por: string;
  cerrada_por: string | null;
  cerrada_en: string | null;
}

/** Pedido cobrado en la caja abierta (sin montos esperados). */
export interface CobroTurno {
  pedidoId: string;
  codigo: string;
  cliente: string | null;
  total: number;
  medios: string[];
  en: string;
}

export interface CajaActualRespuesta {
  caja: CajaInfo | null;
  abierta: boolean;
  cajaAnteriorAbierta?: { fecha: string } | null;
  cobrados?: CobroTurno[];
  totalesPorMedio: Record<string, number>;
  resumen: {
    apertura: number;
    cobrosEfectivo: number;
    vueltosEfectivo: number;
    ingresos: number;
    egresos: number;
  };
  efectivoEsperado: number;
}

export interface MovimientoCaja {
  id: string;
  caja_id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  motivo: string;
  anulado_en: string | null;
  motivo_anulacion: string | null;
}

export interface PedidoPorCobrar {
  id: string;
  codigo: string;
  canal: string;
  modalidad: string;
  estado: string;
  pago_estado: string;
  pago_preferido?: string | null;
  pago_metodo: string | null;
  total: number;
  /** Propina aparte de la venta: lo que se cobra es total + propina */
  propina?: number;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  comprobante_tipo: string;
  comprobante_doc: string | null;
  comprobante_razon: string | null;
  creado_en: string;
  minutosEspera: number;
  entrega_lat?: number | null;
  entrega_lng?: number | null;
  zona_id?: string | null;
  entrega_direccion?: string | null;
}

export interface PagoItem {
  medio: string;
  monto: number;
  recibido?: number;
}

export interface CobrarDto {
  pedidoId: string | number;
  pagos: PagoItem[];
  /** Foto del comprobante ya subida (POST /admin/vouchers). Queda enlazada al pedido. */
  voucherId?: string | number;
  /** Cobro digital sin foto: motivo escrito y código rotativo del supervisor. */
  sinVoucher?: { motivo: string; pinSupervisor?: string };
}

export const pedidosApi = {
  /** Cambia el comprobante antes de cobrar (Caja). 409 si ya está cobrado o con comprobante emitido. */
  cambiarComprobante: (pedidoId: string, dto: { tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA'; doc?: string; razon?: string; direccion?: string }) =>
    api.patch<{ id: string; codigo: string; comprobante_tipo: string; comprobante_doc: string | null; comprobante_razon: string | null; comprobante_direccion: string | null }>(
      `/admin/pedidos/${pedidoId}/comprobante`,
      dto,
    ),

  async listar(filtros: FiltrosListarPedidos = {}): Promise<RespuestaListarPedidos> {
    const params = new URLSearchParams();
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.canal) params.append('canal', filtros.canal);
    if (filtros.modalidad) params.append('modalidad', filtros.modalidad);
    if (filtros.buscar) params.append('buscar', filtros.buscar);
    if (filtros.pagina) params.append('pagina', String(filtros.pagina));
    if (filtros.limite) params.append('limite', String(filtros.limite));
    if (filtros.desde) params.append('desde', filtros.desde);
    if (filtros.hasta) params.append('hasta', filtros.hasta);
    if (filtros.pendientes) params.append('pendientes', '1');

    const query = params.toString();
    const ruta = query ? `/admin/pedidos?${query}` : '/admin/pedidos';
    return api.get<RespuestaListarPedidos>(ruta);
  },

  async obtenerPorId(id: string | number): Promise<Pedido> {
    return api.get<Pedido>(`/admin/pedidos/${id}`);
  },

  /** Delivery no entregados: por reprogramar (LISTO sin repartidor) y cancelados por no recibir. */
  async listarNoEntregados(): Promise<RespuestaNoEntregados> {
    return api.get<RespuestaNoEntregados>('/admin/pedidos/no-entregados');
  },

  async sugerenciaDevolucion(id: string | number): Promise<SugerenciaDevolucion> {
    return api.get<SugerenciaDevolucion>(`/admin/pedidos/${id}/devolucion/sugerencia`);
  },

  /** Devolución manual. El código del supervisor va solo si quien registra no es ADMIN ni SUPERVISOR. */
  async registrarDevolucion(
    id: string | number,
    datos: { montoDevuelto: number; medio: string; codigoOperacion?: string; motivo?: string },
    codigoSupervisor?: string,
  ): Promise<RegistroDevolucion> {
    const headers: Record<string, string> = {};
    if (codigoSupervisor) headers['X-Codigo-Supervisor'] = codigoSupervisor.trim();
    const r = await api.post<RegistroDevolucion>(`/admin/pedidos/${id}/devolucion`, datos, { headers });
    if (codigoSupervisor) marcarAutorizacionSupervisor();
    return r;
  },

  async cambiarEstado(
    id: string | number,
    estado: string,
    motivo?: string,
    pinSupervisor?: string,
  ): Promise<Pedido> {
    const headers: Record<string, string> = {};
    if (pinSupervisor) {
      headers['X-Codigo-Supervisor'] = pinSupervisor.trim();
      headers['X-Pin-Supervisor'] = pinSupervisor.trim();
    }
    const r = await api.post<Pedido>(
      `/admin/pedidos/${id}/estado`,
      { estado, motivo },
      { headers },
    );
    if (pinSupervisor) marcarAutorizacionSupervisor();
    return r;
  },

  async ubicarPedido(
    id: string | number,
    dto: { lat: number; lng: number; direccion?: string; referencia?: string },
  ): Promise<{ id: string; codigo: string; zona: string; envio: number; total: number; lat: number; lng: number }> {
    return api.post(`/admin/pedidos/${id}/ubicacion`, dto);
  },

  async registrarPago(
    id: string | number,
    metodo: string,
    estado: 'COORDINADO' | 'PAGADO' = 'PAGADO',
    sinVoucher?: { motivo: string; pinSupervisor?: string },
    codigosOperacion?: Array<{ medio: string; codigo: string }>,
  ): Promise<Pedido> {
    return api.post<Pedido>(`/admin/pedidos/${id}/pago`, {
      metodo,
      estado,
      ...(sinVoucher ? { sinVoucher } : {}),
      ...(codigosOperacion?.length ? { codigosOperacion } : {}),
    });
  },

  async crearPedidoAdmin(
    dto: {
      modalidad: 'DELIVERY' | 'RECOGER' | 'MESA';
      cliente: { nombre: string; telefono: string };
      lineas: Array<{
        productoId: string | number;
        tamanoId?: string | number;
        /** Cortesía de la línea (solo con permiso cortesias/dar): sale a S/ 0 */
        cortesia?: { motivo: string; nota?: string };
        cantidad: number;
        opciones?: (string | number)[];
        nota?: string;
        personas?: string[];
        ofertaId?: string;
        comboElecciones?: { parteId: string; productoId: string; saborId?: string }[];
      }>;
      pago: {
        metodo: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';
        pagaCon?: number;
        /** Pago dividido: monto por medio (el API lo valida contra el total) */
        plan?: PlanPagoItem[];
      };
      entrega?: {
        direccion?: string;
        referencia?: string;
        lat?: number;
        lng?: number;
        origen?: 'GPS' | 'ESCRITA' | 'MAPA' | 'WHATSAPP' | 'ENLACE';
      };
      comprobante?: {
        tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA';
        dni?: string;
        ruc?: string;
        razonSocial?: string;
        direccion?: string;
      };
      nota?: string;
      cuponCodigo?: string;
      /** Cliente con cuenta (celular de 9 dígitos): el pedido suma puntos y guarda la dirección en su libreta */
      clienteTelefono?: string;
      /** Cliente con cuenta elegido en «¿Quién pide?» (id del party), si no va clienteTelefono */
      clientePartyId?: string;
      esPersonal?: boolean;
      colaboradorPartyId?: string | number;
      canal?: 'MOZO' | 'CAJA';
    },
    idempotencyKey?: string,
    /** Solo si hay líneas de cortesía y quien envía es SUPERVISOR: su código de 6 dígitos */
    codigoSupervisor?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    if (codigoSupervisor) {
      headers['x-codigo-supervisor'] = codigoSupervisor;
    }
    try {
      return await api.post('/admin/pedidos', dto, { headers });
    } catch (err: any) {
      if (
        err?.statusCode === 404 ||
        err?.status === 404 ||
        String(err?.message || '').includes('Cannot POST') ||
        String(err?.message || '').includes('Not Found')
      ) {
        return api.post('/pedidos', dto, { headers });
      }
      throw err;
    }
  },

  /** Pago digital sin foto útil: solo con motivo y código del supervisor (sinVoucher). */
  async marcarPagoCoordinado(
    id: string | number,
    sinVoucher?: { motivo: string; pinSupervisor?: string },
  ): Promise<{ id: string; pago_estado: string }> {
    return api.post<{ id: string; pago_estado: string }>(
      `/admin/caja/pedidos/${id}/coordinado`,
      sinVoucher ? { sinVoucher } : {},
    );
  },

  async obtenerCajaActual(): Promise<CajaActualRespuesta> {
    return api.get<CajaActualRespuesta>('/admin/caja/actual');
  },

  async abrirCaja(apertura: number): Promise<CajaInfo> {
    return api.post<CajaInfo>('/admin/caja/abrir', { apertura });
  },

  async cobrar(dto: CobrarDto): Promise<any> {
    return api.post<any>('/admin/caja/cobrar', dto);
  },

  /** Caja rechaza el cobro que envió el mozo: quita la marca y anula la nota de venta emitida. */
  async rechazarCobroMozo(id: string | number, motivo: string): Promise<{ nota_anulada: string | null }> {
    return api.post<{ nota_anulada: string | null }>(`/admin/caja/pedidos/${id}/rechazar-cobro-mozo`, { motivo });
  },

  async anularCobro(id: string | number, motivo: string, pinSupervisor: string): Promise<any> {
    const headers: Record<string, string> = {
      'X-Codigo-Supervisor': pinSupervisor.trim(),
      'X-Pin-Supervisor': pinSupervisor.trim(),
    };
    return api.post<any>(
      `/admin/caja/cobros/${id}/anular`,
      { motivo },
      { headers },
    );
  },

  async listarMovimientos(): Promise<MovimientoCaja[]> {
    return api.get<MovimientoCaja[]>('/admin/caja/movimientos');
  },

  async crearMovimiento(tipo: 'INGRESO' | 'EGRESO', monto: number, motivo: string): Promise<MovimientoCaja> {
    return api.post<MovimientoCaja>('/admin/caja/movimientos', { tipo, monto, motivo });
  },

  async anularMovimiento(id: string | number, motivo: string): Promise<any> {
    return api.post<any>(`/admin/caja/movimientos/${id}/anular`, { motivo });
  },

  async listarPorCobrar(): Promise<PedidoPorCobrar[]> {
    return api.get<PedidoPorCobrar[]>('/admin/caja/por-cobrar');
  },
};
