import { tieneRolUsuario } from './rolesUsuario';
/** Autorización del supervisor: un código válido vale 5 min en el servidor; aquí se recuerda para no pedirlo de nuevo. */
const VIGENCIA_MS = 5 * 60 * 1000;
let hasta = 0;

export const hayAutorizacionSupervisor = () => Date.now() < hasta;
export const marcarAutorizacionSupervisor = () => {
  hasta = Date.now() + VIGENCIA_MS;
};
export const limpiarAutorizacionSupervisor = () => {
  hasta = 0;
};

/** El ADMIN y el SUPERVISOR nunca piden el código: se autorizan solos (el servidor lo deja pasar igual y audita a su nombre). */
export function requiereCodigo(usuario?: { rol?: string; roles?: string[] } | null): boolean {
  // ADMIN solo como principal; SUPERVISOR como principal o como rol extra
  return !(usuario?.rol?.toUpperCase() === 'ADMIN' || tieneRolUsuario(usuario, 'SUPERVISOR'));
}

/** COCINA y MOZO anulan un pedido sin código (regla de su rol); si además es CAJERO, ADMIN o SUPERVISOR, manda el rol más alto. */
export function anulaPedidoSinCodigo(usuario?: { rol?: string; roles?: string[] } | null): boolean {
  if (!usuario) return false;
  const tiene = (r: string) => usuario.rol?.toUpperCase() === r || tieneRolUsuario(usuario, r);
  return (tiene('COCINA') || tiene('MOZO')) && !(tiene('ADMIN') || tiene('CAJERO') || tiene('SUPERVISOR'));
}
