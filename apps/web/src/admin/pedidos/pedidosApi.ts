import type { PruebaEntregaFallida } from './PruebaEntregaFallida';
import { api } from '../../comun/api';
import type { PlanPagoItem } from './planPago';

export type EstadoPedido =
  | 'PROGRAMADO'
  | 'COLA'
  | 'PREPARANDO'
  | 'LISTO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'ANULADO';

export interface PedidoProgramado {
  id: string;
  codigo: string;
  canal: string;
  modalidad: string;
  clienteNombre: string | null;
  total: number;
  adelanto: number;
  saldo: number;
  programadoPara: string;
  pagoEstado: string | null;
}

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

/** Línea del editor de pedidos tal como la guardó el servidor (con la selección que se eligió). */
export interface LineaEdicionPedido {
  lineaId: string;
  productoId: string | null;
  nombre: string;
  tamano: string | null;
  tamanoId: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  opciones: Array<{ id: string | null; nombre: string; grupo?: string; precioExtra: number }>;
  sabores: Array<{ saborId: string; nombre: string; cantidad: number }>;
  nota: string | null;
  personas: string[];
  ofertaId: string | null;
  /** Combo: solo se puede quitar o dejar tal cual */
  bloqueada: boolean;
  partesCombo: Array<{ nombre: string; cantidad: number }>;
}

export interface DatosEdicionPedido {
  id: string;
  codigo: string;
  version: number;
  estado: string;
  modalidad: 'DELIVERY' | 'RECOGER' | 'MESA' | 'COMER_LOCAL';
  canal: string;
  mesa?: string | null;
  cliente: { nombre: string | null; telefono: string | null };
  entrega: { direccion: string | null; referencia: string | null; lat: number | null; lng: number | null; origen: string | null; zona: string | null };
  subtotal: number;
  descuento: number;
  envio: number | null;
  total: number;
  propina: number;
  tieneVoucher: boolean;
  editandoPor: { partyId: string; nombre: string } | null;
  lineas: LineaEdicionPedido[];
}

export interface EdicionPedidoPayload {
  version: number;
  lineas: Array<{
    lineaId?: string;
    productoId: string | number;
    tamanoId?: string | number;
    cantidad: number;
    opciones?: (string | number)[];
    nota?: string;
    ofertaId?: string;
    comboElecciones?: { parteId: string | number; productoId: string | number; saborId?: string | number }[];
    personas?: string[];
    sabores?: { saborId: string | number; cantidad: number }[];
  }>;
  cliente?: { nombre: string; telefono?: string };
  modalidad?: 'DELIVERY' | 'RECOGER' | 'MESA' | 'COMER_LOCAL';
  entrega?: { direccion?: string; referencia?: string; lat?: number; lng?: number; origen?: 'GPS' | 'ESCRITA' | 'MAPA' | 'WHATSAPP' | 'ENLACE' };
}

export interface LineaPedidoOpcion {
  id?: string;
  grupo?: string;
  nombre?: string;
  precio_extra?: number;
  grupo_nombre?: string;
  opcion_nombre?: string;
  nombre_persona?: string | null;
}

/** Quién dio la cortesía, cuándo y por qué (se ve al tocar el ⓘ de la insignia). */
export interface FichaCortesia {
  valor_lista: string | number;
  motivo?: string;
  motivo_etiqueta?: string;
  nota?: string | null;
  dada_por?: string | null;
  creado_en?: string;
}

export type TipoEventoPedido = 'cortesia' | 'edicion' | 'cobro' | 'anulacion' | 'estado' | 'otro';

