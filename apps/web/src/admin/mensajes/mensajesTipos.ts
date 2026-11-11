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

export interface DocumentoChat {
  nombre: string;
  bytes: number;
  mime: string;
  /** Ruta de descarga con sesión (siempre como archivo adjunto). */
  url: string;
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
  /** Documento (PDF, Word...) recibido o enviado: se muestra como tarjeta con «Descargar». */
  documento?: DocumentoChat | null;
  ubicacion?: UbicacionChat | null;
  hora: string;
  /** Fecha y hora exactas (ISO) del mensaje, para los separadores de día y el title de la burbuja. */
  fecha?: string;
  estado?: string;
  /** Mensaje de plantilla aprobada (p. ej. la de reapertura). */
  plantilla?: boolean;
  /** Solo ADMIN: código de clasificación interno (p. ej. PLANTILLA_FORMATO_VARIABLE). */
  errorCodigo?: string | null;
  /** Solo ADMIN: texto original de Meta, sin el código. */
  errorDetalle?: string | null;
  /** Solo ADMIN: código numérico de Meta (p. ej. 132012). */
  metaCodigo?: string | null;
  motivoFallo?: string | null;
  /** false: reintentar no sirve (ventana de 24 h); hay que reabrir con plantilla. */
  puedeReintentar?: boolean;
  /** Id que generó esta bandeja al enviarlo: el servidor lo devuelve para reconocer el mensaje «Enviando…» sin duplicarlo. */
  idCliente?: string;
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
  /** Lista manual de números bloqueados / número del propio negocio: no se les envía nada. */
  numeroBloqueado?: boolean;
  numeroPropio?: boolean;
  pos?: PosChat;
  faltaProcesar?: boolean;
  /** Solo en «Atendidos»: cuándo (ISO) y quién lo archivó. */
  atendidoEn?: string | null;
  atendidoPor?: string | null;
  /** Estaba archivado y el cliente escribió de nuevo: ya está en «Por atender». */
  volvioAEscribir?: boolean;
  /** El cliente aceptó reprogramar la entrega y falta reenviarla a reparto (el sistema no guarda fecha). */
  porReprogramar?: boolean;
  /** Posición en el orden de la lista (la pone el servidor): la web reordena por ella sin recalcular reglas. */
  clave?: string;
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
  /** El historial viene por páginas (las últimas); true = hay mensajes más antiguos por pedir. */
  hayMasAnteriores?: boolean;
  pedido: DetallePedidoChat | null;
  solicitud: DetalleSolicitudChat | null;
  solicitudReserva?: DetalleSolicitudReservaChat | null;
  tiempoPrometidoMin: number | null;
  altaDemanda: boolean;
  motivoDerivacion?: string | null;
  bloqueoSpam?: BloqueoSpam | null;
  numeroBloqueado?: boolean;
  numeroPropio?: boolean;
  voucher?: import('../vouchers/tipos').VoucherResumenChat | null;
}

/** Plantilla de respuesta rápida del equipo (texto libre; no es una plantilla de Meta). */
export interface RespuestaRapida {
  id: string;
  titulo: string;
  texto: string;
  /** PAGOS | HORARIOS | UBICACION | DELIVERY | PEDIDOS | SALUDO | CIERRE | OTROS */
  categoria?: string;
  activo?: boolean;
  orden?: number;
}

/** Datos del local y de quien escribe para reemplazar {{variables}}. */
export type ContextoPlantillas = Record<string, string>;

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
  /** Contadores por día de la pestaña (antes de elegir el día). Si falta, la web filtra por día en el navegador. */
  dias?: DiasBandeja;
  /** La lista viene por páginas: con `hayMas` se ofrece «Cargar más» pidiendo `siguienteCursor`. */
  hayMas?: boolean;
  siguienteCursor?: string | null;
}

export interface DiasBandeja {
  hoy: number;
  ayer: number;
  manana: number;
  anteriores: number;
  total: number;
}

/** Una fila en vivo: `chat` es null si ya no cumple los filtros; `dentro` = cae entre los chats ya cargados. */
export interface RespuestaFilaChat {
  chat: ChatResumen | null;
  dentro: boolean;
}

/** Lo que avisa el servidor por socket cuando un mensaje en segundo plano llega a un estado final. */
export interface EventoEnvioMensaje {
  id: string;
  mensajeId: string;
  idCliente?: string;
  estado: 'ENVIADO' | 'SIMULADO' | 'FALLIDO' | 'REVISAR';
  motivoFallo?: string | null;
  puedeReintentar?: boolean;
}
