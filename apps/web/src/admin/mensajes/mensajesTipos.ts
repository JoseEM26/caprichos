import type { UbicacionChat } from './TarjetaUbicacion';

export type EstadoChat = 'bot' | 'atencion' | 'validar' | 'atendido' | 'pausado';
export type FiltroChat = 'todos' | 'atender' | 'bot' | 'atendidos';

export interface MensajeItem {
  id: string;
  autor: 'CLIENTE' | 'BOT' | 'PERSONA';
  saliente: boolean;
  imagen: boolean;
  imagenId?: string | null;
  texto: string;
  ubicacion?: UbicacionChat | null;
  hora: string;
  estado?: string;
  /** Solo ADMIN: código de clasificación interno (p. ej. PLANTILLA_FORMATO_VARIABLE). */
  errorCodigo?: string | null;
  /** Solo ADMIN: texto original de Meta, sin el código. */
  errorDetalle?: string | null;
  /** Solo ADMIN: código numérico de Meta (p. ej. 132012). */
  metaCodigo?: string | null;
  motivoFallo?: string | null;
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
  sinLeer: number;
  esperaMin?: number | null;
  /** Minutos que el último mensaje del cliente lleva sin respuesta (sin persona que lo tomó); null si ya se respondió. */
  sinRespuestaMin?: number | null;
  bloqueoSpam?: BloqueoSpam | null;
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
  dueno: string | null;
  esMio: boolean;
  ocupado: boolean;
  ventanaAbierta?: boolean;
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
    bloqueadosSpam?: number;
  };
  chats: ChatResumen[];
}
