import { api, clienteFetch } from '../../comun/api';
import {
  RespuestaFilaChat,
  DetalleConversacion,
  FiltroChat,
  FiltroPos,
  MensajeItem,
  RespuestaListarChats,
  RespuestaRapida,
} from './mensajesTipos';

/** Filtros que viajan al servidor (la lista llega por páginas y el día también se filtra allá). */
export interface OpcionesLista {
  dia?: string;
  soloBloqueados?: boolean;
  /** `siguienteCursor` de la página anterior. */
  cursor?: string;
  limite?: number;
}

const paramsLista = (filtro: FiltroChat, q: string, pos: FiltroPos | undefined, o: OpcionesLista & { hasta?: string }) => {
  const params = new URLSearchParams();
  if (filtro !== 'todos') params.set('filtro', filtro);
  if (q.trim()) params.set('q', q.trim());
  if (pos) params.set('pos', pos);
  if (o.dia) params.set('dia', o.dia);
  if (o.soloBloqueados) params.set('soloBloqueados', '1');
  if (o.cursor) params.set('cursor', o.cursor);
  if (o.limite) params.set('limite', String(o.limite));
  if (o.hasta) params.set('hasta', o.hasta);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export async function listarConversaciones(
  filtro: FiltroChat = 'todos',
  q = '',
  pos?: FiltroPos,
  opciones: OpcionesLista = {},
): Promise<RespuestaListarChats> {
  return api.get<RespuestaListarChats>(`/admin/mensajes/conversaciones${paramsLista(filtro, q, pos, opciones)}`);
}

/** Solo los contadores de las pestañas. */
export async function obtenerConteosChats(): Promise<RespuestaListarChats['conteos']> {
  return api.get<RespuestaListarChats['conteos']>('/admin/mensajes/conversaciones/conteos');
}

/** Una fila de la lista con los mismos filtros (actualización en vivo); `hasta` = clave del último chat cargado. */
export async function obtenerFilaChat(
  id: string,
  filtro: FiltroChat,
  q: string,
  pos: FiltroPos | undefined,
  opciones: Pick<OpcionesLista, 'dia' | 'soloBloqueados'> & { hasta?: string },
): Promise<RespuestaFilaChat> {
  return api.get<RespuestaFilaChat>(`/admin/mensajes/conversaciones/${id}/fila${paramsLista(filtro, q, pos, opciones)}`);
}

export async function desbloquearSpam(id: string, motivo: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/admin/mensajes/${id}/desbloquear-spam`, { motivo });
}

export async function bloquearNumero(celular: string, motivo?: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/admin/whatsapp/numeros-bloqueados', { celular, motivo: motivo || undefined });
}

export async function desbloquearNumero(celular: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/admin/whatsapp/numeros-bloqueados/desbloquear', { celular });
}

export async function obtenerDetalleConversacion(id: string): Promise<DetalleConversacion> {
  return api.get<DetalleConversacion>(`/admin/mensajes/conversaciones/${id}`);
}

export async function listarRespuestasRapidas(): Promise<RespuestaRapida[]> {
  return api.get<RespuestaRapida[]>('/admin/mensajes/respuestas-rapidas');
}

/** `idCliente` identifica este envío: si la misma petición llega dos veces, el servidor no le escribe dos veces al cliente. */
export async function enviarMensaje(id: string, texto: string, idCliente?: string): Promise<{ id: string; estado?: string; duplicado?: boolean }> {
  return api.post<{ id: string; estado?: string; duplicado?: boolean }>(`/admin/mensajes/conversaciones/${id}/enviar`, idCliente ? { texto, idCliente } : { texto });
}

/** «Cargar anteriores»: la página de historial previa al mensaje `antes` (el más antiguo que ya se tiene). */
export async function listarMensajesAnteriores(
  id: string,
  antes: string,
): Promise<{ mensajes: MensajeItem[]; hayMasAnteriores: boolean }> {
  return api.get(`/admin/mensajes/conversaciones/${id}/mensajes?antes=${encodeURIComponent(antes)}`);
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

/** Documento del equipo al cliente (PDF, Word, Excel, PowerPoint o texto, hasta 16 MB). */
export async function enviarDocumentoChat(id: string, archivo: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('nombre', archivo.name);
  fd.append('documento', archivo, archivo.name);
  return clienteFetch<{ id: string }>(`/admin/mensajes/conversaciones/${id}/enviar-documento`, { method: 'POST', body: fd });
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
  forzar = false,
): Promise<{ ok: boolean; id: string }> {
  return api.post<{ ok: boolean; id: string }>(
    `/admin/mensajes/conversaciones/${id}/reabrir-plantilla`,
    forzar ? { forzar: true } : {},
  );
}

export async function reintentarMensaje(
  conversacionId: string,
  mensajeId: string,
): Promise<{ ok: boolean; id: string; estado?: string }> {
  return api.post<{ ok: boolean; id: string; estado?: string }>(
    `/admin/mensajes/conversaciones/${conversacionId}/mensajes/${mensajeId}/reintentar`,
    {},
  );
}
