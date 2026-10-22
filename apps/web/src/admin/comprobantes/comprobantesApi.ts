import { clienteFetch } from '../../comun/api';
import type {
  RespuestaListarPorEmitir,
  NotaVentaDatos,
  RespuestaListarReclamos,
  ReclamoAdminDetalle,
  CartaLegalInfo,
  ConstanciaReclamoPublico,
  ConsultaConstanciaPublica,
} from './tipos';

export const comprobantesApi = {
  // Comprobantes (Admin)
  async listarPorEmitir(pagina = 1, limite = 20): Promise<RespuestaListarPorEmitir> {
    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
    });
    return clienteFetch<RespuestaListarPorEmitir>(
      `/admin/comprobantes/por-emitir?${params.toString()}`,
    );
  },

  async obtenerNotaVenta(pedidoId: string): Promise<NotaVentaDatos> {
    return clienteFetch<NotaVentaDatos>(
      `/admin/comprobantes/pedido/${encodeURIComponent(pedidoId)}`,
    );
  },

  async reimprimirNotaVenta(pedidoId: string): Promise<NotaVentaDatos> {
    return clienteFetch<NotaVentaDatos>(
      `/admin/comprobantes/pedido/${encodeURIComponent(pedidoId)}/reimprimir`,
      {
        method: 'POST',
      },
    );
  },

  async marcarEmitido(id: string, referenciaExterna: string): Promise<{ id: string; emision: string; referencia_externa: string }> {
    return clienteFetch(
      `/admin/comprobantes/${encodeURIComponent(id)}/emitido`,
      {
        method: 'POST',
        body: JSON.stringify({ referenciaExterna }),
      },
    );
  },

  // Reclamos (Admin)
  async listarReclamos(filtros: {
    estado?: string;
    tipo?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    limite?: number;
  } = {}): Promise<RespuestaListarReclamos> {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros.limite) params.set('limite', String(filtros.limite));

    const query = params.toString();
    return clienteFetch<RespuestaListarReclamos>(
      `/admin/reclamos${query ? `?${query}` : ''}`,
    );
  },

  async obtenerReclamoPorId(id: string): Promise<ReclamoAdminDetalle> {
    return clienteFetch<ReclamoAdminDetalle>(
      `/admin/reclamos/${encodeURIComponent(id)}`,
    );
  },

  async marcarEnRevision(id: string): Promise<any> {
    return clienteFetch(
      `/admin/reclamos/${encodeURIComponent(id)}/en-revision`,
      {
        method: 'POST',
      },
    );
  },

  async responderReclamo(id: string, respuesta: string): Promise<any> {
    return clienteFetch(
      `/admin/reclamos/${encodeURIComponent(id)}/responder`,
      {
        method: 'POST',
        body: JSON.stringify({ respuesta }),
      },
    );
  },

  // Legal y Reclamos (Público)
  async obtenerCartaLegal(): Promise<CartaLegalInfo> {
    return clienteFetch<CartaLegalInfo>('/carta/legal');
  },

  async crearReclamoPublico(dto: {
    tipo: 'RECLAMO' | 'QUEJA';
    nombre: string;
    documento: string;
    domicilio: string;
    telefono: string;
    correo?: string;
    pedidoCodigo?: string;
    detalle: string;
    montoReclamado?: number;
    aceptaPrivacidad: boolean;
  }): Promise<ConstanciaReclamoPublico> {
    return clienteFetch<ConstanciaReclamoPublico>('/reclamos', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async consultarConstanciaPublica(
    numero: string,
    documento: string,
  ): Promise<ConsultaConstanciaPublica> {
    const params = new URLSearchParams({ documento: documento.trim() });
    return clienteFetch<ConsultaConstanciaPublica>(
      `/reclamos/constancia/${encodeURIComponent(numero.trim())}?${params.toString()}`,
    );
  },
};
