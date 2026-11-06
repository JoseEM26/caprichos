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

/** Sabor rechazado (409 SABOR_AGOTADO o STOCK_INSUFICIENTE con saborId): el cuerpo viene en `detalles`. */
export interface DatosSaborRechazado {
  productoId: string;
  saborId: string;
  saborNombre: string;
  quedan: number;
  agotado: boolean;
}

export function leerSaborRechazado(err: unknown): DatosSaborRechazado | null {
  const e = err as { codigo?: string; detalles?: Record<string, unknown> } | null;
  if (e?.codigo !== 'SABOR_AGOTADO' && e?.codigo !== 'STOCK_INSUFICIENTE') return null;
  if (e.detalles?.saborId == null) return null;
  const quedan = e.codigo === 'SABOR_AGOTADO' ? 0 : Number(e.detalles?.quedan);
  return {
    productoId: String(e.detalles?.productoId ?? ''),
    saborId: String(e.detalles.saborId),
    saborNombre: typeof e.detalles?.saborNombre === 'string' && e.detalles.saborNombre ? e.detalles.saborNombre : 'este sabor',
    quedan: Number.isFinite(quedan) ? Math.max(0, Math.floor(quedan)) : 0,
    agotado: e.codigo === 'SABOR_AGOTADO' || quedan <= 0,
  };
}

/** Mensaje del modal: qué sabor cambió y cómo arreglar la línea (el pedido no se pierde). */
export function mensajeSaborRechazado(datos: DatosSaborRechazado, nombre?: string): string {
  const producto = nombre ?? 'este producto';
  const cuanto = datos.agotado ? `Ya no quedan ${datos.saborNombre}` : `Solo quedan ${datos.quedan} de ${datos.saborNombre}`;
  return `${cuanto} (${producto}). Quita esa línea y agrégala otra vez con los sabores que quedan. El pedido sigue igual.`;
}
