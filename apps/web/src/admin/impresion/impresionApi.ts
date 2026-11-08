import { api, getTokenAcceso } from '../../comun/api';
import type { ConfigEquipoImpresion, TamanoEtiquetaPc } from '@caprichos/compartido';
import { EstadoAdminImpresion, EstadoImpresora, RolImpresora } from '@caprichos/compartido';

export interface TrabajoImpresionAdmin {
  id: string;
  /** NULL en las pruebas de impresión (no tienen pedido). */
  pedidoId: string | null;
  /** Área cuya computadora lo imprime; null = Caja. */
  destinoAreaId?: string | null;
  pedidoCodigo: string;
  clienteNombre: string;
  tipo: string;
  estado: string;
  intentos: number;
  error?: string | null;
  copia: boolean;
  en: string;
  tomadoEn?: string | null;
  impresoEn?: string | null;
  payload: any;
  /** Máquina que lo imprime: stickers = ETIQUETERA, tickets = TICKETERA. */
  maquina?: 'ETIQUETERA' | 'TICKETERA';
  /** PC/equipo que lo imprime o imprimió (Caja si no hay otro). */
  equipoNombre?: string;
}

export interface RespuestaReimpresion {
  ok: boolean;
  creados: number;
  rechazados: Array<{ id: string; motivo: string }>;
  trabajoIds: string[];
  mensaje: string;
}

/** Estado visible de una etiqueta del pedido, derivado de su último print_job. */
/** DESCONOCIDO solo en la vista: la consulta de estado aún no llegó o falló. */
export type EstadoEtiqueta = 'EN_COLA' | 'IMPRIMIENDO' | 'IMPRESA' | 'FALLIDA' | 'VENCIDA' | 'DESCARTADA' | 'SIN_TRABAJO' | 'DESCONOCIDO';

export interface EtiquetaEstado {
  /** GENERAL, AREA:<nombre> o BEBIDA:<indice>: identifica la etiqueta dentro del pedido */
  clave: string;
  tipo: 'ETIQUETA_GENERAL' | 'ETIQUETA_AREA' | 'ETIQUETA_BEBIDA';
  titulo: string;
  detalle: string;
  estado: EstadoEtiqueta;
  trabajoId: string | null;
  intentos: number;
  error: string | null;
  copia: boolean;
  en: string | null;
  impresoEn: string | null;
}

export interface EstadoEtiquetasPedido {
  pedidoId: string;
  codigo: string;
  /** Medida de los stickers en mm (parámetros del sistema), para la vista previa */
  tamanos?: { bebida: { anchoMm: number; altoMm: number }; general: { anchoMm: number; altoMm: number } };
  etiquetas: EtiquetaEstado[];
  resumen: {
    total: number;
    impresas: number;
    enCola: number;
    fallidas: number;
    vencidas: number;
    sinTrabajo: number;
  };
}

export interface GrupoCola {
  /** NULL en las pruebas de impresión: cada prueba es su propio grupo. */
  pedidoId: string | null;
  esPrueba: boolean;
  pedidoCodigo: string;
  clienteNombre: string;
  cantidad: number;
  /** conteo por estado técnico: PENDIENTE, IMPRIMIENDO, IMPRESO, FALLIDO, VENCIDO, DESCARTADO */
  estados: Record<string, number>;
  masAntiguaEn: string;
  error: string | null;
  trabajoIds: string[];
}

export interface RespuestaCola {
  items: GrupoCola[];
  total: number;
  pagina: number;
  paginas: number;
  resumen: {
    pendientes: number;
    enCurso: number;
    fallidos: number;
    vencidos: number;
    descartados: number;
    pendientesAntiguas: number;
    minutosAntiguas: number;
  };
}

export type FiltroCola = 'pendientes' | 'en_curso' | 'impresos' | 'fallidos' | 'vencidos' | 'descartados';

export interface LlaveAgenteAdmin {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
  ultimoLatido?: string | null;
  version?: string | null;
  impresora?: EstadoImpresora | null;
  llaveMuestra: string;
}

export interface RespuestaCrearLlave {
  id: string;
  nombre: string;
  llave: string;
  creadoEn: string;
  mensaje: string;
}

/** Contrato de GET /admin/impresion/mapa (ver apps/api/src/modulos/impresion/impresion-config.service.ts). */
export type RolEquipoMapa = 'ETIQUETERA' | 'TICKETERA';
export type EstadoRolMapa = 'lista' | 'sin_papel' | 'desconectada' | 'sin_permiso' | 'error' | 'no_configurada' | 'sin_programa';

