/**
 * Marca «Boleta por defecto» (funciones puras, sin base ni red).
 * Solo sugiere la boleta como valor inicial del selector del mozo y de Caja. Nunca sustituye a elegir:
 * el servidor exige boleta o factura en todo pedido.
 */

/** Parámetro (si/no) de la marca «Boleta electrónica por defecto». Sin valor guardado: sí. */
export const CLAVE_BOLETA_DEFECTO = 'facturacion_boleta_por_defecto';

/** La marca sugiere boleta con SUNAT real (proveedor efectivo). En simulado no cambia nada. */
export function aplicaBoletaPorDefecto(proveedorEfectivo: string, activo: boolean): boolean {
  return activo && proveedorEfectivo === 'SUNAT';
}
