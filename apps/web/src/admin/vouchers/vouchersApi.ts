import { api, clienteFetch } from '../../comun/api';
import {
  ParametrosVoucherConfig,
  RespuestaSubirVoucher,
  VoucherPagoItem,
} from './tipos';

export interface FiltrosListarVouchers {
  pedidoId?: string | number;
  conversacionId?: string | number;
  fecha?: string;
  estado?: 'pendientes' | 'todos';
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

export const vouchersApi = {
  /**
   * Sube una foto de voucher para análisis con IA (POST /admin/vouchers).
   * Para MOZO: responde { id, legible: boolean, mensaje?: string }
   * Para CAJERO/ADMIN: responde { id, legible, semaforo, motivos, extraido }
   */
  async subirVoucher(
    archivo: File | Blob,
    pedidoId: string | number,
    medio: 'YAPE' | 'PLIN' | 'TRANSFERENCIA',
  ): Promise<RespuestaSubirVoucher> {
    const formData = new FormData();
    const nombreArchivo =
      archivo instanceof File ? archivo.name : `voucher-${Date.now()}.jpg`;
    formData.append('archivo', archivo, nombreArchivo);
    formData.append('pedidoId', String(pedidoId));
    formData.append('medio', medio);

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
   * Obtiene los parámetros de configuración de vouchers desde /admin/configuracion.
   */
  async obtenerConfiguracion(): Promise<ParametrosVoucherConfig> {
    const defaults: ParametrosVoucherConfig = {
      voucher_ia_activo: false,
      voucher_titular_nombre: 'Kevin',
      voucher_yape_numero: '946388934',
      voucher_plin_numero: '946388934',
      voucher_mozo_obligatorio: true,
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
        } else if (p.clave === 'voucher_mozo_obligatorio') {
          defaults.voucher_mozo_obligatorio =
            p.valor === true ||
            String(p.valor).toLowerCase() === 'true' ||
            String(p.valor).toLowerCase() === 'si';
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
