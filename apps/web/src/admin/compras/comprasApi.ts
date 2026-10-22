import { api } from '../../comun/api';

export interface ComprasResumen {
  pedidosPorRecibir: number;
  porPagar: number;
  compradoMes: number;
  listaPedir: number;
}

export interface ProveedorItem {
  id: string;
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  telefono: string;
  contacto: string;
  diasCredito: number;
  cuentaPago: string;
  activo: boolean;
  totalCompras?: number;
}

export interface InsumoParaPedir {
  id: string;
  nombre: string;
  unidadAlmacen: string;
  unidadCompra: string;
  factorConversion: number;
  costoUnitario: number;
  stockActual: number;
  stockMinimo: number;
  stockIdeal: number;
  cantidadSugerida: number;
  proveedorId?: string;
  proveedorNombre?: string;
  proveedorTelefono?: string;
  estadoStock: 'BAJO' | 'REGULAR' | 'OPTIMO';
}

export interface PedidoProveedorItem {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorTelefono: string;
  estado: string;
  totalEstimado: number;
  enviadoEn: string | null;
  creadoEn: string;
  lineas: Array<{
    id: string;
    insumoId: string;
    insumoNombre: string;
    unidad: string;
    cantidadPedida: number;
    precioUnitario: number;
    subtotal: number;
    recibido: number;
  }>;
}

export interface CompraItem {
  id: string;
  rawId?: string;
  comprobanteTipo: string;
  comprobanteNumero: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRuc?: string;
  estado: string;
  estadoPago: string;
  condicion: string;
  diasCredito: number;
  subtotal: number;
  igv: number;
  montoTotal: number;
  fechaEmision: string;
  fechaVencimientoPago?: string;
  creadoEn: string;
  insumosResumen?: string;
  esPedidoPorRecibir?: boolean;
  stBg?: string;
  anuladaEn?: string | null;
  lineas: Array<{
    id?: string;
    insumoId: string;
    insumoNombre?: string;
    nombre?: string;
    unidad?: string;
    cantidadCompra?: number;
    cantidad?: number;
    cantidadAlmacen?: number;
    costoUnit: number;
    subtotal?: number;
    lote?: string;
    fechaVencimiento?: string;
  }>;
}

export interface CrearProveedorDto {
  razonSocial: string;
  nombreComercial?: string;
  ruc?: string;
  telefono?: string;
  diasCredito?: number;
  cuentaPago?: string;
}

export interface CrearPedidoProveedorDto {
  proveedorPartyId: string | number;
  lineas: Array<{
    insumoId: string | number;
    cantidadCompra: number;
  }>;
}

export interface CrearCompraDto {
  proveedorPartyId: string | number;
  pedidoProveedorId?: string | number;
  comprobanteTipo: string;
  comprobanteNumero: string;
  condicion: 'CONTADO' | 'CREDITO';
  diasCredito?: number;
  fechaEmision?: string;
  montoTotal?: number;
  igv?: number;
  nota?: string;
  lineas: Array<{
    insumoId: string | number;
    cantidadCompra: number;
    costoUnit: number;
    unidad?: 'compra' | 'almacen';
  }>;
}

