import { api } from '../../comun/api';

export interface EnlaceAyuda {
  texto: string;
  ruta: string;
}

export interface ContextoAyudaRespuesta {
  activo: boolean;
  modulo?: string;
  titulo?: string;
  rolUsuario?: string;
  sugerencias: string[];
  enlaces: EnlaceAyuda[];
}

export type RolMensaje = 'usuario' | 'capri';

export interface MensajeHistorial {
  rol: RolMensaje;
  texto: string;
}

export interface PreguntarAyudaDto {
  pregunta: string;
  ruta?: string;
  historial?: MensajeHistorial[];
}

export type EstadoRespuestaAyuda = 'ok' | 'rechazada' | 'sin_ia' | 'tope' | 'limite';

export interface PreguntarAyudaRespuesta {
  respuesta: string;
  enlaces: EnlaceAyuda[];
  estado: EstadoRespuestaAyuda;
  mensaje?: string;
}

const SUGERENCIAS_RESPALDO = [
  '¿Cómo anulo un pedido?',
  '¿Cómo registro un cobro?',
  '¿Cómo cierro la caja?',
  '¿Cómo creo un producto?',
];

/**
 * Obtiene el contexto de ayuda para la ruta actual.
 * Devuelve sugerencias y enlaces permitidos para el rol del usuario actual.
 */
export async function obtenerContextoAyuda(ruta: string): Promise<ContextoAyudaRespuesta> {
  try {
    const rutaCodificada = encodeURIComponent(ruta);
    return await api.get<ContextoAyudaRespuesta>(`/admin/ayuda/contexto?ruta=${rutaCodificada}`);
  } catch (err) {
    // Si la llamada falla o el servidor no tiene el módulo activo, devolver contexto de respaldo
    return {
      activo: false,
      sugerencias: SUGERENCIAS_RESPALDO,
      enlaces: [],
    };
  }
}

/**
 * Envía una consulta de ayuda al asistente Capri.
 * Si el servicio no está disponible o falla, devuelve una respuesta de respaldo sin IA.
 */
export async function enviarPreguntaAyuda(dto: PreguntarAyudaDto): Promise<PreguntarAyudaRespuesta> {
  try {
    // Truncar pregunta a 500 caracteres por seguridad de contrato
    const preguntaLimpia = dto.pregunta.trim().slice(0, 500);
    // Limitar historial a los últimos 6 mensajes
    const historialLimpio = dto.historial ? dto.historial.slice(-6) : undefined;

    return await api.post<PreguntarAyudaRespuesta>('/admin/ayuda/preguntar', {
      pregunta: preguntaLimpia,
      ruta: dto.ruta,
      historial: historialLimpio,
    });
  } catch (err) {
    // Respuesta de contingencia si no hay conexión o falla el endpoint
    return {
      respuesta:
        'En este momento no pude conectar con el asistente. Puedes intentar nuevamente en unos segundos o consultar con el administrador.',
      enlaces: [],
      estado: 'sin_ia',
      mensaje: err instanceof Error ? err.message : 'Error al comunicarse con la ayuda',
    };
  }
}
