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
export function requiereCodigo(usuario?: { rol?: string } | null): boolean {
  return !['ADMIN', 'SUPERVISOR'].includes((usuario?.rol ?? '').toUpperCase());
}
