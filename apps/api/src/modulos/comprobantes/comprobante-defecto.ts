/**
 * Comprobante por defecto (funciones puras, sin base ni red).
 * Un pedido sin tipo elegido sale como boleta electrónica solo cuando el proveedor real es SUNAT;
 * en simulado sale como nota de venta para no gastar números de la serie B002.
 */

/** Parámetro (si/no) de la marca «Boleta electrónica por defecto». Sin valor guardado: sí. */
export const CLAVE_BOLETA_DEFECTO = 'facturacion_boleta_por_defecto';

export type TipoComprobanteEfectivo = 'NOTA_VENTA' | 'BOLETA' | 'FACTURA';

/** La marca solo aplica con SUNAT real (proveedor efectivo). En simulado no cambia nada. */
export function aplicaBoletaPorDefecto(proveedorEfectivo: string, activo: boolean): boolean {
  return activo && proveedorEfectivo === 'SUNAT';
}

/**
 * Tipo que sale un pedido: el elegido; si no hay ninguno, boleta cuando aplica la marca
 * o nota de venta en caso contrario. Único punto donde se decide el tipo por defecto.
 */
export function tipoComprobanteEfectivo(tipoElegido: string | null | undefined, aplicaDefecto: boolean): TipoComprobanteEfectivo {
  const t = (tipoElegido ?? '').trim().toUpperCase();
  if (t === 'BOLETA' || t === 'FACTURA' || t === 'NOTA_VENTA') return t;
  return aplicaDefecto ? 'BOLETA' : 'NOTA_VENTA';
}