/** Evento de la línea de tiempo del pedido (historial y auditoría). */
export interface EventoPedido {
  id: string;
  tipo: TipoEventoPedido;
  titulo: string;
  detalle: string | null;
  en: string;
  por: string | null;
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
  sabor?: string | null;
  /** Reparto por sabor (mezcla) */
  sabores?: Array<{ saborId?: string; nombre?: string; sabor_nombre?: string; cantidad: number }>;
  opciones?: LineaPedidoOpcion[];
  opcionesElegidas?: LineaPedidoOpcion[];
  area?: {
    id: string;
    nombre: string;
  } | null;
  /** Cortesía: la línea sale a S/ 0 y su valor de lista va en cortesia.valor_lista */
  es_cortesia?: boolean;
  cortesia?: FichaCortesia | null;
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

export interface ResumenExtra {
  id: string;
  codigo: string;
  estado: string;
  pago_estado: string | null;
  total: number;
}

export interface Pedido {
  id: string;
  codigo: string;
  prueba_entrega?: PruebaEntregaFallida | null;
  canal: string;
  modalidad: string;
  repartidor_party_id?: string | number | null;
  estado: EstadoPedido | string;
  /** Pedido programado: fecha y hora pactadas (ISO) y lo adelantado (ya entró a la caja del día en que se recibió) */
  programado_para?: string | null;
  adelanto_total?: number | string | null;
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
  /** Solo con el Control de almacén encendido y el pedido con consumo de insumos registrado: al anular hay que decidir. */
  tieneConsumoAlmacen?: boolean;
  /** Último cambio de pago (Caja, mozo o repartidor): quién, cuándo y «Pago modificado: antes → ahora» */
  ajustePago?: { por: string | null; en: string; texto: string } | null;
  /** Número del día en cocina (referencial); null si no llegó a cocina */
  numero_dia?: number | null;
  fecha_dia?: string | null;
  /** Último cambio de ubicación (ISO); null si la dirección es la original */
  ubicacion_editada_en?: string | null;
  /** Saldo por cobrar o devolución pendiente por el cambio de ubicación (solo si aplica) */
  ajusteUbicacionPendiente?: { tipo: 'SALDO' | 'DEVOLUCION'; monto: number } | null;
  /** «Pedido extra»: el pedido original al que se enlaza (null si es un pedido normal) */
  pedido_origen?: { id: string; codigo: string } | null;
  /** Extras de este pedido (pedidos aparte, con su propio pago y comprobante) */
  extras?: ResumenExtra[];
  /** Total del pedido más sus extras vigentes; null si no tiene extras */
  total_con_extras?: number | null;
  /** Cobro por mozo (envío a Caja): null si no lo envió o el pedido ya está PAGADO */
  cobroMozo?: {
    en: string;
    medio: string;
    mozo: string | null;
    faltaVoucher: boolean;
    /** El mozo confirmó que el cliente ya pagó sin captura (Caja no exige voucher) */
    sinCaptura?: boolean;
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
  /** Promociones, cupón y descuento del personal aplicados (con su monto) */
  descuento_detalle?: unknown;
  puntos_canjeados?: string | number | null;
  /** Canje de puntos en el local: cuántos y quién lo aplicó (auditoría CANJE_PUNTOS_LOCAL) */
  canjePuntos?: { puntos: number; aplicadoPor: string | null } | null;
  envio?: string | number | null;
  total: string | number;
  comprobante_tipo?: string | null;
  comprobante_doc?: string | null;
  comprobante_razon?: string | null;
  comprobante_direccion?: string | null;
  nota?: string | null;
  mesa_nombre?: string | null;
  es_personal?: boolean;
  /** Parte a crédito del personal (delivery con crédito): no se cobra; se cobra total - monto_credito (el envío) */
  monto_credito?: string | number | null;
  pago_coordinado_en?: string | null;
  entregado_mesa_en?: string | null;
  entregado_en?: string | null;
  despachado_en?: string | null;
  creado_en: string;
  minutosEspera?: number;
  color?: ColorEspera;
  colorEspera?: ColorEspera;
  lineas?: LineaPedido[];
  historial?: HistorialEstado[];
  /** Línea de tiempo ya armada por el servidor: estados, cortesías, ediciones, cobros y anulaciones */
  eventos?: EventoPedido[];
  zona?: {
    id: string;
    nombre: string;
    precio: number | string;
  } | null;
  /** Medios con los que se pagó (EFECTIVO, YAPE...); lo trae el servidor de Caja si ya lo soporta. */
  mediosPago?: string[];
  /** Quién atendió el pedido (mozo o cajero) y cuándo (ISO), como los manda el servidor de Caja. */
  atendidoPorNombre?: string | null;
  atendidoEn?: string | null;
  /** Quién cobró y cuándo (ISO). */
  cobradoPorNombre?: string | null;
  cobradoEn?: string | null;
  /** Segundos desde que se creó hasta que se cerró; null si sigue abierto. */
  tiempoTotalSeg?: number | null;
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
  /** Pide también el conteo agrupado por estado y cobro de todo el filtro */
  resumen?: boolean;
  /** Medios de pago (EFECTIVO, YAPE...); el servidor deja los pedidos pagados con alguno de ellos */
  medios?: string[];
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
  /** Cancelado otro día: sigue aquí solo porque falta registrar la devolución. */
  de_dias_anteriores?: boolean;
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
  /** Miembros de una cuenta (original o extras) que la página no trajo: solo para armar la tarjeta; no cuentan en total ni resumen */
  relacionados?: Pedido[];
  /** Solo con resumen=1: una fila por estado y estado de pago */
  resumen?: { estado: string; pago_estado: string | null; n: number; total: number }[];
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
  /** Monto inicial oficial (S/): precarga la apertura. */
  montoInicialOficial?: number;
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
  tipo: 'INGRESO' | 'EGRESO' | 'INFORMATIVO';
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
  /** Cobro digital sin foto: motivo escrito (queda auditado). */
  sinVoucher?: { motivo: string };
  /** Casilla única «ya hablé con el cliente y pagó» (pedido del local, sin captura). */
  confirmaSinCaptura?: boolean;
  /** Propina escrita al cobrar un pedido que aún no la tiene (monto libre, aparte de la venta). */
  propina?: number;
}

/** Excepción a la foto: la casilla del local viaja como confirmaSinCaptura; el resto, con motivo. */
function cuerpoSinVoucher(sv?: { motivo: string; sinCaptura?: boolean }) {
  if (!sv) return {};
  return sv.sinCaptura ? { confirmaSinCaptura: true } : { sinVoucher: { motivo: sv.motivo } };
}

/** Qué pasa con el dinero al anular un pedido ya pagado. */
export interface DestinoDineroAnulacion {
  destinoDinero: 'DEVOLVER' | 'REPROGRAMAR';
  devolucionMedio?: string;
  devolucionMonto?: number;
  devolucionCodigo?: string;
}

export interface RespuestaRevertir {
  id: string;
  codigo: string;
  estado: string;
  cobroReactivado: boolean;
  avisoCobro: string | null;
  pendientes: string[];
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
    if (filtros.resumen) params.append('resumen', '1');
    if (filtros.medios?.length) params.append('medios', filtros.medios.join(','));

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

