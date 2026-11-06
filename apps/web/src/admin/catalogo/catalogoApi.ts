import { api, clienteFetch } from '../../comun/api';

export interface TamanoItem {
  id: string;
  tamanoValorId: string;
  nombre: string;
  precio: number;
  activo?: boolean;
  /** Unidades del producto que incluye el tamaño (1, 6, 12). Descuenta el stock por sabor. */
  unidades?: number;
}

export interface OpcionItem {
  id: string;
  valorId?: string;
  nombre: string;
  precioExtra: number;
  activo?: boolean;
  disponible?: boolean;
}

export interface RequisitoOpcionAdmin {
  productoId: string;
  productoNombre: string;
  saborId: string | null;
  saborNombre: string | null;
  cantidad: number;
}

export interface RequisitosOpcionAdmin {
  opcionId: string;
  nombre: string;
  requisitos: RequisitoOpcionAdmin[];
  productos: Array<{ id: string; nombre: string; sabores: Array<{ id: string; nombre: string }> }>;
}

export interface GrupoOpcionItem {
  id: string;
  nombre: string;
  listaId?: string | null;
  listaNombre?: string | null;
  obligatorio?: boolean;
  minimo?: number;
  maximo?: number;
  orden?: number;
  activo?: boolean;
  categoriaIds?: string[];
  productosCount?: number;
  opciones: OpcionItem[];
}

export interface SaborItem {
  id?: string;
  nombre: string;
  activo?: boolean;
  disponible?: boolean;
  /** Stock de hoy de este sabor (de la apertura del día). null = sin apertura hoy. */
  quedan?: number | null;
  /** Hay conteo de apertura de este sabor hoy (el saldo arrastra del día anterior, pero conviene contar). */
  aperturaHoy?: boolean;
}

export interface PromocionProducto {
  id: string;
  nombre: string;
  tipo: string;
  vigenteAhora: boolean;
  estado: 'PROGRAMADA' | 'EN_CURSO' | 'VENCIDA';
}

export interface ProductoAdmin {
  id: string;
  categoriaId: string;
  categoria: {
    id: string;
    nombre: string;
  };
  nombre: string;
  descripcion?: string | null;
  precio: number;
  orden: number;
  oculto: boolean;
  disponible: boolean;
  agotadoHasta?: string | null;
  noSumaBeneficios: boolean;
  /** Cocina: resaltar la opción menos pedida (últimos 30 días) de cada grupo de este producto. */
  resaltarOpcionMenosPedida?: boolean;
  /** Stock propio del producto (donas, galletas): se descuenta al vender y se marca agotado en 0. Necesita conteo de apertura. */
  controlaStock: boolean;
  /** Anfitrión de un combo (Dúo, Cajita): su disponibilidad sale de lo que lo compone; no usa stock ni sabores propios. */
  esAnfitrionCombo?: boolean;
  /** Saldo de hoy (solo si controla stock; null si no). Sin sabores es el del producto. */
  quedan?: number | null;
  /** Si ya se contó la apertura de hoy del producto (null si no controla stock). */
  aperturaHoy?: boolean | null;
  /** Promociones activas (descuento / lleva-paga) que alcanzan al producto; los combos no cuentan. */
  promociones?: PromocionProducto[];
  /** Promociones activas de toda la carta (no esconden el botón). */
  promocionesGenerales?: PromocionProducto[];
  fotoUrl?: string | null;
  tamanos: TamanoItem[];
  grupos: GrupoOpcionItem[];
  sabores: SaborItem[];
}

export interface CategoriaAdmin {
  id: string;
  nombre: string;
  areaId: string;
  areaNombre?: string;
  orden: number;
  oculta: boolean;
  llevaOpciones: boolean;
}

export interface ValorListaAdmin {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  usos?: number;
}

export interface ListaAdmin {
  id: string;
  codigo: string;
  nombre: string;
  grupos?: Array<{ id: string; nombre: string }>;
  valores: ValorListaAdmin[];
}

