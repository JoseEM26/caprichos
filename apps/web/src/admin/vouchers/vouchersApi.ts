import { api, clienteFetch } from '../../comun/api';
import {
  ParametrosVoucherConfig,
  RespuestaSubirVoucher,
  VoucherPagoItem,
} from './tipos';
import type { PlanPagoItem } from '../pedidos/planPago';

export interface FiltrosListarVouchers {
  pedidoId?: string | number;
  conversacionId?: string | number;
  fecha?: string;
  estado?: 'pendientes' | 'todos';
}

export interface EstadoIaVouchers {
  activa: boolean;
  enPausa: boolean;
  causa: 'SALDO' | 'CLAVE' | 'ERRORES' | null;
  hastaEn: string | null;
  topeMensual: { usadoUsd: number; topeUsd: number; superado: boolean };
}

export interface ResumenConsumoVoucherIa {
  periodo: string;
  llamadasTotal: number;
  tokensEntrada: number;
  tokensSalida: number;
  tokensTotal: number;
  costoUsdEstimado: number;
  topeMensualUsd: number;
  porcentajeConsumido: number;
  topeAlcanzado: boolean;
  iaActiva: boolean;
}

/** Un voucher del historial del pedido. El mozo no recibe semaforo ni archivoId. */
export interface ItemHistorialVoucher {
  id: string;
  subidoEn: string;
  subidoPor: string | null;
  medio: string | null;
  estado: 'VIGENTE' | 'REEMPLAZADO' | 'RETIRADO';
  reemplazadoEn: string | null;
  motivoCambio: string | null;
  legible: boolean;
  semaforo?: string;
  archivoId?: string;
}