  /** Devolución manual (queda auditada a nombre de quien la registra). */
  async registrarDevolucion(
    id: string | number,
    datos: { montoDevuelto: number; medio: string; codigoOperacion?: string; motivo?: string },
  ): Promise<RegistroDevolucion> {
    return api.post<RegistroDevolucion>(`/admin/pedidos/${id}/devolucion`, datos);
  },

  /** `forzar`: solo el administrador, con motivo, cuando Cocina aún no despejó el pedido. */
  async cambiarEstado(id: string | number, estado: string, motivo?: string, forzar?: boolean, consumoAlmacen?: 'MERMA' | 'DEVOLVER', forzarSinCobro?: boolean, dinero?: DestinoDineroAnulacion): Promise<Pedido> {
    const cuerpo: Record<string, unknown> = forzar ? { estado, motivo, forzar: true } : { estado, motivo };
    if (dinero) Object.assign(cuerpo, dinero);
    if (forzarSinCobro) cuerpo.forzarSinCobro = true;
    if (consumoAlmacen) cuerpo.consumoAlmacen = consumoAlmacen;
    return api.post<Pedido>(`/admin/pedidos/${id}/estado`, cuerpo);
  },

  /** Revertir un pedido anulado (solo ADMIN y SUPERVISOR; motivo obligatorio). */
  async revertirAnulacion(id: string | number, motivo: string): Promise<RespuestaRevertir> {
    return api.post<RespuestaRevertir>(`/admin/pedidos/${id}/revertir-anulacion`, { motivo });
  },

