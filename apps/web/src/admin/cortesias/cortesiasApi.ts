import { api } from '../../comun/api';

/** Motivos fijos de la cortesía (lista cerrada por el dueño). Mismo orden que el servidor. */
export const MOTIVOS_CORTESIA = [
  { codigo: 'COMPENSACION_ERROR_DEMORA', etiqueta: 'Compensación por error o demora' },
  { codigo: 'CUMPLEANOS_CLIENTE_FRECUENTE', etiqueta: 'Cumpleaños o cliente frecuente' },
  { codigo: 'DEGUSTACION_PROMOCION', etiqueta: 'Degustación o promoción' },
  { codigo: 'RECLAMO_CLIENTE', etiqueta: 'Reclamo del cliente' },
  { codigo: 'OTRO', etiqueta: 'Otro' },
] as const;

export interface DatosCortesia {
  motivo: string;
  nota?: string;
}

export interface RegistrarCortesiaSeparada extends DatosCortesia {
  productoId: string;
  tamanoId?: string;
  saborId?: string;
  cantidad: number;
  pedidoReferenciaId: string;
}

export interface ResumenInformeCortesias {
  desde: string | null;
  hasta: string | null;
  resumen: { registros: number; unidades: number; valorLista: number };
  porMotivo: { codigo: string; motivo: string; registros: number; unidades: number; valorLista: number }[];
  porProducto: { productoId: string; producto: string; registros: number; unidades: number; valorLista: number }[];
  porQuien: { partyId: string; nombre: string; registros: number; unidades: number; valorLista: number }[];
  detalle: {
    id: string;
    creadoEn: string;
    producto: string;
    sabor: string | null;
    cantidad: number;
    valorLista: number;
    motivo: string;
    motivoEtiqueta: string;
    nota: string | null;
    pedido: string | null;
    pedidoReferencia: string | null;
    dadaPor: string;
    autorizadaPor: string | null;
  }[];
}

/** Con el código de supervisor (solo el SUPERVISOR lo presenta): cabecera x-codigo-supervisor. */
function cabeceras(codigo?: string): RequestInit | undefined {
  return codigo ? { headers: { 'x-codigo-supervisor': codigo } } : undefined;
}

export const cortesiasApi = {
  /** Marca una línea de un pedido no cobrado como cortesía. */
  darEnLinea(pedidoId: string, lineaId: string, datos: DatosCortesia, codigo?: string) {
    return api.post(`/admin/pedidos/${pedidoId}/lineas/${lineaId}/cortesia`, datos, cabeceras(codigo));
  },

  /** Cortesía por separado, con su pedido de referencia. */
  registrarSeparada(datos: RegistrarCortesiaSeparada, codigo?: string) {
    return api.post('/admin/cortesias', datos, cabeceras(codigo));
  },

  /** Informe y listado: rango de fechas (AAAA-MM-DD), motivo y producto opcionales. */
  informe(filtro: { desde?: string; hasta?: string; motivo?: string; productoId?: string }) {
    const params = new URLSearchParams();
    if (filtro.desde) params.set('desde', filtro.desde);
    if (filtro.hasta) params.set('hasta', filtro.hasta);
    if (filtro.motivo) params.set('motivo', filtro.motivo);
    if (filtro.productoId) params.set('productoId', filtro.productoId);
    const qs = params.toString();
    return api.get<ResumenInformeCortesias>(`/admin/informes/cortesias${qs ? `?${qs}` : ''}`);
  },
};

/** Validación común: motivo elegido y nota obligatoria con «Otro». Devuelve el mensaje o null. */
export function errorDatosCortesia(motivo: string, nota: string): string | null {
  if (!MOTIVOS_CORTESIA.some((m) => m.codigo === motivo)) return 'Elige el motivo de la cortesía.';
  if (motivo === 'OTRO' && nota.trim().length === 0) return 'Con el motivo «Otro» escribe una nota.';
  return null;
}
