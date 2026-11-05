/** Error 409 STOCK_INSUFICIENTE al crear un pedido (el cuerpo viene en `detalles`: productoId y quedan). */
export interface DatosStockInsuficiente {
  productoId: string;
  quedan: number;
}

export function leerStockInsuficiente(err: unknown): DatosStockInsuficiente | null {
  const e = err as { codigo?: string; detalles?: Record<string, unknown> } | null;
  if (e?.codigo !== 'STOCK_INSUFICIENTE') return null;
  const quedan = Number(e.detalles?.quedan);
  return {
    productoId: String(e.detalles?.productoId ?? ''),
    quedan: Number.isFinite(quedan) ? Math.max(0, Math.floor(quedan)) : 0,
  };
}

/** «Solo quedan 3 de Dona de chocolate…» o, si ya no hay, el aviso de quitarlo. El pedido no se pierde. */
export function mensajeStockInsuficiente(datos: DatosStockInsuficiente, nombre?: string): string {
  const producto = nombre ?? 'este producto';
  if (datos.quedan <= 0) {
    return `Ya no queda ${producto}: quítalo del pedido o cámbialo por otro. El pedido sigue igual.`;
  }
  const cuantos = datos.quedan === 1 ? `Solo queda 1 de ${producto}` : `Solo quedan ${datos.quedan} de ${producto}`;
  return `${cuantos}. Baja la cantidad en el pedido y vuelve a intentar. El pedido sigue igual.`;
}
