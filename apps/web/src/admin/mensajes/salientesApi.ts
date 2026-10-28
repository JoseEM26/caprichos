import { api } from '../../comun/api';

export type EstadoSaliente = 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'FALLIDO' | 'DESCARTADO';

export interface SalienteAdmin {
  id: string;
  telefono: string;
  origen: string;
  tipo: string;
  estado: EstadoSaliente;
  intentos: number;
  maxIntentos: number;
  ultimoError: string | null;
  clasificacion: 'PERMANENTE' | 'AGOTADO' | 'TEMPORAL' | null;
  texto: string | null;
  pedidoCodigo: string | null;
  motivoDescarte: string | null;
  creadoEn: string;
  actualizadoEn: string;
  enviadoEn: string | null;
}

export interface ListaSalientes {
  pagina: number;
  limite: number;
  total: number;
  filas: SalienteAdmin[];
}

export interface ResumenSalientes {
  pendientes: number;
  enviando: number;
  enviados: number;
  fallidos: number;
  descartados: number;
  lagSegundos: number;
  lagAlertaMin: number;
  lagAlerta: boolean;
}

export const salientesApi = {
  listar: (estado: string, pagina = 1) =>
    api.get<ListaSalientes>(`/admin/whatsapp/salientes?estado=${encodeURIComponent(estado)}&pagina=${pagina}`),
  resumen: () => api.get<ResumenSalientes>('/admin/whatsapp/salientes/resumen'),
  reenviar: (id: string) => api.post(`/admin/whatsapp/salientes/${id}/reenviar`),
  descartar: (id: string, motivo: string) => api.post(`/admin/whatsapp/salientes/${id}/descartar`, { motivo }),
};

/** Minutos y segundos legibles del lag, sin emojis. */
export function formatearLag(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  return `${min} min`;
}

export const ETIQUETA_CLASIFICACION: Record<string, string> = {
  PERMANENTE: 'Error permanente: no se reintenta solo',
  AGOTADO: 'Intentos agotados',
  TEMPORAL: 'Error temporal',
};
