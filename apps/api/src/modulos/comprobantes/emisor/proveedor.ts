import { Proveedor } from './emisor.tipos';

/** Clave del parámetro que elige el proveedor de facturación. */
export const CLAVE_PROVEEDOR = 'facturacion_proveedor';

/** Valor del parámetro; cualquier valor desconocido o ausente es SIMULADO (nunca hace red). */
export function proveedorDe(valor: unknown): Proveedor {
  return valor === 'SUNAT' ? valor : 'SIMULADO';
}

/** Credenciales de SUNAT presentes en el entorno (sin leer sus valores). */
export function sunatCredencialesPresentes(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SUNAT_SOL_USUARIO && env.SUNAT_SOL_CLAVE && env.SUNAT_CERT_P12_B64 && env.SUNAT_CERT_CLAVE);
}