  /** «Volver atrás» un pedido entregado por error (solo Caja y Administrador; motivo obligatorio). */
  async reabrir(id: string | number, motivo: string): Promise<Pedido> {
    return api.post<Pedido>(`/admin/pedidos/${id}/reabrir`, { motivo });
  },

  async ubicarPedido(
    id: string | number,
    dto: { lat: number; lng: number; direccion?: string; referencia?: string },
  ): Promise<{ id: string; codigo: string; zona: string; envio: number; total: number; lat: number; lng: number }> {
    return api.post(`/admin/pedidos/${id}/ubicacion`, dto);
  },

  async corregirCliente(
    id: string | number,
    dto: { nombre: string; telefono: string; direccion?: string; referencia?: string; motivo?: string },
  ): Promise<{ avisosPendientes: number; numeroDeCuenta: string | null }> {
    return api.patch(`/admin/pedidos/${id}/cliente`, dto);
  },

  /** Cambia o agrega medios de pago (siempre disponible, sin código de supervisor ni aprobación). */
  async ajustarPago(
    id: string | number,
    dto: { plan: Array<{ medio: string; monto: number }>; pagaCon?: number | null; motivo?: string },
  ): Promise<{ ok: boolean; mensaje: string; avisos: string[]; ajustePosteriorAlCierre: boolean }> {
    return api.post(`/admin/pedidos/${id}/pago/ajustar`, dto);
  },

  async registrarPago(
    id: string | number,
    metodo: string,
    estado: 'COORDINADO' | 'PAGADO' = 'PAGADO',
    sinVoucher?: { motivo: string; sinCaptura?: boolean },
    codigosOperacion?: Array<{ medio: string; codigo: string }>,
  ): Promise<Pedido> {
    return api.post<Pedido>(`/admin/pedidos/${id}/pago`, {
      metodo,
      estado,
      ...cuerpoSinVoucher(sinVoucher),
      ...(codigosOperacion?.length ? { codigosOperacion } : {}),
    });
  },

  /** «Editar pedido»: datos del pedido (líneas con su selección, cliente, entrega) y su versión. 409 si ya no se puede editar. */
  async obtenerParaEditar(id: string | number): Promise<DatosEdicionPedido> {
    return api.get<DatosEdicionPedido>(`/admin/pedidos/${id}/editar`);
  },