export const vouchersApi = {
  /** Historial de vouchers del pedido (vigentes y reemplazados), más reciente primero. */
  historialPedido: (pedidoId: string | number) =>
    api.get<{ items: ItemHistorialVoucher[] }>(`/admin/pedidos/${pedidoId}/vouchers/historial`),

  /** Quita un voucher sin borrarlo (queda Retirado en el historial). El servidor aplica la regla de cambio. */
  quitarVoucher: (id: string | number, motivo?: string) =>
    api.post(`/admin/vouchers/${id}/quitar`, motivo ? { motivo } : {}),

  /** Plan de pago que arma el mozo antes de subir cada captura (el servidor deriva el monto por medio). */
  guardarPlanPago: (pedidoId: string | number, plan: PlanPagoItem[]) =>
    api.post(`/admin/pedidos/${pedidoId}/plan-pago`, { plan }),

  /**
   * Sube una foto de voucher para análisis con IA (POST /admin/vouchers).
   * Para MOZO: responde { id, legible: boolean, mensaje?: string }
   * Para CAJERO/ADMIN: responde { id, legible, semaforo, motivos, extraido }
   */
  async subirVoucher(
    archivo: File | Blob,
    pedidoId: string | number,
    medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA',
    /** Solo al reemplazar un voucher vigente: obligatorio (≥5) para Caja y Admin. */
    motivoCambio?: string,
  ): Promise<RespuestaSubirVoucher> {
    const formData = new FormData();
    const nombreArchivo =
      archivo instanceof File ? archivo.name : `voucher-${Date.now()}.jpg`;
    formData.append('archivo', archivo, nombreArchivo);
    formData.append('pedidoId', String(pedidoId));
    formData.append('medio', medio);
    if (motivoCambio) formData.append('motivoCambio', motivoCambio);

    return clienteFetch<RespuestaSubirVoucher>('/admin/vouchers', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Lista vouchers registrados según filtros (GET /admin/vouchers).
   * Requiere permiso vouchers/ver (CAJERO, ADMIN).
   */
  async listarVouchers(
    filtros: FiltrosListarVouchers = {},
  ): Promise<VoucherPagoItem[]> {
    const params = new URLSearchParams();
    if (filtros.pedidoId !== undefined) {
      params.append('pedidoId', String(filtros.pedidoId));
    }
    if (filtros.conversacionId !== undefined) {
      params.append('conversacionId', String(filtros.conversacionId));
    }
    if (filtros.fecha) {
      params.append('fecha', filtros.fecha);
    }
    if (filtros.estado) {
      params.append('estado', filtros.estado);
    }

    const qs = params.toString();
    const ruta = `/admin/vouchers${qs ? `?${qs}` : ''}`;
    // El servidor responde { vouchers, faltanRevisar, total }; aquí se devuelve solo la lista
    const respuesta = await api.get<VoucherPagoItem[] | { vouchers?: VoucherPagoItem[] }>(ruta);
    if (Array.isArray(respuesta)) return respuesta;
    return Array.isArray(respuesta?.vouchers) ? respuesta.vouchers : [];
  },

  /**
   * El mozo avisa a Caja que el pago digital del pedido aún no tiene foto (POST /admin/vouchers/aviso-sin-foto).
   */
  async avisarSinFoto(pedidoId: string | number): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/admin/vouchers/aviso-sin-foto', { pedidoId: String(pedidoId) });
  },

  /**
   * El mozo envía a Caja el cobro de la mesa (POST /admin/vouchers/enviar-a-caja).
   * Con plan (pago dividido) reemplaza el plan guardado del pedido; `medio` es el principal.
   * No cobra: Caja revisa el voucher y cobra. La respuesta es solo { ok }.
   */
  async enviarACaja(
    pedidoId: string | number,
    medio: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA',
    plan?: PlanPagoItem[],
  ): Promise<{ ok: boolean }> {
    return api.post<{ ok: boolean }>('/admin/vouchers/enviar-a-caja', {
      pedidoId: String(pedidoId),
      medio,
      ...(plan ? { plan } : {}),
    });
  },

  /**
   * Marca un voucher como revisado (POST /admin/vouchers/:id/revisado).
   * Requiere permiso vouchers/ver (CAJERO, ADMIN).
   */
  async marcarRevisado(
    id: string | number,
  ): Promise<{ ok: boolean; id: string | number; revisadoEn: string }> {
    return api.post<{ ok: boolean; id: string | number; revisadoEn: string }>(
      `/admin/vouchers/${id}/revisado`,
    );
  },

  /**
   * Pausa de la lectura con IA (saldo, clave o errores) y tope mensual (GET /admin/vouchers/estado-ia).
   * Requiere vouchers/ver o configuracion/ver.
   */
  async obtenerEstadoIa(): Promise<EstadoIaVouchers> {
    return api.get<EstadoIaVouchers>('/admin/vouchers/estado-ia');
  },

  /**
   * Obtiene los parámetros de configuración de vouchers desde /admin/configuracion.
   */
  async obtenerConfiguracion(): Promise<ParametrosVoucherConfig> {
    const defaults: ParametrosVoucherConfig = {
      voucher_ia_activo: false,
      voucher_titular_nombre: 'Maria Jose Morillo Ruiz',
      voucher_yape_numero: '977503006',
      voucher_plin_numero: '977503006',
      chatbot_ia_tope_mensual_usd: 20,
      voucher_ia_corte_min: 10,
    };

    try {
      const params = await api.get<Array<{ clave: string; valor: any }>>(
        '/admin/configuracion',
      );
      if (!Array.isArray(params)) return defaults;

      for (const p of params) {
        if (p.clave === 'voucher_ia_activo') {
          defaults.voucher_ia_activo =
            p.valor === true ||
            String(p.valor).toLowerCase() === 'true' ||
            String(p.valor).toLowerCase() === 'si';
        } else if (p.clave === 'voucher_titular_nombre' && p.valor != null) {
          defaults.voucher_titular_nombre = String(p.valor);
        } else if (p.clave === 'voucher_yape_numero' && p.valor != null) {
          defaults.voucher_yape_numero = String(p.valor);
        } else if (p.clave === 'voucher_plin_numero' && p.valor != null) {
          defaults.voucher_plin_numero = String(p.valor);
        } else if (p.clave === 'chatbot_ia_tope_mensual_usd' && Number(p.valor) > 0) {
          defaults.chatbot_ia_tope_mensual_usd = Number(p.valor);
        } else if (p.clave === 'voucher_ia_corte_min' && Number(p.valor) > 0) {
          defaults.voucher_ia_corte_min = Number(p.valor);
        }
      }
    } catch {
      // Usar defaults si falla la consulta
    }

    return defaults;
  },

  /**
   * Actualiza un parámetro de configuración en /admin/configuracion/:clave.
   */
  async guardarParametro(
    clave: string,
    valor: any,
  ): Promise<{ ok: boolean }> {
    return api.put<{ ok: boolean }>(`/admin/configuracion/${clave}`, { valor });
  },

  /**
   * Consulta el consumo de IA del mes en /admin/configuracion/ia-consumo.
   */
  async obtenerConsumoIa(): Promise<ResumenConsumoVoucherIa | null> {
    try {
      const res = await api.get<ResumenConsumoVoucherIa>(
        '/admin/configuracion/ia-consumo',
      );
      if (res && typeof res.tokensTotal === 'number') {
        return res;
      }
      return null;
    } catch {
      return null;
    }
  },
};
