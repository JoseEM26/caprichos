import { useSesion } from './sesion';
import { requiereCodigo } from './autorizacionSupervisor';

/** true si la vista debe mostrar el código del supervisor. Sin sesión (pruebas sueltas) lo pide, como antes. */
export function usePideCodigo(): boolean {
  let usuario: { rol?: string } | null | undefined;
  try {
    usuario = useSesion().usuario;
  } catch {
    return true;
  }
  return requiereCodigo(usuario);
}
