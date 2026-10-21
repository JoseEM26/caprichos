// Contrato compartido de la ola 1: lo importan acceso, usuarios y configuración.
export interface UsuarioAutenticado {
  partyId: bigint;
  rol: string; // ADMIN | CAJERO | COCINA | MOZO | CALLCENTER | ALMACEN | REPARTIDOR
  debeCambiar: boolean;
}

export interface SolicitudAutenticada {
  usuario?: UsuarioAutenticado;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
