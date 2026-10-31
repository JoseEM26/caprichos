import { api } from '../../comun/api';
import {
  FiltrosHistorial,
  RespuestaHistorialNotificaciones,
} from './notificacionesTipos';

export async function listarHistorialNotificaciones(
  filtros: FiltrosHistorial = {},
): Promise<RespuestaHistorialNotificaciones> {
  const params = new URLSearchParams();
  if (filtros.q?.trim()) params.set('q', filtros.q.trim());
  if (filtros.tipo && filtros.tipo !== 'Todos') params.set('tipo', filtros.tipo);
  if (filtros.estado && filtros.estado !== 'todas') params.set('estado', filtros.estado);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const qs = params.toString();
  return api.get<RespuestaHistorialNotificaciones>(`/admin/notificaciones/historial${qs ? `?${qs}` : ''}`);
}

/** Marca leída (o no leída) un aviso para el usuario que ha iniciado sesión. */
export async function marcarNotificacion(
  clave: string,
  leida = true,
): Promise<{ ok: boolean; clave: string; leida: boolean }> {
  return api.post<{ ok: boolean; clave: string; leida: boolean }>('/admin/notificaciones/marcar', { clave, leida });
}

export async function marcarTodasNotificacionesLeidas(
  ids?: string[],
): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/admin/notificaciones/marcar-todas', { ids });
}

export async function crearMensajeInterno(data: {
  rol_destino?: string;
  titulo: string;
  mensaje: string;
}): Promise<{ ok: boolean; id: string }> {
  return api.post<{ ok: boolean; id: string }>('/admin/notificaciones/mensaje-interno', data);
}