export interface EquipoMapa {
  deviceKeyId: string;
  nombre: string;
  /** null = Caja */
  areaId: string | null;
  /** Máquinas que declara el programa (las que usa el ruteo), aunque el programa esté caído. */
  maquinas: RolEquipoMapa[];
  roles: Array<{ rol: RolEquipoMapa; estado: EstadoRolMapa }>;
  ultimoLatido: string | null;
  conectado: boolean;
}

export interface ReglasMapa {
  generalModalidades: string[];
  areaModalidades: string[];
  bebidaModalidades: string[];
  bebidaActivo: boolean;
  areaActivo: boolean;
  comandaSalonActivo: boolean;
  comandaAreaActivo: boolean;
}

export type TipoRuteoMapa =
  | 'ETIQUETA_GENERAL'
  | 'ETIQUETA_AREA'
  | 'ETIQUETA_BEBIDA'
  | 'TICKET_COMANDA_SALON'
  | 'TICKET_COMANDA_AREA'
  | 'TICKET_PAGO';

export interface RuteoMapa {
  tipo: TipoRuteoMapa;
  /** Área del trabajo (sticker por área o de bebida); null en general, comanda y pago. */
  areaId: string | null;
  /** Área cuyo equipo lo imprime; null = Caja. */
  destinoAreaId: string | null;
  destinoEquipoId: string | null;
  destinoNombre: string;
  activo: boolean;
}

export interface AreaMapa {
  id: string;
  nombre: string;
  /** Equipo que declara cada máquina dentro de esta área (deviceKeyId), o null si ninguno. */
  equiposPorRol: Record<RolEquipoMapa, string | null>;
}

/** Grupo de equipos que chocan (más de uno para la misma área y máquina, o en Caja): hay que dejar uno. */
export interface GrupoDuplicadoMapa {
  /** null = Caja */
  areaId: string | null;
  nombre: string;
  equipos: Array<{ deviceKeyId: string; nombre: string }>;
}

export interface MapaImpresionDatos {
  duplicados: GrupoDuplicadoMapa[];
  areas: AreaMapa[];
  equipos: EquipoMapa[];
  reglas: ReglasMapa;
  ruteo: RuteoMapa[];
  colaPendientePorEquipo: Array<{ deviceKeyId: string; pendientes: number }>;
}

/** Cambio parcial de la configuración de una PC; null en un tamaño = hereda el del local. */
export type CambioConfigEquipo = Partial<Omit<ConfigEquipoImpresion, 'configurado'>> & {
  nombre?: string;
  impresoras?: Partial<Record<RolImpresora, string | null>>;
};

export interface RespuestaAsignarArea {
  ok: boolean;
  areaId: string | null;
  avisos: string[];
}

