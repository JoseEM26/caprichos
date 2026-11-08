import type { UbicacionChat } from './TarjetaUbicacion';

export type EstadoChat = 'bot' | 'atencion' | 'validar' | 'atendido' | 'pausado';
export type FiltroChat = 'todos' | 'atender' | 'bot' | 'atendidos' | 'novistos' | 'reprogramar';
export type FiltroPos = 'faltan' | 'procesados';

/** Qué tan procesado está el chat en el punto de venta. */
export interface PosChat {
  estado: 'REGISTRADO' | 'SIN_COBRAR' | 'SIN_PEDIDO';
  codigo: string | null;
  pedidoId: string | null;
}

export interface MensajeItem {
  id: string;
  autor: 'CLIENTE' | 'BOT' | 'PERSONA';
  saliente: boolean;
  imagen: boolean;
  imagenId?: string | null;
  /** Nota de voz del cliente (archivo privado). */
  audioId?: string | null;
  texto: string;
  ubicacion?: UbicacionChat | null;
  hora: string;
  /** Fecha y hora exactas (ISO) del mensaje, para los separadores de día y el title de la burbuja. */
  fecha?: string;
  estado?: string;
  /** Solo ADMIN: código de clasificación interno (p. ej. PLANTILLA_FORMATO_VARIABLE). */
  errorCodigo?: string | null;
  /** Solo ADMIN: texto original de Meta, sin el código. */
  errorDetalle?: string | null;
  /** Solo ADMIN: código numérico de Meta (p. ej. 132012). */
  metaCodigo?: string | null;
  motivoFallo?: string | null;
  /** false: reintentar no sirve (ventana de 24 h); hay que reabrir con plantilla. */
  puedeReintentar?: boolean;
}

export interface BloqueoSpam {
  activo: boolean;
  hastaEn: string | null;
  reincidente: boolean;
}

export interface ChatResumen {
  id: string;
  nombre: string;
  telefono: string;
  identificador_tipo?: 'TELEFONO' | 'USUARIO_WA';
  nombre_contacto?: string | null;
  nombre_editado?: boolean;
  estado: EstadoChat;
  urgente: boolean;
  ultimo: string;
  hora: string;
  /** Fecha y hora (ISO) del último mensaje: la lista la muestra como hora, «Ayer», día o fecha. */
  fecha?: string;
  sinLeer: number;
  /** Marca manual «No visto», compartida por todo el equipo. */
  marcadoNoVisto?: boolean;
  esperaMin?: number | null;
  /** Minutos que el último mensaje del cliente lleva sin respuesta (sin persona que lo tomó); null si ya se respondió. */
  sinRespuestaMin?: number | null;
  bloqueoSpam?: BloqueoSpam | null;
  pos?: PosChat;
  faltaProcesar?: boolean;
  /** Solo en «Atendidos»: cuándo (ISO) y quién lo archivó. */
  atendidoEn?: string | null;
  atendidoPor?: string | null;
  /** Estaba archivado y el cliente escribió de nuevo: ya está en «Por atender». */
  volvioAEscribir?: boolean;
  /** El cliente aceptó reprogramar la entrega y falta reenviarla a reparto (el sistema no guarda fecha). */
  porReprogramar?: boolean;
}

export interface DetallePedidoChat {
  id: string;
  codigo: string;
  medio: string | null;
  total: string;
  lineas: string[];
}

export interface DetalleSolicitudChat {
  id?: string;
  tipo: string;
  tipoRaw?: string;
  detalle: string;
  nuevaDireccion?: string | null;
  nuevaReferencia?: string | null;
  nuevaZonaNombre?: string | null;
  nuevoEnvio?: number | null;
  recargoEnvio?: number | null;
  pedido: string;
  pedidoId: string;
  estadoPedido: string;
  estadoSolicitud?: string;
  hora: string;
}

export interface DetalleSolicitudReservaChat {
  id: string;
  personas: number | null;
  hora: string | null;
  fecha: string | null;
  nombre: string | null;
  telefono: string | null;
  nota: string | null;
}

export interface DetalleConversacion {
  id: string;
  nombre: string;
  telefono: string;
  identificador_tipo?: 'TELEFONO' | 'USUARIO_WA';
  nombre_contacto?: string | null;
  nombre_editado?: boolean;
  modalidad: string | null;
  estado: EstadoChat;
  urgente: boolean;
  marcadoNoVisto?: boolean;
  pos?: PosChat;
  atendidoEn?: string | null;
  atendidoPor?: string | null;
  dueno: string | null;
  esMio: boolean;
  ocupado: boolean;
  ventanaAbierta?: boolean;
  /** Numero de la cuenta al que escribio el cliente (ej. 51914244077). */
  numeroReceptor?: string | null;
  modo?: 'meta' | 'simulado';
  simulado?: boolean;
  mensajes: MensajeItem[];
  pedido: DetallePedidoChat | null;
  solicitud: DetalleSolicitudChat | null;
  solicitudReserva?: DetalleSolicitudReservaChat | null;
  tiempoPrometidoMin: number | null;
  altaDemanda: boolean;
  motivoDerivacion?: string | null;
  bloqueoSpam?: BloqueoSpam | null;
  voucher?: import('../vouchers/tipos').VoucherResumenChat | null;
}

export interface RespuestaRapida {
  id: string;
  titulo: string;
  texto: string;
}

export interface RespuestaListarChats {
  conteos: {
    todos: number;
    atender: number;
    bot: number;
    atendidos: number;
    sinVer?: number;
    bloqueadosSpam?: number;
    faltanProcesar?: number;
    reprogramar?: number;
  };
  chats: ChatResumen[];
}
