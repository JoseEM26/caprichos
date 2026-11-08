import { useSesion } from './sesion';
import { tieneRolUsuario } from './rolesUsuario';

/**
 * true si el usuario anula con alcance limitado por su rol (COCINA, MOZO): solo lo suyo y antes de que salga de cocina.
 * Si además es CAJERO, ADMIN o SUPERVISOR, manda el rol más amplio. Sin sesión: false.
 */
export function useAnulaConAlcanceLimitado(): boolean {
  try {
    const { usuario } = useSesion();
    if (!usuario) return false;
    const tiene = (r: string) => usuario.rol?.toUpperCase() === r || tieneRolUsuario(usuario, r);
    return (tiene('COCINA') || tiene('MOZO')) && !(tiene('ADMIN') || tiene('CAJERO') || tiene('SUPERVISOR'));
  } catch {
    return false;
  }
}
