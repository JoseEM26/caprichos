import { api, clienteFetch } from '../../comun/api';
import { reducirImagenVoucher } from '../vouchers/reducirImagenVoucher';

export interface RenglonPlanCobro {
  medio: string;
  monto: number;
}

export type EstadoCambioCobro = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'AUTORIZADA_SIN_VALIDAR';

/** Solicitud de cambio de forma de pago en la puerta (la devuelve el servidor al repartidor y a Caja). */
export interface SolicitudCambioCobro {
  id: string;
  pedidoId: string;
  estado: EstadoCambioCobro;
  planOriginal: RenglonPlanCobro[];
  planSolicitado: RenglonPlanCobro[];
  pagaCon: number | null;
  voucherIds: string[];
  motivo: string | null;
  solicitadoPor: string | null;
  solicitadoEn: string;
  resueltoPor: string | null;
  resueltoEn: string | null;
}

/** Pendiente tal como la ve Caja: con los datos del pedido. */
export interface SolicitudPendienteCaja extends SolicitudCambioCobro {
  codigo: string;
  cliente: string | null;
  total: number;
  estadoPedido: string;
  pagoEstado: string | null;
}

export type AccionCambioCobro = 'APROBAR' | 'RECHAZAR' | 'AUTORIZAR_SIN_VALIDAR';

export const cambioCobroApi = {
  /** El repartidor solicita. `capturas` trae una foto por cada medio digital del plan. */
  async solicitar(
    pedidoId: string,
    dto: { plan: RenglonPlanCobro[]; pagaCon?: number | null; capturas: Record<string, File | Blob | undefined> },
  ): Promise<SolicitudCambioCobro> {
    const fd = new FormData();
    fd.append('plan', JSON.stringify(dto.plan));
    if (dto.pagaCon != null) fd.append('pagaCon', String(dto.pagaCon));
    for (const [medio, foto] of Object.entries(dto.capturas)) {
      if (!foto) continue;
      const reducida = await reducirImagenVoucher(foto);
      fd.append(`captura_${medio}`, reducida, `captura-${medio.toLowerCase()}.jpg`);
    }
    return clienteFetch<SolicitudCambioCobro>(`/admin/repartos/${pedidoId}/solicitar-cambio-cobro`, { method: 'POST', body: fd });
  },

  /** Solicitud más reciente del pedido (cualquier estado) o null. */
  vigente: (pedidoId: string) => api.get<SolicitudCambioCobro | null>(`/admin/repartos/${pedidoId}/cambio-cobro`),

  pendientes: () => api.get<SolicitudPendienteCaja[]>('/admin/pedidos/cambio-cobro/pendientes'),

  resolver: (pedidoId: string, solicitudId: string, accion: AccionCambioCobro, motivo?: string) =>
    api.post<SolicitudCambioCobro>(`/admin/pedidos/${pedidoId}/cambio-cobro/${solicitudId}/resolver`, { accion, motivo }),
};

export const TEXTO_ESTADO_CAMBIO: Record<EstadoCambioCobro, string> = {
  PENDIENTE: 'Esperando que Caja valide el pago…',
  APROBADA: 'Caja aprobó el cambio de pago',
  RECHAZADA: 'Caja rechazó el cambio: cobra con el medio original',
  AUTORIZADA_SIN_VALIDAR: 'Caja autorizó la entrega sin validar el pago',
};

const NOMBRES: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

export const nombreMedioCobro = (medio: string) => NOMBRES[medio] ?? medio;

/** «Efectivo S/ 15.00 + Yape S/ 25.00» */
export function textoPlan(plan: RenglonPlanCobro[]): string {
  return plan.map((f) => `${NOMBRES[f.medio] ?? f.medio} S/ ${Number(f.monto).toFixed(2)}`).join(' + ');
}
