import { api } from '../../comun/api';

export type TipoAprendizaje = 'FAQ' | 'FRASES' | 'DERIVAR';
export type EstadoAprendizaje = 'PENDIENTE' | 'APROBADO' | 'DESCARTADO';
export type EstadoNoche = 'OK' | 'TOPE' | 'SIN_IA' | 'ERROR' | 'EN_CURSO';

export interface Propuesta {
  id: string;
  tipo: TipoAprendizaje;
  intencion: string;
  pregunta: string;
  respuesta: string;
  frases: string[];
  repeticiones: number;
  evidencia: { conversacionId: string; extracto: string }[];
  estado: EstadoAprendizaje;
  noche: string;
  creadoEn: string;
  decididoPor: string | null;
  decididoEn: string | null;
  motivo: string | null;
}

export interface Conocimiento {
  id: string;
  version: number;
  tipo: TipoAprendizaje;
  intencion: string;
  pregunta: string;
  respuesta: string;
  frases: string[];
  aprobadoPor: string;
  aprobadoEn: string;
}

export interface Noche {
  fecha: string;
  estado: EstadoNoche;
  chatsLeidos: number;
  descartadosFueraTema: number;
  propuestas: number;
  tokens: number;
  usd: number;
}

export interface Resumen {
  pendientes: number;
  topeUsd: number;
  ultimaNoche: Noche | null;
  noches: { fecha: string; estado: EstadoNoche; usd: number; propuestas: number }[];
}

const base = '/admin/aprendizajes';

export const aprendizajesApi = {
  listar: (estado: EstadoAprendizaje, pagina: number, limite = 20) =>
    api.get<{ items: Propuesta[]; total: number }>(`${base}?estado=${estado}&pagina=${pagina}&limite=${limite}`),
  aprobar: (id: string, cambios: { pregunta?: string; respuesta?: string; frases?: string[] }) =>
    api.post(`${base}/${id}/aprobar`, cambios),
  descartar: (id: string, motivo: string) => api.post(`${base}/${id}/descartar`, { motivo }),
  conocimiento: () => api.get<{ items: Conocimiento[] }>(`${base}/conocimiento`),
  retirar: (id: string, motivo: string) => api.post(`${base}/conocimiento/${id}/retirar`, { motivo }),
  resumen: () => api.get<Resumen>(`${base}/resumen`),
  ejecutarAhora: () => api.post<Noche>(`${base}/ejecutar-ahora`),
};

export const TIPO_TEXTO: Record<TipoAprendizaje, string> = { FAQ: 'FAQ', FRASES: 'Frases', DERIVAR: 'Siempre a persona' };

export const mensajeError = (e: unknown) => (e as { message?: string })?.message || 'No se pudo completar. Intenta de nuevo.';

export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
