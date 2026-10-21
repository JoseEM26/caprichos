import { SetMetadata } from '@nestjs/common';

export const CLAVE_PERMISO = 'permiso';
export const CLAVE_SOLO_CAMBIO_CLAVE = 'solo_cambio_clave';

/** Exige que el rol del usuario tenga el permiso modulo/accion en rol_permiso (ADR-008). */
export const Permiso = (modulo: string, accion: string) => SetMetadata(CLAVE_PERMISO, { modulo, accion });

/** Ruta que puede usar quien aún debe cambiar la contraseña (primer ingreso). Basta estar autenticado. */
export const SoloCambioClave = () => SetMetadata(CLAVE_SOLO_CAMBIO_CLAVE, true);
