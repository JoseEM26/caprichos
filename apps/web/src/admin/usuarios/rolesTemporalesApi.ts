import { api } from '../../comun/api';

/** Hora de Lima (sin horario de verano): un «datetime-local» se envía con su desfase. */
export function fechaLimaAIso(valor: string): string {
  return `${valor}:00-05:00`;
}

export async function darRolExtra(
  usuarioId: string,
  datos: { rol: string; motivo?: string; hasta?: string },
): Promise<void> {
  await api.post(`/admin/usuarios/${usuarioId}/roles-extra`, datos);
}

export async function quitarRolExtra(usuarioId: string, rol: string): Promise<void> {
  await api.delete(`/admin/usuarios/${usuarioId}/roles-extra/${rol}`);
}

export interface RolTemporal {
  rol: string;
  nombre: string;
  venceEn: string | null;
  motivo: string | null;
}

export interface EventoActividad {
  id: string;
  en: string;
  enTexto: string;
  tipo: string;
  texto: string;
  quien: string | null;
  motivo: string | null;
}

export interface RespuestaActividad {
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
  tipos: Array<{ id: string; nombre: string }>;
  datos: EventoActividad[];
}

export async function listarActividad(
  usuarioId: string,
  filtros: { tipo: string; desde: string; hasta: string; pagina: number },
): Promise<RespuestaActividad> {
  const p = new URLSearchParams({ pagina: String(filtros.pagina), limite: '15' });
  if (filtros.tipo) p.set('tipo', filtros.tipo);
  if (filtros.desde) p.set('desde', `${filtros.desde}T00:00:00-05:00`);
  if (filtros.hasta) p.set('hasta', `${filtros.hasta}T23:59:59-05:00`);
  const r = await api.get<Partial<RespuestaActividad>>(`/admin/usuarios/${usuarioId}/actividad?${p.toString()}`);
  return {
    total: 0,
    pagina: filtros.pagina,
    limite: 15,
    paginas: 1,
    tipos: [],
    ...r,
    datos: Array.isArray(r?.datos) ? r.datos : [],
  };
}

/** «7 nov 18:00» en hora de Lima. */
export function fechaLimaCorta(iso: string): string {
  const p = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(v('day'))} ${meses[Number(v('month')) - 1]} ${v('hour')}:${v('minute')}`;
}