export const catalogoApi = {
  // Productos
  async listarProductos(filtros?: {
    categoria?: string;
    busqueda?: string;
    q?: string;
    incluyeOcultos?: boolean;
  }): Promise<ProductoAdmin[]> {
    const params = new URLSearchParams();
    if (filtros?.categoria) params.set('categoria', filtros.categoria);
    if (filtros?.busqueda) params.set('busqueda', filtros.busqueda);
    if (filtros?.q) params.set('q', filtros.q);
    if (filtros?.incluyeOcultos !== undefined)
      params.set('incluyeOcultos', String(filtros.incluyeOcultos));
    const qs = params.toString();
    return api.get<ProductoAdmin[]>(`/admin/catalogo/productos${qs ? `?${qs}` : ''}`);
  },

  async obtenerProducto(id: string): Promise<ProductoAdmin> {
    return api.get<ProductoAdmin>(`/admin/catalogo/productos/${id}`);
  },

  async crearProducto(data: {
    nombre: string;
    categoriaId: string | number;
    descripcion?: string;
    precio: number;
    fotoArchivoId?: string | number | null;
    orden?: number;
    noSumaBeneficios?: boolean;
    resaltarOpcionMenosPedida?: boolean;
    controlaStock?: boolean;
    tamanos?: Array<{ tamanoValorId: string | number; precio: number; activo?: boolean; unidades?: number }>;
    grupos?: Array<{ grupoId: string | number; orden?: number }>;
    sabores?: string[];
  }): Promise<ProductoAdmin> {
    return api.post<ProductoAdmin>('/admin/catalogo/productos', data);
  },

  async editarProducto(
    id: string,
    data: {
      nombre?: string;
      categoriaId?: string | number;
      descripcion?: string;
      precio?: number;
      fotoArchivoId?: string | number | null;
      orden?: number;
      oculto?: boolean;
      noSumaBeneficios?: boolean;
      resaltarOpcionMenosPedida?: boolean;
      controlaStock?: boolean;
      tamanos?: Array<{ tamanoValorId: string | number; precio: number; activo?: boolean; unidades?: number }>;
      grupos?: Array<{ grupoId: string | number; orden?: number }>;
      sabores?: Array<{ id?: string | number; nombre: string; activo?: boolean }>;
      /** true: los grupos que no vengan en `grupos` se desligan de este producto. */
      sincronizarGrupos?: boolean;
    },
  ): Promise<ProductoAdmin> {
    return api.patch<ProductoAdmin>(`/admin/catalogo/productos/${id}`, data);
  },

  async agotarProducto(
    id: string,
    data: { alcance?: 'HOY' | 'INDEFINIDO'; agotadoHasta?: string },
  ): Promise<{ ok: boolean; disponible: boolean; agotadoHasta: string | null }> {
    return api.post(`/admin/catalogo/productos/${id}/agotar`, data);
  },

  async disponibilizarProducto(
    id: string,
  ): Promise<{ ok: boolean; disponible: boolean; agotadoHasta: null }> {
    return api.post(`/admin/catalogo/productos/${id}/disponible`);
  },

  async ocultarProducto(
    id: string,
  ): Promise<{ ok: boolean; id: string; oculto: boolean }> {
    return api.post(`/admin/catalogo/productos/${id}/ocultar`);
  },

  async mostrarProducto(
    id: string,
  ): Promise<{ ok: boolean; id: string; oculto: boolean }> {
    return api.post(`/admin/catalogo/productos/${id}/mostrar`);
  },

  async asociarFoto(
    id: string,
    fotoArchivoId: string | number | null,
  ): Promise<{ ok: boolean; fotoArchivoId: string | null; fotoUrl: string | null }> {
    return api.put(`/admin/catalogo/productos/${id}/foto`, { fotoArchivoId });
  },

  // Categorías
  async listarCategorias(): Promise<CategoriaAdmin[]> {
    return api.get<CategoriaAdmin[]>('/admin/catalogo/categorias');
  },

  async crearCategoria(data: {
    nombre: string;
    areaId?: string | number;
    orden?: number;
    llevaOpciones?: boolean;
    oculta?: boolean;
  }): Promise<CategoriaAdmin> {
    return api.post<CategoriaAdmin>('/admin/catalogo/categorias', data);
  },

  async actualizarCategoria(
    id: string,
    data: {
      nombre?: string;
      areaId?: string | number;
      orden?: number;
      llevaOpciones?: boolean;
      oculta?: boolean;
    },
  ): Promise<CategoriaAdmin> {
    return api.patch<CategoriaAdmin>(`/admin/catalogo/categorias/${id}`, data);
  },

  async ocultarCategoria(id: string): Promise<{ ok: boolean; id: string; oculta: boolean }> {
    return api.post(`/admin/catalogo/categorias/${id}/ocultar`);
  },

  async mostrarCategoria(id: string): Promise<{ ok: boolean; id: string; oculta: boolean }> {
    return api.post(`/admin/catalogo/categorias/${id}/mostrar`);
  },

  // Listas y valores
  async listarListas(): Promise<ListaAdmin[]> {
    return api.get<ListaAdmin[]>('/admin/catalogo/listas');
  },

  async crearLista(data: { nombre: string; codigo?: string }): Promise<ListaAdmin> {
    return api.post<ListaAdmin>('/admin/catalogo/listas', data);
  },

  async actualizarLista(
    id: string,
    data: { nombre?: string; codigo?: string },
  ): Promise<ListaAdmin> {
    return api.patch<ListaAdmin>(`/admin/catalogo/listas/${id}`, data);
  },

  async agregarValor(
    listaId: string,
    data: { nombre: string; orden?: number; activo?: boolean },
  ): Promise<ValorListaAdmin> {
    return api.post<ValorListaAdmin>(`/admin/catalogo/listas/${listaId}/valores`, data);
  },

  async actualizarValor(
    id: string,
    data: { nombre?: string; orden?: number; activo?: boolean },
  ): Promise<ValorListaAdmin> {
    return api.patch<ValorListaAdmin>(`/admin/catalogo/valores/${id}`, data);
  },

  async alternarValor(id: string): Promise<{ ok: boolean; id: string; activo: boolean }> {
    return api.post(`/admin/catalogo/valores/${id}/alternar`);
  },

  // Grupos de opciones
  async listarGrupos(): Promise<GrupoOpcionItem[]> {
    return api.get<GrupoOpcionItem[]>('/admin/catalogo/grupos');
  },

  async crearGrupo(data: {
    nombre: string;
    listaId?: string | number;
    obligatorio?: boolean;
    minimo?: number;
    maximo?: number;
    activo?: boolean;
  }): Promise<GrupoOpcionItem> {
    return api.post<GrupoOpcionItem>('/admin/catalogo/grupos', data);
  },

  async actualizarGrupo(
    id: string,
    data: {
      nombre?: string;
      listaId?: string | number;
      obligatorio?: boolean;
      minimo?: number;
      maximo?: number;
      activo?: boolean;
    },
  ): Promise<GrupoOpcionItem> {
    return api.patch<GrupoOpcionItem>(`/admin/catalogo/grupos/${id}`, data);
  },

  /** Stock que consume cada opción (opcion_requiere): requisitos actuales y productos que se pueden enlazar. */
  async requisitosOpcion(opcionId: string): Promise<RequisitosOpcionAdmin> {
    return api.get<RequisitosOpcionAdmin>(`/admin/catalogo/opciones/${opcionId}/requisitos`);
  },

  async guardarRequisitosOpcion(
    opcionId: string,
    requisitos: Array<{ productoId: string; saborId: string | null; cantidad: number }>,
  ): Promise<RequisitosOpcionAdmin> {
    return api.put<RequisitosOpcionAdmin>(`/admin/catalogo/opciones/${opcionId}/requisitos`, { requisitos });
  },

  async crearOpcion(
    grupoId: string,
    data: { nombre: string; precioExtra?: number },
  ): Promise<OpcionItem> {
    return api.post<OpcionItem>(`/admin/catalogo/grupos/${grupoId}/opciones`, data);
  },

  async editarOpcion(
    id: string,
    data: { nombre?: string; precioExtra?: number; activo?: boolean },
  ): Promise<OpcionItem> {
    return api.patch<OpcionItem>(`/admin/catalogo/opciones/${id}`, data);
  },

  async asignarGrupoCategorias(
    id: string,
    categoriaIds: (string | number)[],
  ): Promise<{ ok: boolean; grupoId: string; categoriaIds: string[] }> {
    return api.post(`/admin/catalogo/grupos/${id}/categorias`, { categoriaIds });
  },

  // Archivos (subida de imágenes)
  async subirFoto(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('archivo', file);
    return clienteFetch<{ id: string; url: string }>('/admin/archivos', {
      method: 'POST',
      body: formData,
    });
  },
};
