import { api } from '../../comun/api';
import {
  DetalleConversacion,
  FiltroChat,
  RespuestaListarChats,
  RespuestaRapida,
} from './mensajesTipos';

export async function listarConversaciones(
  filtro: FiltroChat = 'todos',
  q = '',
): Promise<RespuestaListarChats> {
  const params = new URLSearchParams();
  if (filtro !== 'todos') params.set('filtro', filtro);
  if (q.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return api.get<RespuestaListarChats>(`/admin/mensajes/conversaciones${qs ? `?${qs}` : ''}`);
}

export async function obtenerDetalleConversacion(id: string): Promise<DetalleConversacion> {
  return api.get<DetalleConversacion>(`/admin/mensajes/conversaciones/${id}`);
}

export async function listarRespuestasRapidas(): Promise<RespuestaRapida[]> {
  return api.get<RespuestaRapida[]>('/admin/mensajes/respuestas-rapidas');
}

export async function enviarMensaje(id: string, texto: string): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/admin/mensajes/conversaciones/${id}/enviar`, { texto });
}

export async function pulirMensaje(id: string, texto: string): Promise<{ texto: string }> {
  return api.post<{ texto: string }>(`/admin/mensajes/conversaciones/${id}/pulir`, { texto });
}

export async function tomarChat(id: string, forzar = false): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/tomar`, { forzar });
}

export async function soltarChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/soltar`, {});
}

export async function pausarBot(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/pausar`, {});
}

export async function reanudarBot(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/reanudar`, {});
}

export async function marcarAtendido(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/atendido`, {});
}

export async function aprobarPagoChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/aprobar-pago`, {});
}

export async function rechazarPagoChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/rechazar-pago`, {});
}
