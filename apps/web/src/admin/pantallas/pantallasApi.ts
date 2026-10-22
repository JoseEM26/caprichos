import { api } from '../../comun/api';
import { AreaCocinaItem, RespuestaListarPantallas } from './pantallasTipos';

export async function listarPantallas(
  q = '',
  estacion = '',
): Promise<RespuestaListarPantallas> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (estacion.trim() && estacion !== 'Todas') params.set('estacion', estacion.trim());
  const qs = params.toString();
  return api.get<RespuestaListarPantallas>(`/admin/pantallas${qs ? `?${qs}` : ''}`);
}

export async function listarAreasPantalla(): Promise<AreaCocinaItem[]> {
  return api.get<AreaCocinaItem[]>('/admin/pantallas/areas');
}

export async function vincularPantalla(data: {
  codigo: string;
  nombre?: string;
  areaId?: string;
}): Promise<{ ok: boolean; mensaje: string }> {
  return api.post<{ ok: boolean; mensaje: string }>('/admin/pantallas/vincular', data);
}

export async function activarPantalla(id: string): Promise<{ ok: boolean; activo: boolean }> {
  return api.post<{ ok: boolean; activo: boolean }>(`/admin/pantallas/${id}/activar`, {});
}

export async function desactivarPantalla(id: string): Promise<{ ok: boolean; activo: boolean }> {
  return api.post<{ ok: boolean; activo: boolean }>(`/admin/pantallas/${id}/desactivar`, {});
}

export async function editarPantalla(
  id: string,
  data: { nombre?: string; areaId?: string },
): Promise<{ ok: boolean }> {
  return api.put<{ ok: boolean }>(`/admin/pantallas/${id}`, data);
}
