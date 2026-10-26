/**
 * Estados específicos del subflujo transaccional de Reservas por WhatsApp (Ola 3, Agente F).
 */
export type EstadoReservaFlujo =
  | 'RESERVA_PERSONAS'
  | 'RESERVA_FECHA'
  | 'RESERVA_FECHA_OTRA'
  | 'RESERVA_HORA'
  | 'RESERVA_CONFIRMAR_NOMBRE'
  | 'RESERVA_INGRESAR_NOMBRE'
  | 'RESERVA_INGRESAR_TELEFONO'
  | 'RESERVA_PREGUNTAR_NOTA'
  | 'RESERVA_RESUMEN_CONFIRMAR'
  | 'RESERVA_CANCELAR_ELEGIR'
  | 'RESERVA_CANCELAR_CONFIRMAR'
  | 'RESERVA_CAMBIAR_DETALLE';

export interface ReservaActivaResumen {
  id: string;
  fecha: string;
  hora: string;
  personas: number;
  mesas: string[];
}

export interface DatosReservaBot {
  personas?: number;
  fechaIso?: string;
  fechaTexto?: string;
  hora?: string;
  nombre?: string;
  telefono?: string;
  nota?: string;
  reservaIdAccion?: string;
  estadoPrevio?: EstadoReservaFlujo;
  intentoModificarCampo?: 'personas' | 'fecha' | 'hora' | 'nombre' | 'nota';
}

/**
 * Estado completo del subflujo de reserva persistido en `conversacion.flujo.reserva`.
 */
export interface EstadoFlujoReserva {
  estadoInterno: EstadoReservaFlujo;
  datos: DatosReservaBot;
  franjasDisponibles?: string[];
  reservasActivas?: ReservaActivaResumen[];
  timestampUltimaAccion?: number;
}