  /** «Agregar extra»: crea un pedido enlazado a este (hereda cliente, modalidad, mesa o dirección; sin envío). */
  async crearExtra(
    id: string | number,
    dto: {
      lineas: unknown[];
      pago: { metodo: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA'; pagaCon?: number; plan?: PlanPagoItem[] };
      comprobante?: { tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA'; dni?: string; ruc?: string; razonSocial?: string; direccion?: string };
      nota?: string;
    },
    idempotencyKey?: string,
  ): Promise<any> {
    const headers: Record<string, string> = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    return api.post(`/admin/pedidos/${id}/extra`, dto, { headers });
  },

  /** Guarda la edición. 409 PEDIDO_MODIFICADO si alguien lo cambió antes (version vieja). */
  async guardarEdicion(id: string | number, dto: EdicionPedidoPayload): Promise<{ id: string; codigo: string; version: number; estado: string; total: number; totalAnterior: number; cambios: string[] }> {
    return api.post(`/admin/pedidos/${id}/editar`, dto);
  },

  /** Avisa a las demás pantallas que este usuario abrió (true) o cerró (false) el editor del pedido. */
  async avisarEditando(id: string | number, activo: boolean): Promise<void> {
    await api.post(`/admin/pedidos/${id}/editando`, { activo });
  },

  /** Pedidos programados (para otro día), del más próximo al más lejano. */
  async listarProgramados(): Promise<PedidoProgramado[]> {
    return api.get<PedidoProgramado[]>('/admin/pedidos/programados');
  },

  /** Adelanto en efectivo o tarjeta de un pedido programado: entra a la caja de hoy. */
  async registrarAdelanto(id: string | number, dto: { medio: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA'; monto: number; pagaCon?: number; voucherId?: string | number }): Promise<{ adelantoId: string; adelantoTotal: number; saldo: number }> {
    return api.post(`/admin/pedidos/${id}/adelanto`, dto);
  },

  /** Anula un programado; con adelanto, «se devuelve» (egreso de la caja de hoy si es efectivo y su caja ya cerró). */
  async anularProgramado(id: string | number, motivo: string, devuelveAdelanto: boolean): Promise<unknown> {
    return api.post(`/admin/pedidos/${id}/estado`, { estado: 'ANULADO', motivo, ...(devuelveAdelanto ? { adelanto: 'DEVUELVE' } : {}) });
  },

  /** «Se reprograma»: cambia la fecha y hora de un programado (mueve también su reserva de mesa). */
  async reprogramar(id: string | number, programadoPara: string): Promise<{ id: string; programadoPara: string }> {
    return api.post(`/admin/pedidos/${id}/reprogramar`, { programadoPara });
  },

  async crearPedidoAdmin(
    dto: {
      modalidad: 'DELIVERY' | 'RECOGER' | 'MESA' | 'COMER_LOCAL';
      cliente: { nombre: string; telefono?: string };
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
        /** Pago dividido: monto por medio (el API lo valida contra el total + propina) */
        plan?: PlanPagoItem[];
      };
      /** Propina de monto libre, aparte de la venta (se ignora con el canal apagado) */
      propina?: number;
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
      /** Programar para otra fecha (ISO). Solo Caja y mozo */
      programadoPara?: string;
      /** Adelanto de hoy al programar (efectivo o tarjeta) */
      adelanto?: { medio: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA'; monto: number; pagaCon?: number; voucherId?: string | number };
      /** Solo MESA programada: reserva de mesa que se crea con el pedido */
      reserva?: { mesas: string[]; personas: number; confirmarCapacidad?: boolean };
    },
    idempotencyKey?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
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

  /** Pago digital sin foto útil: solo con motivo (sinVoucher). */
  async marcarPagoCoordinado(
    id: string | number,
    sinVoucher?: { motivo: string; sinCaptura?: boolean },
  ): Promise<{ id: string; pago_estado: string }> {
    return api.post<{ id: string; pago_estado: string }>(
      `/admin/caja/pedidos/${id}/coordinado`,
      cuerpoSinVoucher(sinVoucher),
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

  async anularCobro(id: string | number, motivo: string): Promise<any> {
    return api.post<any>(
      `/admin/caja/cobros/${id}/anular`,
      { motivo },
    );
  },

  /** Solo ADMIN: anula el cobro de una caja ya cerrada; el efectivo sale como egreso de ajuste en la caja de hoy. */
  async anularCobroCajaCerrada(id: string | number, motivo: string): Promise<any> {
    return api.post<any>(`/admin/caja/cobros/${id}/anular-cerrada`, { motivo });
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

/** Lo que hay que cobrar de un pedido (sin propina): con crédito del personal + delivery, solo el envío. Igual que el servidor. */
export const montoPorCobrar = (p: { total?: string | number | null; monto_credito?: string | number | null; adelanto_total?: string | number | null }): number =>
  Math.max(0, Math.round(Number(p.total || 0) * 100) - Math.round(Number(p.monto_credito || 0) * 100) - Math.round(Number(p.adelanto_total || 0) * 100)) / 100;
