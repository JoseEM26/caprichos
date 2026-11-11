import { api } from '../../comun/api';

export type OrigenImpresion = 'AUTOMATICA' | 'REIMPRESION' | 'PRUEBA' | 'REINTENTO';
export const ORIGENES: OrigenImpresion[] = ['AUTOMATICA', 'REIMPRESION', 'PRUEBA', 'REINTENTO'];
export const ESTADOS_IMPRESION = ['IMPRESO', 'FALLIDO', 'PENDIENTE', 'IMPRIMIENDO', 'VENCIDO', 'DESCARTADO'] as const;

export interface FilaHistorialImpresion {
  id: string;
  pedidoId: string | null;
  pedidoCodigo: string | null;
  tipo: string;
  /** «Sticker · Bebida», «Ticket · Comanda salón»… */
  etiqueta: string;
  origen: OrigenImpresion;
  solicitadoPor: { partyId: string; nombre: string; rol: string | null } | null;
  creadoEn: string;
  impresoEn: string | null;
  estado: string;
  intentos: number;
  error: string | null;
  equipo: { id: string; nombre: string } | null;
  impresora: string | null;
  copia: boolean;
  motivo: string | null;
}

export interface RespuestaHistorialImpresion {
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
  datos: FilaHistorialImpresion[];
  resumen: { origen: Record<string, number>; estado: Record<string, number> };
}

export interface FiltrosHistorialImpresion {
  desde?: string;
  hasta?: string;
  origen?: string[];
  tipo?: string;
  estado?: string;
  equipoId?: string;
  q?: string;
  pagina?: number;
  limite?: number;
}

export const historialImpresionApi = {
  listar(f: FiltrosHistorialImpresion): Promise<RespuestaHistorialImpresion> {
    const p = new URLSearchParams();
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
    if (f.origen?.length) p.set('origen', f.origen.join(','));
    if (f.tipo) p.set('tipo', f.tipo);
    if (f.estado) p.set('estado', f.estado);
    if (f.equipoId) p.set('equipoId', f.equipoId);
    if (f.q?.trim()) p.set('q', f.q.trim());
    p.set('pagina', String(f.pagina ?? 1));
    p.set('limite', String(f.limite ?? 25));
    return api.get<RespuestaHistorialImpresion>(`/admin/impresion/historial?${p.toString()}`);
  },
  deUnPedido(pedidoId: string): Promise<{ datos: FilaHistorialImpresion[] }> {
    return api.get<{ datos: FilaHistorialImpresion[] }>(`/admin/pedidos/${pedidoId}/impresiones`);
  },
};