export const impresionApi = {
  obtenerMapa: async (): Promise<MapaImpresionDatos> => {
    return api.get<MapaImpresionDatos>('/admin/impresion/mapa');
  },

  /**
   * areaId null = Caja. Si el destino ya tiene equipo con esa máquina, responde 409 AREA_OCUPADA
   * (err.codigo) con err.detalles.ocupadoPor; con reemplazar: true lo desactiva y asigna este.
   */
  asignarAreaEquipo: async (equipoId: string, areaId: string | null, reemplazar = false): Promise<RespuestaAsignarArea> => {
    const cuerpo = reemplazar ? { areaId, reemplazar: true } : { areaId };
    return api.put<RespuestaAsignarArea>(`/admin/impresion/equipos/${equipoId}/area`, cuerpo);
  },

  /** El equipo viejo cede su área al nuevo, y el viejo se desactiva. */
  reemplazarEquipo: async (viejoId: string, porEquipoId: string): Promise<{ ok: boolean; reemplazados: string[] }> => {
    return api.post(`/admin/impresion/equipos/${viejoId}/reemplazar`, { porEquipoId });
  },

  /** Deja solo este equipo en su área (o en Caja): desactiva los duplicados. */
  quedarseCon: async (equipoId: string): Promise<{ ok: boolean; desactivados: string[] }> => {
    return api.post(`/admin/impresion/equipos/${equipoId}/quedarse`, {});
  },

  guardarReglasImpresion: async (cambio: Partial<ReglasMapa>): Promise<{ ok: boolean; reglas: ReglasMapa }> => {
    return api.put<{ ok: boolean; reglas: ReglasMapa }>('/admin/impresion/reglas', cambio);
  },

  /** Vuelve las reglas a lo recomendado (defectos del servidor); solo con permiso de editar. */
  restablecerReglasImpresion: async (): Promise<{ ok: boolean; reglas: ReglasMapa }> => {
    return api.post<{ ok: boolean; reglas: ReglasMapa }>('/admin/impresion/reglas/restablecer', {});
  },

  /** Código de un solo uso (15 min) para vincular el programa del local; solo ADMIN. */
  generarCodigoVinculo: async (): Promise<{ codigo: string; expiraEn: string }> => {
    return api.post('/admin/impresion/codigo-vinculo', {});
  },

  /** Crea el equipo y descarga el ZIP con el programa ya vinculado (lleva una llave secreta); solo ADMIN. */
  descargarProgramaVinculado: async (nombre?: string): Promise<Blob> => {
    const token = getTokenAcceso();
    const res = await fetch('/admin/impresion/equipos/descarga-vinculada', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(nombre?.trim() ? { nombre: nombre.trim() } : {}),
    });
    if (!res.ok) {
      const cuerpo: any = await res.json().catch(() => ({}));
      throw new Error(cuerpo?.mensaje || `No se pudo preparar la descarga (HTTP ${res.status})`);
    }
    return res.blob();
  },

  obtenerEstado: async (): Promise<EstadoAdminImpresion> => {
    return api.get<EstadoAdminImpresion>('/admin/impresion/estado');
  },

  listarTrabajos: async (filtros?: {
    estado?: string;
    pedido?: string;
    pagina?: number;
    limite?: number;
    maquina?: 'ETIQUETERA' | 'TICKETERA';
  }): Promise<{ items: TrabajoImpresionAdmin[]; total: number; pagina: number; paginas: number; conteo?: { stickers: number; tickets: number } }> => {
    const params = new URLSearchParams();
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.pedido) params.set('pedido', filtros.pedido);
    if (filtros?.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros?.limite) params.set('limite', String(filtros.limite));
    if (filtros?.maquina) params.set('maquina', filtros.maquina);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api.get(`/admin/impresion/trabajos${qs}`);
  },

  /** Prueba de impresión: una etiqueta o un ticket de ejemplo, sin pedido real. */
  pruebaImpresion: async (
    rol: RolImpresora,
    impresoraId?: string,
    equipoId?: string,
  ): Promise<{ ok: boolean; trabajoId: string; mensaje: string }> => {
    return api.post('/admin/impresion/prueba', { rol, ...(impresoraId ? { impresoraId } : {}), ...(equipoId ? { equipoId } : {}) });
  },

  /** «Probar TODAS»: una hoja con número en cada impresora de esa computadora. */
  pruebaTodas: async (
    equipoId?: string,
  ): Promise<{ ok: boolean; total: number; trabajos: { trabajoId: string; impresoraId: string; rol: RolImpresora }[]; mensaje: string }> => {
    return api.post('/admin/impresion/prueba-todas', equipoId ? { equipoId } : {});
  },

  /** «Usar esta impresora»: queda guardada en el programa de esa computadora. */
  elegirImpresora: async (
    rol: RolImpresora,
    impresoraId: string,
    equipoId?: string,
  ): Promise<{ ok: boolean; mensaje: string }> => {
    return api.post('/admin/impresion/seleccion', { rol, impresoraId, ...(equipoId ? { equipoId } : {}) });
  },

  estadoPrueba: async (
    id: string,
  ): Promise<{ id: string; rol: RolImpresora; estado: string; intentos: number; error: string | null }> => {
    return api.get(`/admin/impresion/prueba/${id}`);
  },

  descartarTrabajo: async (id: string): Promise<{ ok: boolean; descartadas: number; mensaje: string }> => {
    return api.post(`/admin/impresion/trabajos/${id}/descartar`, {});
  },

  /** Copia nueva (misma máquina) de uno o varios trabajos, o de todos los fallidos de una máquina. */
  reimprimirTrabajos: async (body: { ids?: string[]; grupo?: 'STICKERS_FALLIDOS' | 'TICKETS_FALLIDOS' }): Promise<RespuestaReimpresion> => {
    return api.post('/admin/impresion/cola/reimprimir', body);
  },

  /** Qué imprime una PC (cambio parcial: nombre, máquinas, interruptores, áreas, tamaños, impresoras, pausa). La deja «configurada». */
  guardarConfigEquipo: async (equipoId: string, cambio: CambioConfigEquipo): Promise<{ ok: boolean; config: ConfigEquipoImpresion }> => {
    return api.put(`/admin/impresion/equipos/${equipoId}/config`, cambio);
  },

  /** «Usar lo general»: rellena la PC con las reglas del local. */
  usarGeneralEquipo: async (equipoId: string): Promise<{ ok: boolean; config: ConfigEquipoImpresion }> => {
    return api.post(`/admin/impresion/equipos/${equipoId}/usar-general`, {});
  },

  /** «Imprimir prueba con este tamaño»: sticker de ejemplo (general o de bebida) en esa PC. */
  pruebaEtiquetaEquipo: async (
    equipoId: string,
    tipo: 'general' | 'bebida',
    tamano?: TamanoEtiquetaPc | null,
  ): Promise<{ ok: boolean; trabajoId: string; mensaje: string }> => {
    return api.post(`/admin/impresion/equipos/${equipoId}/prueba-etiqueta`, { tipo, ...(tamano ? { tamano } : {}) });
  },

  reintentarTrabajo: async (id: string): Promise<{ ok: boolean; mensaje: string }> => {
    return api.post(`/admin/impresion/trabajos/${id}/reintentar`);
  },

  reimprimirEtiquetas: async (
    pedidoId: string,
    tipo: 'general' | 'area' | 'bebida',
    areaId?: string,
    indice?: number,
  ): Promise<{ ok: boolean; mensaje: string; cantidad?: number }> => {
    return api.post(`/admin/pedidos/${pedidoId}/etiquetas/reimprimir`, {
      tipo,
      area_id: areaId,
      indice,
    });
  },

  obtenerEtiquetasPedido: async (pedidoId: string): Promise<EstadoEtiquetasPedido> => {
    return api.get<EstadoEtiquetasPedido>(`/admin/pedidos/${pedidoId}/etiquetas-estado`);
  },

  /** Reencola solo una etiqueta (clave GENERAL, AREA:<nombre> o BEBIDA:<indice>). */
  reimprimirEtiqueta: async (
    pedidoId: string,
    clave: string,
  ): Promise<{ ok: boolean; mensaje: string; cantidad?: number; omitidas?: number }> => {
    const tipo = clave.startsWith('AREA:') ? 'area' : clave.startsWith('BEBIDA:') ? 'bebida' : 'general';
    return api.post(`/admin/pedidos/${pedidoId}/etiquetas/reimprimir`, { tipo, clave });
  },

  /** Reencola todas las etiquetas del pedido que no estén ya en cola. */
  reimprimirTodas: async (
    pedidoId: string,
  ): Promise<{ ok: boolean; mensaje: string; cantidad?: number; omitidas?: number }> => {
    return api.post(`/admin/pedidos/${pedidoId}/etiquetas/reimprimir`, { tipo: 'TODAS' });
  },

  listarCola: async (filtro: FiltroCola, pagina = 1, minutos = 30): Promise<RespuestaCola> => {
    return api.get<RespuestaCola>(`/admin/impresion/cola?filtro=${filtro}&pagina=${pagina}&limite=20&minutos=${minutos}`);
  },

  vaciarCola: async (body: {
    alcance: 'ANTIGUAS' | 'TODAS';
    minutos?: number;
    motivo: string;
  }): Promise<{ ok: boolean; descartadas: number; mensaje: string }> => {
    return api.post('/admin/impresion/cola/vaciar', body);
  },

  descartarPedido: async (pedidoId: string): Promise<{ ok: boolean; descartadas: number; mensaje: string }> => {
    return api.post(`/admin/impresion/pedidos/${pedidoId}/descartar`, {});
  },

  listarLlaves: async (): Promise<LlaveAgenteAdmin[]> => {
    return api.get<LlaveAgenteAdmin[]>('/admin/impresion/llaves');
  },

  crearLlave: async (nombre?: string): Promise<RespuestaCrearLlave> => {
    return api.post<RespuestaCrearLlave>('/admin/impresion/llaves', { nombre });
  },

  desactivarLlave: async (id: string): Promise<{ ok: boolean; mensaje: string }> => {
    return api.patch<{ ok: boolean; mensaje: string }>(`/admin/impresion/llaves/${id}/desactivar`);
  },
};
