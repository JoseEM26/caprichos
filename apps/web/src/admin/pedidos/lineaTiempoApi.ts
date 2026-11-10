import { api } from '../../comun/api';

export type CodigoEtapa = 'TOMADO' | 'EN_COLA' | 'PREPARACION' | 'LISTO' | 'COBRADO' | 'EN_RUTA' | 'ENTREGADO' | 'ANULADO';

export interface EtapaLineaTiempo {
  codigo: CodigoEtapa;
  etiqueta: string;
  area: string | null;
  desde: string | null;
  hasta: string | null;
  duracionSeg: number | null;
  estimada: boolean;
}

/** Contrato de GET /admin/pedidos/:id/linea-tiempo */
export interface LineaTiempoPedido {
  pedidoId: string;
  atendidoPor: { partyId: string; nombre: string; rol: string; en: string } | null;
  canal: string;
  modalidad: string;
  mesa: string | null;
  etapas: EtapaLineaTiempo[];
  totalSeg: number | null;
  completo: boolean;
}

export const lineaTiempoApi = {
  obtener(id: string | number): Promise<LineaTiempoPedido> {
    return api.get<LineaTiempoPedido>(`/admin/pedidos/${id}/linea-tiempo`);
  },
};

/** «12 min 30 s», «45 s», «1 h 5 min». */
export function duracionSegLegible(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg) || seg < 0) return 'sin dato';
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return r > 0 ? `${m} min ${r} s` : `${m} min`;
  return `${r} s`;
}
