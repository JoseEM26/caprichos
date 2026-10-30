import { SetMetadata } from '@nestjs/common';

export const CLAVE_PERMISO = 'permiso';
export const CLAVE_SOLO_CAMBIO_CLAVE = 'solo_cambio_clave';

export interface PermisoRequerido {
  modulo: string;
  accion: string;
}

/** Exige que el rol del usuario tenga el permiso modulo/accion (o al menos uno si se pasa lista) en rol_permiso (ADR-008). */
export function Permiso(modulo: string, accion: string): MethodDecorator & ClassDecorator;
export function Permiso(permisos: PermisoRequerido[]): MethodDecorator & ClassDecorator;
export function Permiso(
  moduloOPermisos: string | PermisoRequerido[],
  accion?: string,
): MethodDecorator & ClassDecorator {
  if (Array.isArray(moduloOPermisos)) {
    return SetMetadata(CLAVE_PERMISO, moduloOPermisos);
  }
  return SetMetadata(CLAVE_PERMISO, { modulo: moduloOPermisos, accion: accion! });
}

/** Ruta que puede usar quien aún debe cambiar la contraseña (primer ingreso). Basta estar autenticado. */
export const SoloCambioClave = () => SetMetadata(CLAVE_SOLO_CAMBIO_CLAVE, true);