export const comprasApi = {
  obtenerResumen: () =>
    api.get<ComprasResumen>('/admin/compras/resumen'),

  listarProveedores: () =>
    api.get<ProveedorItem[]>('/admin/compras/proveedores'),

  crearProveedor: (dto: CrearProveedorDto) =>
    api.post<ProveedorItem>('/admin/compras/proveedores', dto),

  actualizarProveedor: (id: string, dto: Partial<CrearProveedorDto>) =>
    api.put<ProveedorItem>(`/admin/compras/proveedores/${id}`, dto),

  cambiarEstadoProveedor: (id: string, activo: boolean) =>
    api.patch<{ ok: boolean }>(`/admin/compras/proveedores/${id}/estado`, { activo }),

  obtenerHistorialProveedor: (id: string) =>
    api.get<{ compras: CompraItem[]; totalCompras: number }>(`/admin/compras/proveedores/${id}/historial`),

  listarInsumosParaPedir: (incluirRegulares = false) =>
    api.get<InsumoParaPedir[]>(`/admin/compras/insumos-para-pedir?incluirRegulares=${incluirRegulares}`),

  crearPedidoProveedor: (dto: CrearPedidoProveedorDto) =>
    api.post<{ id: string; estado: string; enviadoEn: string | null }>('/admin/compras/pedidos-proveedor', dto),

  anularPedidoProveedor: (id: string, motivo: string) =>
    api.patch<{ ok: boolean }>(`/admin/compras/pedidos-proveedor/${id}/anular`, { motivo }),

  listarCompras: async (filtros?: { proveedorId?: string; estado?: string; desde?: string; hasta?: string }): Promise<CompraItem[]> => {
    const params = new URLSearchParams();
    if (filtros?.proveedorId) params.append('proveedorId', filtros.proveedorId);
    if (filtros?.estado) params.append('estado', filtros.estado);
    if (filtros?.desde) params.append('desde', filtros.desde);
    if (filtros?.hasta) params.append('hasta', filtros.hasta);
    const qs = params.toString();
    const res = await api.get<any[]>(`/admin/compras${qs ? `?${qs}` : ''}`);
    if (!Array.isArray(res)) return [];
    return res.map((c) => ({
      id: String(c.id),
      rawId: String(c.rawId || c.id),
      comprobanteTipo: c.comp || c.comprobanteTipo || 'Factura',
      comprobanteNumero: c.id || c.comprobanteNumero || '',
      proveedorId: String(c.proveedorPartyId || c.proveedorId || ''),
      proveedorNombre: c.prov || c.proveedorNombre || '',
      proveedorRuc: c.proveedorRuc || '',
      estado: c.estado || 'Recibida',
      estadoPago: c.pago || c.estadoPago || 'Contado',
      condicion: c.condicion || (c.pago?.includes('Crédito') ? 'CREDITO' : 'CONTADO'),
      diasCredito: c.diasCredito || (c.pago?.includes('15') ? 15 : 0),
      subtotal: c.subtotal || (c.total ? c.total / 1.18 : 0),
      igv: c.igv || (c.total ? c.total - c.total / 1.18 : 0),
      montoTotal: Number(c.total || c.montoTotal || 0),
      fechaEmision: c.fecha || c.fechaEmision || '',
      creadoEn: c.creadoEn || '',
      insumosResumen: c.resumen || c.insumosResumen || '',
      esPedidoPorRecibir: !!c.esPedidoPorRecibir,
      stBg:
        c.stBg ||
        (c.estado === 'Anulada' || c.anuladaEn
          ? 'var(--cp-line)'
          : c.estado === 'Por recibir' || c.esPedidoPorRecibir
          ? 'rgb(255, 241, 201)'
          : 'var(--cp-greenbg)'),
      anuladaEn: c.anuladaEn || null,
      lineas: Array.isArray(c.lineas)
        ? c.lineas.map((l: any) => ({
            id: String(l.id || ''),
            insumoId: String(l.insumoId || ''),
            insumoNombre: l.nombre || l.insumoNombre || '',
            unidad: l.unidad || '',
            cantidadCompra: Number(l.cantidad || l.cantidadCompra || 0),
            cantidadAlmacen: Number(l.cantidad || l.cantidadAlmacen || 0),
            costoUnit: Number(l.costoUnit || 0),
            subtotal: Number(l.subtotal || (l.cantidad * l.costoUnit) || 0),
          }))
        : [],
    }));
  },

  registrarCompra: (dto: CrearCompraDto) =>
    api.post<CompraItem>('/admin/compras', dto),

  recibirPedido: (pedidoId: string, dto?: { comprobanteTipo?: string; comprobanteNumero?: string; montoTotal?: number }) =>
    api.post<{ ok: boolean; compraId: string }>(`/admin/compras/pedidos-proveedor/${pedidoId}/recibir`, dto || {}),

  marcarPagada: (compraId: string) =>
    api.patch<{ ok: boolean; estadoPago: string }>(`/admin/compras/${compraId}/pagar`),

  anularCompra: (compraId: string, motivo: string) =>
    api.patch<{ ok: boolean }>(`/admin/compras/${compraId}/anular`, { motivo }),
};
