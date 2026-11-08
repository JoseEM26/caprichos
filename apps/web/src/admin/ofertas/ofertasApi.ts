import { api, clienteFetch } from '../../comun/api';

export interface ComboPrecioItem {
  tamanoValorId?: string;
  tamanoNombre: string;
  precio: number;
  /** Solo en el editor: apagado = el tamaño no se ofrece. */
  activo?: boolean;
}

/** Opción de una parte con lista (juguetes, donas) o alternativa: si se puede elegir ahora y, por sabor, cada sabor con su saldo. */
export interface OpcionDetalleCombo {
  id: string;
  nombre: string;
  disponible: boolean;
  /** Bloqueada por saldo 0 (se muestra «No hay stock») */
  sinStock?: boolean;
  /** Foto del producto (bebidas por categorías). */
  fotoUrl?: string;
  /** Categoría del producto (si el servidor la envía): habilita los chips de categoría en las bebidas del combo. */
  categoria?: string;
  sabores?: { id: string; nombre: string; disponible: boolean; saldo: number }[];
}

/** Alternativa de una parte: producto y cantidad («si no hay stock, el cliente podrá elegir»). Mismo precio del combo. */
export interface AlternativaParteItem extends OpcionDetalleCombo {
  cantidad: number;
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
  /** Alternativas en orden. Entrada (admin): producto y cantidad; salida: además disponibilidad ahora. */
  alternativas?: AlternativaParteItem[];
  /** Calculado por el servidor: el original no alcanza y hay alguna alternativa con stock. */
  alternativasActivas?: boolean;
  /** Calculado por el servidor en tiempo real */
  disponible?: boolean;
  opcionesDisponibles?: string[];
  principalNombre?: string;
  /** Complemento a elegir: las partes con el mismo grupo se reparten en paquetes (por nombre) y se elige UNO. Null = parte normal. */
  paqueteGrupo?: string | null;
  paqueteNombre?: string | null;
  /** Sabores permitidos en la parte (ids de sabor); vacío o ausente = todos. */
  saboresIds?: string[];
  /** Productos que no entran en la parte aunque su categoría sí. */
  productosExcluidos?: string[];
  /** Parte FIJO opcional: el cliente puede quitarla o pedir extras. `cantidad` = incluidas; lleva de cantidadMin a cantidadMax (null = incluidas). */
  opcional?: boolean;
  cantidadMin?: number;
  cantidadMax?: number | null;
  incluidaPorDefecto?: boolean;
  /** Cobro por cada unidad por encima de las incluidas; null = sin cobro. */
  precioExtra?: number | null;
  /** Solo del editor (no viaja al servidor): tipo de pieza de un complemento y si su título lo escribió el dueño. */
  pieza?: 'CATEGORIA' | 'PRODUCTO';
  nombreManual?: boolean;
  uid?: string;
  /** FIJO de un producto: tamaño (producto_tamano) elegido y su nombre; vacío = sin tamaño */
  tamanoId?: string | null;
  tamanoNombre?: string | null;
  tamanoUnidades?: number;
  /** A_ELECCION con lista (juguetes, donas): cada opción y si se puede elegir ahora. */
  opcionesDetalle?: OpcionDetalleCombo[];
  /** Parte de bebidas por categorías: el cliente elige «Bebida 1..N» entre `opcionesDetalle`. */
  bebidas?: boolean;
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
  tipo: 'COMBO' | 'LLEVA_PAGA' | 'DESCUENTO' | 'DESCUENTO_AUTOMATICO' | 'ENVIO_GRATIS';
  nombre: string;
  descripcion?: string | null;
  lleva?: number | null;
  paga?: number | null;
  subtipo?: string | null;
  aplicaA?: 'TODA_LA_CARTA' | 'CATEGORIA' | 'PRODUCTO';
  alcanceCategoriaId?: string | null;
  alcanceCategoriaIds?: string[];
  categoriasNombres?: string[];
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
  /** Tipos de pedido donde vale (COMER_LOCAL, LLEVAR, RECOGER, DELIVERY); vacío = todos */
  modalidades?: string[];
  limiteUsos?: number | null;
  usosActuales?: number;
  noSumaBeneficios?: boolean;
  mostrarEnSaludoBot?: boolean;
  soloPrimeraCompra?: boolean;
  orden?: number;
  activo: boolean;
  /** Se muestra en la carta virtual (el diseñador la oculta sin apagar el descuento) */
  visibleCarta?: boolean;
  creadoEn: string;
  vigenteAhora?: boolean;
  imagenArchivoId?: string | null;
  imagenUrl?: string | null;
  combosPrecio?: ComboPrecioItem[];
  combosPrecios?: ComboPrecioItem[];
  combosParte?: ComboParteItem[];
  /** Combo: se puede armar ahora (calculado; no cambia `activo`) */
  disponible?: boolean;
  motivoAgotado?: string | null;
  /** Última desactivación a mano (de la auditoría): cuándo y quién. Solo en el listado del panel. */
  desactivadaEn?: string | null;
  desactivadaPor?: string | null;
  /** Combo no armable por saldo 0 de sus productos: se muestra «No disponible». */
  sinStock?: boolean;
  combosPartes?: ComboParteItem[];
  llevaPaga?: LlevaPagaConfig | null;
}

export interface CuponItem {
  id: string;
  codigoBase: string;
  descripcion: string;
  modo: 'UNICO_COMPROBANTE' | 'COMPARTIDO';
  tipo?: 'PORCENTAJE' | 'MONTO_FIJO';
  descuentoTipo?: 'PORCENTAJE' | 'MONTO' | 'ENVIO_GRATIS';
  valor?: number;
  descuentoValor?: number;
  compraMinima?: number | null;
  /** Horario del cupón (vacío = siempre) */
  dias?: number[];
  horaDesde?: string | null;
  horaHasta?: string | null;
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

  /** Al desactivar, `visibleCarta` dice si la carta la oculta (false) o la muestra como «No disponible» (true). */
  async cambiarEstadoOferta(id: string, activo: boolean, visibleCarta?: boolean): Promise<OfertaItem> {
    return api.patch<OfertaItem>(`/admin/ofertas/${id}/estado`, { activo, ...(visibleCarta !== undefined ? { visibleCarta } : {}) });
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

  async subirFoto(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('archivo', file);
    return clienteFetch<{ id: string; url: string }>('/admin/archivos', {
      method: 'POST',
      body: formData,
    });
  },
};
