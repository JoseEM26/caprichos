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

/** El ADMIN nunca pide el código del supervisor: sería él mismo aprobándose (el servidor lo deja pasar igual). */
export function requiereCodigo(usuario?: { rol?: string } | null): boolean {
  return (usuario?.rol ?? '').toUpperCase() !== 'ADMIN';
}
