import { api } from '../../comun/api';
import type {
  ClienteItem,
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
  pagina?: number;
  limite?: number;
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

export async function listarClientes(filtros: FiltrosClientes = {}): Promise<RespuestaListaClientes> {
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

  const query = params.toString();
  return api.get<RespuestaListaClientes>(`/admin/clientes${query ? `?${query}` : ''}`);
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
