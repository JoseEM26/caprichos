import { api, clienteFetch } from '../../comun/api';
import {
  DetalleConversacion,
  FiltroChat,
  FiltroPos,
  RespuestaListarChats,
  RespuestaRapida,
} from './mensajesTipos';

export async function listarConversaciones(
  filtro: FiltroChat = 'todos',
  q = '',
  pos?: FiltroPos,
): Promise<RespuestaListarChats> {
  const params = new URLSearchParams();
  if (filtro !== 'todos') params.set('filtro', filtro);
  if (q.trim()) params.set('q', q.trim());
  if (pos) params.set('pos', pos);
  const qs = params.toString();
  return api.get<RespuestaListarChats>(`/admin/mensajes/conversaciones${qs ? `?${qs}` : ''}`);
}

export async function desbloquearSpam(id: string, motivo: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/${id}/desbloquear-spam`, { motivo });
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

/** Archiva el chat en «Atendidos». Con un pago por revisar el servidor responde ATENDIDO_REQUIERE_CONFIRMAR. */
export async function marcarAtendido(id: string, confirmar = false): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/atendido`, confirmar ? { confirmar: true } : {});
}

export async function volverPorAtender(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/volver-por-atender`, {});
}

/** Foto del equipo al cliente (JPG, PNG o WebP; el servidor la comprime a ≤5 MB) con subtítulo opcional. */
export async function enviarImagenChat(id: string, archivo: File, subtitulo = ''): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('imagen', archivo, archivo.name);
  if (subtitulo) fd.append('subtitulo', subtitulo);
  return clienteFetch<{ id: string }>(`/admin/mensajes/conversaciones/${id}/enviar-imagen`, { method: 'POST', body: fd });
}

export async function marcarChatVisto(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/visto`, {});
}

export async function marcarChatNoVisto(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/no-visto`, {});
}

export async function aprobarPagoChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/aprobar-pago`, {});
}

export async function rechazarPagoChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/rechazar-pago`, {});
}

export async function aplicarCambioChat(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/aplicar-cambio`, {});
}

export async function rechazarCambioChat(id: string, motivo: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/conversaciones/${id}/rechazar-cambio`, { motivo });
}

export async function editarNombreContacto(
  id: string,
  datos: { nombre?: string; revertir?: boolean },
): Promise<{
  ok: boolean;
  id: string;
  nombre: string;
  nombre_contacto: string | null;
  nombre_editado: boolean;
  identificador_tipo: 'TELEFONO' | 'USUARIO_WA';
}> {
  return api.patch(`/admin/mensajes/conversaciones/${id}/nombre`, datos);
}

export async function reabrirConversacionPlantilla(
  id: string,
): Promise<{ ok: boolean; id: string }> {
  return api.post<{ ok: boolean; id: string }>(
    `/admin/mensajes/conversaciones/${id}/reabrir-plantilla`,
    {},
  );
}

export async function reintentarMensaje(
  conversacionId: string,
  mensajeId: string,
): Promise<{ ok: boolean; id: string }> {
  return api.post<{ ok: boolean; id: string }>(
    `/admin/mensajes/conversaciones/${conversacionId}/mensajes/${mensajeId}/reintentar`,
    {},
  );
}
