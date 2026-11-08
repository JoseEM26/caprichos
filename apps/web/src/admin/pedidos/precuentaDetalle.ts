import { entradaDeLineaPedido } from '@caprichos/compartido';
import type { LineaPrecuenta } from '../salon/componentes/ModalPrecuenta';
import type { LineaPedido, Pedido } from './pedidosApi';

/** Las piezas de un combo son líneas hijas: la cuenta solo cuenta la madre (las hijas salen dentro de ella). */
export const lineasDeCuenta = (lineas: LineaPedido[]): LineaPedido[] => lineas.filter((l) => l.linea_combo_id == null);

/** Líneas de la precuenta con el detalle completo, el mismo que imprime el ticket de pago. */
export function lineasPrecuenta(pedido: Pick<Pedido, 'lineas'>): LineaPrecuenta[] {
  const todas = pedido.lineas || [];
  return lineasDeCuenta(todas).map((l) => ({
    cantidad: l.cantidad,
    nombre: l.nombre,
    detalle: '',
    precio: Number(l.subtotal),
    entrada: entradaDeLineaPedido(l, todas),
  }));
}
