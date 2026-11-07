// Contrato compartido de la ola 1: lo importan acceso, usuarios y configuración.
export interface UsuarioAutenticado {
  partyId: bigint;
  rol: string; // ADMIN | CAJERO | COCINA | MOZO | ALMACEN | REPARTIDOR | SUPERVISOR (principal)
  debeCambiar: boolean;
  /** Principal primero, luego los extra (user_account_rol). Lo llena AccesoGuard; sin él vale solo `rol`. */
  roles?: string[];
}

export interface SolicitudAutenticada {
  usuario?: UsuarioAutenticado;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
