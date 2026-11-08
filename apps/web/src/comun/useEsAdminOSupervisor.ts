import { useSesion } from './sesion';
import { tieneRolUsuario } from './rolesUsuario';

/** true si el usuario es ADMIN (como principal) o SUPERVISOR (principal o rol extra vigente). Sin sesión: false. */
export function useEsAdminOSupervisor(): boolean {
  try {
    const { usuario } = useSesion();
    return usuario?.rol?.toUpperCase() === 'ADMIN' || tieneRolUsuario(usuario, 'SUPERVISOR');
  } catch {
    return false;
  }
}
