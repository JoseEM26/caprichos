export type EstadoChat = 'bot' | 'atencion' | 'validar' | 'atendido' | 'pausado';
export type FiltroChat = 'todos' | 'atender' | 'bot' | 'atendidos';

export interface MensajeItem {
  id: string;
  autor: 'CLIENTE' | 'BOT' | 'PERSONA';
  saliente: boolean;
  imagen: boolean;
  texto: string;
  hora: string;
  estado?: string;
  errorCodigo?: string | null;
  errorDetalle?: string | null;
  motivoFallo?: string | null;
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
}

export interface DetallePedidoChat {
  id: string;
  codigo: string;
  medio: string | null;
  total: string;
  lineas: string[];
}

export interface DetalleSolicitudChat {
  tipo: string;
  detalle: string;
  pedido: string;
  pedidoId: string;
  estadoPedido: string;
  hora: string;
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
  tiempoPrometidoMin: number | null;
  altaDemanda: boolean;
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
  };
  chats: ChatResumen[];
}
