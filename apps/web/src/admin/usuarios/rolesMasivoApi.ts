import { api } from '../../comun/api';

export interface ResultadoRolesMasivo {
  accion: 'agregar' | 'quitar';
  rol: string;
  agregados: number;
  quitados: number;
  yaTenian: number;
  omitidos: Array<{ usuario: string; usuarioId: string; motivo: string }>;
}

export function aplicarRolesMasivo(datos: {
  usuarioIds: string[] | 'todos';
  rol: string;
  accion: 'agregar' | 'quitar';
  soloActivos?: boolean;
}): Promise<ResultadoRolesMasivo> {
  return api.post<ResultadoRolesMasivo>('/admin/usuarios/roles-masivo', datos);
}
