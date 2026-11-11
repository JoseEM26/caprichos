import { clienteFetch, obtenerBlobAutenticado } from '../../comun/api';
import type {
  BoletaPorDefecto,
  RespuestaListarPorEmitir,
  NotaVentaDatos,
  RespuestaListarReclamos,
  ReclamoAdminDetalle,
  CartaLegalInfo,
  ConstanciaReclamoPublico,
  ConsultaConstanciaPublica,
  RespuestaListarQuejasWhatsApp,
  QuejaWhatsAppItem,
  EstadoConexionWhatsAppInfo,
  RespuestaListarElectronicos,
  ConfigFacturacion,
  ComprobantePedido,
  ProveedorFacturacion,
  SaludFacturacion,
  ConfigFacturaWhatsapp,
  EstadoEnvioWhatsapp,
} from './tipos';

export const comprobantesApi = {
  // Comprobantes (Admin)
  async listarPorEmitir(
    pagina = 1,
    limite = 20,
    filtros: { tipo?: string; estado?: string; buscar?: string } = {},
  ): Promise<RespuestaListarPorEmitir> {
    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
    });
    if (filtros.tipo && filtros.tipo !== 'TODOS') params.set('tipo', filtros.tipo);
    if (filtros.estado && filtros.estado !== 'TODOS') params.set('estado', filtros.estado);
    if (filtros.buscar?.trim()) params.set('buscar', filtros.buscar.trim());
    return clienteFetch<RespuestaListarPorEmitir>(
      `/admin/comprobantes/por-emitir?${params.toString()}`,
    );
  },

  async obtenerNotaVenta(pedidoId: string): Promise<NotaVentaDatos> {
    return clienteFetch<NotaVentaDatos>(
      `/admin/comprobantes/pedido/${encodeURIComponent(pedidoId)}`,
    );
  },

  /** Todos los comprobantes de un pedido y sus extras (solo lectura), vigentes primero. */
  async listarPorPedido(pedidoId: string): Promise<{ elementos: ComprobantePedido[] }> {
    return clienteFetch<{ elementos: ComprobantePedido[] }>(
      `/admin/comprobantes/pedido/${encodeURIComponent(pedidoId)}/lista`,
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

  // Facturación electrónica (SUNAT)
  async listarElectronicos(pagina = 1, limite = 20): Promise<RespuestaListarElectronicos> {
    const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
    return clienteFetch<RespuestaListarElectronicos>(`/admin/comprobantes/emitidos?${params.toString()}`);
  },

  /** Solo los comprobantes con problemas: rechazados, en revisión manual o pendientes con más de 15 min. */
  async listarProblemasElectronicos(pagina = 1, limite = 50): Promise<RespuestaListarElectronicos> {
    const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite), problemas: '1' });
    return clienteFetch<RespuestaListarElectronicos>(`/admin/comprobantes/emitidos?${params.toString()}`);
  },

  /** Conteos de salud (solo ADMIN). */
  async saludFacturacion(): Promise<SaludFacturacion> {
    return clienteFetch<SaludFacturacion>('/admin/comprobantes/salud');
  },

  async reintentarElectronico(
    id: string,
    correccion: { documento?: string; razon?: string; direccion?: string } = {},
  ): Promise<{ id: string; facturacion_estado: string | null }> {
    return clienteFetch(`/admin/comprobantes/${encodeURIComponent(id)}/reintentar`, {
      method: 'POST',
      body: JSON.stringify(correccion),
    });
  },

  async anularElectronico(id: string, motivo: string): Promise<{ id: string; baja_estado: string | null }> {
    return clienteFetch(`/admin/comprobantes/${encodeURIComponent(id)}/anular`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
  },

  /** Anula el comprobante Simulado y emite uno nuevo a SUNAT (fecha de hoy). Devuelve el nuevo. */
  async emitirReal(id: string): Promise<{ id: string; numero_texto: string }> {
    return clienteFetch(`/admin/comprobantes/${encodeURIComponent(id)}/emitir-real`, { method: 'POST' });
  },

  async obtenerFacturacion(): Promise<ConfigFacturacion> {
    return clienteFetch<ConfigFacturacion>('/admin/comprobantes/facturacion');
  },

  /** Marca «Boleta electrónica por defecto» y si hoy aplica (solo con SUNAT real). */
  async obtenerBoletaPorDefecto(): Promise<BoletaPorDefecto> {
    return clienteFetch<BoletaPorDefecto>('/admin/comprobantes/config/boleta-por-defecto');
  },

  async guardarBoletaPorDefecto(activo: boolean): Promise<BoletaPorDefecto> {
    return clienteFetch<BoletaPorDefecto>('/admin/comprobantes/config/boleta-por-defecto', {
      method: 'PUT',
      body: JSON.stringify({ activo }),
    });
  },

  /** Interruptor y plantilla del envío de facturas por WhatsApp. */
  async obtenerFacturaWhatsapp(): Promise<ConfigFacturaWhatsapp> {
    return clienteFetch<ConfigFacturaWhatsapp>('/admin/comprobantes/config/factura-whatsapp');
  },

  async guardarFacturaWhatsapp(config: ConfigFacturaWhatsapp): Promise<ConfigFacturaWhatsapp> {
    return clienteFetch<ConfigFacturaWhatsapp>('/admin/comprobantes/config/factura-whatsapp', { method: 'PUT', body: JSON.stringify(config) });
  },

  /** Vuelve a mandar la factura por WhatsApp (respeta la ventana de 24 h). */
  async reenviarFacturaWhatsapp(id: string): Promise<{ estado: EstadoEnvioWhatsapp; via: 'DOCUMENTO' | 'PLANTILLA' | null }> {
    return clienteFetch(`/admin/comprobantes/${encodeURIComponent(id)}/reenviar-whatsapp`, { method: 'POST' });
  },

  /** Envía ahora el resumen diario de boletas SUNAT (ADMIN). */
  async enviarResumenSunat(): Promise<{ resumenes: number; boletas: number }> {
    return clienteFetch('/admin/comprobantes/sunat/resumen', { method: 'POST' });
  },

  /** URL (blob) del XML firmado, ZIP o CDR de un comprobante, con la sesión del usuario. */
  async urlArchivoElectronico(id: string, tipo: 'XML' | 'CDR' | 'ZIP'): Promise<string> {
    return obtenerBlobAutenticado(`/admin/comprobantes/${encodeURIComponent(id)}/archivos/${tipo}`);
  },

  /** URL (blob) de la representación impresa en PDF de una boleta o factura electrónica, con la sesión del usuario. */
  async urlPdfElectronico(id: string): Promise<string> {
    return obtenerBlobAutenticado(`/admin/comprobantes/${encodeURIComponent(id)}/pdf`);
  },

  async guardarFacturacion(config: {
    igvPct: number;
    serieBoleta: string;
    serieFactura: string;
    proveedor: ProveedorFacturacion;
  }): Promise<ConfigFacturacion> {
    return clienteFetch<ConfigFacturacion>('/admin/comprobantes/facturacion', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
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
    buscar?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    limite?: number;
  } = {}): Promise<RespuestaListarReclamos> {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.buscar?.trim()) params.set('buscar', filtros.buscar.trim());
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

  // Quejas informales de WhatsApp (Chatbot)
  async listarQuejasWhatsApp(filtros: {
    estado?: string;
    pagina?: number;
    limite?: number;
  } = {}): Promise<RespuestaListarQuejasWhatsApp> {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros.limite) params.set('limite', String(filtros.limite));
    const qs = params.toString();
    return clienteFetch<RespuestaListarQuejasWhatsApp>(
      `/admin/reclamos/whatsapp${qs ? `?${qs}` : ''}`,
    );
  },

  async obtenerQuejaWhatsApp(id: string): Promise<QuejaWhatsAppItem> {
    return clienteFetch<QuejaWhatsAppItem>(`/admin/reclamos/whatsapp/${encodeURIComponent(id)}`);
  },

  async cambiarEstadoQuejaWhatsApp(
    id: string,
    dto: { estado: 'EN_REVISION' | 'RESUELTA'; nota?: string },
  ): Promise<{ ok: boolean; id: string; estado: string }> {
    return clienteFetch(`/admin/reclamos/whatsapp/${encodeURIComponent(id)}/estado`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async obtenerEstadoWhatsApp(): Promise<EstadoConexionWhatsAppInfo> {
    return clienteFetch<EstadoConexionWhatsAppInfo>('/admin/reclamos/whatsapp/estado-conexion');
  },
};
