import { api, obtenerBlobAutenticado } from '../../comun/api';
import type {
  ClienteItem,
  DetalleCompraCliente,
  PedidoCliente,
  FichaCliente,
  MovimientoPuntosItem,
} from './tipos';

export interface FiltrosClientes {
  q?: string;
  tipo?: string;
  estado?: string;
  creditoPersonal?: string;
  verificacion?: 'verificados' | 'sin_verificar' | 'todos';
  gastaPuntos?: boolean;
  /** Rango de los pedidos que se cuentan: hoy, semana, mes o siempre (sin rango) */
  periodo?: 'hoy' | 'semana' | 'mes' | 'siempre';
  /** Rango propio, AAAA-MM-DD (día de Lima); manda sobre «periodo» */
  desde?: string;
  hasta?: string;
  pedidosMin?: number;
  pedidosMax?: number;
  consumoMin?: number;
  consumoMax?: number;
  puntosMin?: number;
  puntosMax?: number;
  conPuntos?: 'si' | 'no';
  /** Clientes dormidos: última compra hace más de N días */
  sinCompraDias?: number;
  cumpleMes?: boolean;
  canal?: 'CARTA' | 'WHATSAPP' | 'CAJA' | 'MOZO';
  orden?: 'reciente' | 'pedidos' | 'consumo' | 'puntos' | 'ultima' | 'nombre';
  pagina?: number;
  limite?: number;
}

export interface ParticipanteSorteoApi {
  id: string;
  nombre: string;
  detalle: string;
}

export interface RespuestaListaClientes {
  items: ClienteItem[];
  total: number;
  pagina: number;
  paginas: number;
  contadores?: { verificados: number; sinVerificar: number; gastanPuntos: number };
}

export interface RegistrarClienteMostradorDto {
  nombre: string;
  /** Persona: celular obligatorio (9 dígitos) */
  telefono?: string;
  /** Empresa: RUC de 11 dígitos */
  ruc?: string;
  correo?: string;
  cumpleanos?: string;
  aceptaDatos: boolean;
}

export interface EditarClienteDto {
  nombre?: string;
  telefono?: string;
  correo?: string;
  cumpleanos?: string;
  envioFijo?: number | null;
  descuentoEnvio?: number | null;
}

export interface AjustarPuntosDto {
  puntos: number;
  motivo: string;
  tipo?: 'SUMA' | 'REVERSA' | 'CANJE';
}

/** Los mismos parámetros para el listado, la exportación a Excel y los participantes del sorteo. */
export function paramsClientes(filtros: FiltrosClientes = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q);
  if (filtros.tipo && filtros.tipo !== 'Todos') params.set('tipo', filtros.tipo);
  if (filtros.estado && filtros.estado !== 'Todos') {
    params.set('estado', filtros.estado === 'Activos' ? 'activos' : 'inactivos');
  }
  if (filtros.creditoPersonal && filtros.creditoPersonal !== 'Todos') {
    params.set('creditoPersonal', filtros.creditoPersonal === 'Sí' ? 'true' : 'false');
  }
  if (filtros.verificacion && filtros.verificacion !== 'todos') params.set('verificacion', filtros.verificacion);
  if (filtros.gastaPuntos) params.set('gastaPuntos', 'si');
  if (filtros.pagina) params.set('pagina', String(filtros.pagina));
  if (filtros.limite) params.set('limite', String(filtros.limite));
  if (filtros.periodo && filtros.periodo !== 'siempre' && !filtros.desde && !filtros.hasta) params.set('periodo', filtros.periodo);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  const numeros = ['pedidosMin', 'pedidosMax', 'consumoMin', 'consumoMax', 'puntosMin', 'puntosMax', 'sinCompraDias'] as const;
  for (const k of numeros) if (filtros[k] !== undefined && Number.isFinite(filtros[k])) params.set(k, String(filtros[k]));
  if (filtros.conPuntos) params.set('conPuntos', filtros.conPuntos);
  if (filtros.cumpleMes) params.set('cumpleMes', 'si');
  if (filtros.canal) params.set('canal', filtros.canal);
  if (filtros.orden && filtros.orden !== 'reciente') params.set('orden', filtros.orden);
  return params;
}

export async function listarClientes(filtros: FiltrosClientes = {}): Promise<RespuestaListaClientes> {
  const query = paramsClientes(filtros).toString();
  return api.get<RespuestaListaClientes>(`/admin/clientes${query ? `?${query}` : ''}`);
}

/** Participantes del sorteo en vivo: todos los que cumplen los filtros (sin paginar), solo nombre corto y 3 dígitos. */
export async function listarParticipantesSorteo(filtros: FiltrosClientes = {}): Promise<{ total: number; participantes: ParticipanteSorteoApi[] }> {
  const p = paramsClientes({ ...filtros, pagina: undefined, limite: undefined });
  const query = p.toString();
  return api.get(`/admin/clientes/participantes${query ? `?${query}` : ''}`);
}

/** Descarga el Excel de TODA la lista filtrada (solo ADMIN). Devuelve un enlace temporal al archivo. */
export async function exportarClientesExcel(filtros: FiltrosClientes = {}): Promise<string> {
  const p = paramsClientes({ ...filtros, pagina: undefined, limite: undefined });
  p.set('_t', String(Date.now())); // que no se reutilice una descarga anterior
  return obtenerBlobAutenticado(`/admin/clientes/exportar?${p.toString()}`);
}

export async function obtenerFichaCliente(id: string): Promise<FichaCliente> {
  return api.get<FichaCliente>(`/admin/clientes/${id}`);
}

export async function registrarClienteMostrador(dto: RegistrarClienteMostradorDto): Promise<{ ok: boolean; partyId: string }> {
  return api.post<{ ok: boolean; partyId: string }>('/admin/clientes', dto);
}

export async function editarCliente(id: string, dto: EditarClienteDto): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/admin/clientes/${id}`, dto);
}

export async function cambiarEstadoCliente(id: string, activo: boolean): Promise<{ ok: boolean; activo: boolean }> {
  return api.patch<{ ok: boolean; activo: boolean }>(`/admin/clientes/${id}/estado`, { activo });
}

export async function ajustarPuntos(id: string, dto: AjustarPuntosDto): Promise<{ puntos: number; nuevoSaldo: number }> {
  return api.post<{ puntos: number; nuevoSaldo: number }>(`/admin/clientes/${id}/ajustar-puntos`, dto);
}

export async function listarHistorialPuntos(id: string): Promise<MovimientoPuntosItem[]> {
  return api.get<MovimientoPuntosItem[]>(`/admin/clientes/${id}/puntos-historial`);
}

/** Compras del cliente, paginadas (la ficha trae la primera página de 20). */
export async function listarComprasCliente(id: string, pagina: number, limite = 20): Promise<{ pagina: number; hayMas: boolean; pedidos: PedidoCliente[] }> {
  return api.get(`/admin/clientes/${id}/pedidos?pagina=${pagina}&limite=${limite}`);
}

/** Qué pidió en una compra: líneas, descuentos, envío, propina, pago y comprobante. */
export async function obtenerDetalleCompra(id: string, pedidoId: string): Promise<DetalleCompraCliente> {
  return api.get<DetalleCompraCliente>(`/admin/clientes/${id}/pedidos/${pedidoId}`);
}
