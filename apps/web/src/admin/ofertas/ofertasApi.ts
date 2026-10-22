import { api } from '../../comun/api';

export interface ComboPrecioItem {
  tamanoValorId?: string;
  tamanoNombre: string;
  precio: number;
}

export interface ComboParteItem {
  id?: string;
  tipo?: 'A_ELECCION' | 'UNA_DE' | 'FIJO';
  tipoParte?: 'A_ELECCION' | 'UNA_DE' | 'FIJO' | 'OPCIONES';
  cantidad: number;
  nombre?: string;
  categorias?: string[];
  productos?: any[];
  opciones?: any[];
  orden?: number;
}

export interface LlevaPagaConfig {
  lleva: number;
  paga: number;
  precio: number;
  componentes: Array<{
    tipo: 'PRODUCTO' | 'CATEGORIA' | 'TIPO';
    productoId?: string;
    nombre: string;
    categoriaId?: string;
    cantidad: number;
  }>;
}

export interface OfertaItem {
  id: string;
  tipo: 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'DESCUENTO_AUTOMATICO';
  nombre: string;
  descripcion?: string | null;
  lleva?: number | null;
  paga?: number | null;
  subtipo?: string | null;
  aplicaA?: 'TODA_LA_CARTA' | 'CATEGORIA' | 'PRODUCTO';
  alcanceCategoriaId?: string | null;
  alcanceProductoId?: string | null;
  categoriaId?: string | null;
  categoriaNombre?: string | null;
  productoId?: string | null;
  productoNombre?: string | null;
  descuentoTipo?: 'PORCENTAJE' | 'MONTO' | 'MONTO_FIJO' | null;
  descuentoValor?: number | null;
  compraMinima?: number | null;
  dias?: number[];
  diasSemana?: number[];
  horaDesde?: string | null;
  horaHasta?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  canales?: string[];
  limiteUsos?: number | null;
  usosActuales?: number;
  noSumaBeneficios?: boolean;
  orden?: number;
  activo: boolean;
  creadoEn: string;
  vigenteAhora?: boolean;
  combosPrecio?: ComboPrecioItem[];
  combosPrecios?: ComboPrecioItem[];
  combosParte?: ComboParteItem[];
  combosPartes?: ComboParteItem[];
  llevaPaga?: LlevaPagaConfig | null;
}

export interface CuponItem {
  id: string;
  codigoBase: string;
  descripcion: string;
  modo: 'UNICO_COMPROBANTE' | 'COMPARTIDO';
  tipo?: 'PORCENTAJE' | 'MONTO_FIJO';
  descuentoTipo?: 'PORCENTAJE' | 'MONTO';
  valor?: number;
  descuentoValor?: number;
  compraMinima?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  maxUsos?: number | null;
  topeUsos?: number | null;
  usosActuales: number;
  maxPorCliente?: number | null;
  aplicaA?: 'TODA_LA_CARTA' | 'CATEGORIA' | 'PRODUCTO';
  categoriaId?: string | null;
  categoriaNombre?: string | null;
  productoId?: string | null;
  productoNombre?: string | null;
  imprimirEnComprobante?: boolean;
  tituloImpreso?: string | null;
  diasValidezImpreso?: number | null;
  diasValidez?: number | null;
  canal?: string;
  canales?: string[];
  requiereCuenta?: boolean;
  orden: number;
  activo: boolean;
  totalEmitidos?: number;
  totalCanjeados?: number;
  totalVigentes?: number;
  vecesImpreso?: number;
  creadoEn: string;
}

export interface CuponEmitidoItem {
  id: string;
  cuponId: string;
  codigo: string;
  pedidoOrigenId?: string | null;
  pedidoOrigenCodigo?: string | null;
  venceEn?: string | null;
  estado: 'VIGENTE' | 'CANJEADO' | 'VENCIDO' | 'ANULADO';
  canjeadoEn?: string | null;
  pedidoCanjeId?: string | null;
  pedidoCanjeCodigo?: string | null;
  motivoAnulacion?: string | null;
  anuladoEn?: string | null;
  creadoEn: string;
  cuponCodigoBase: string;
  cuponDescripcion: string;
  descuentoTipo: 'PORCENTAJE' | 'MONTO' | 'MONTO_FIJO';
  descuentoValor: number;
}

export interface ReglasAcumulacionItem {
  id: number;
  cuponConDescuento: boolean;
  promoConDescuento: boolean;
  cuponesPorComprobante: number;
  diasValidezCupon?: number;
  textoPie: string;
  actualizadoEn?: string;
}

export const ofertasApi = {
  // Ofertas (Promos y Descuentos)
  async listarOfertas(tipo?: string, soloActivas?: boolean, canal?: string): Promise<OfertaItem[]> {
    const params = new URLSearchParams();
    if (tipo) params.append('tipo', tipo);
    if (soloActivas !== undefined) params.append('soloActivas', String(soloActivas));
    if (canal) params.append('canal', canal);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<OfertaItem[]>(`/admin/ofertas${query}`);
  },

  async crearOferta(payload: any): Promise<OfertaItem> {
    return api.post<OfertaItem>('/admin/ofertas', payload);
  },

  async actualizarOferta(id: string, payload: any): Promise<OfertaItem> {
    return api.put<OfertaItem>(`/admin/ofertas/${id}`, payload);
  },

  async cambiarEstadoOferta(id: string, activo: boolean): Promise<OfertaItem> {
    return api.patch<OfertaItem>(`/admin/ofertas/${id}/estado`, { activo });
  },

  // Reglas
  async obtenerReglas(): Promise<ReglasAcumulacionItem> {
    return api.get<ReglasAcumulacionItem>('/admin/ofertas/reglas');
  },

  async actualizarReglas(payload: Partial<ReglasAcumulacionItem>): Promise<ReglasAcumulacionItem> {
    return api.put<ReglasAcumulacionItem>('/admin/ofertas/reglas', payload);
  },

  // Cupones
  async listarCupones(soloActivos?: boolean): Promise<CuponItem[]> {
    const query = soloActivos ? '?soloActivos=true' : '';
    return api.get<CuponItem[]>(`/admin/cupones${query}`);
  },

  async crearCupon(payload: any): Promise<CuponItem> {
    return api.post<CuponItem>('/admin/cupones', payload);
  },

  async actualizarCupon(id: string, payload: any): Promise<CuponItem> {
    return api.put<CuponItem>(`/admin/cupones/${id}`, payload);
  },

  async cambiarEstadoCupon(id: string, activo: boolean): Promise<CuponItem> {
    return api.patch<CuponItem>(`/admin/cupones/${id}/estado`, { activo });
  },

  async listarCuponesEmitidos(estado?: string, q?: string): Promise<CuponEmitidoItem[]> {
    const params = new URLSearchParams();
    if (estado && estado !== 'Todos') params.append('estado', estado);
    if (q) params.append('q', q);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<CuponEmitidoItem[]>(`/admin/cupones/emitidos${query}`);
  },

  async anularCuponEmitido(id: string, motivo: string): Promise<any> {
    return api.post(`/admin/cupones/emitidos/${id}/anular`, { motivo });
  },
};
