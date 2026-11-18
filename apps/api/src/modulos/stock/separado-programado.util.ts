/**
 * Stock separado por un pedido PROGRAMADO: se descuenta al crear (igual que cualquier venta) y queda a la vista en el
 * historial de almacén. Funciones sin efectos sobre el stock: solo leen movimientos para auditarlos.
 */
export interface LineaSeparada {
  producto: string;
  sabor: string | null;
  cantidad: number;
}

/** Productos (y sabores) que el pedido tiene descontados, con su cantidad. Solo movimientos VENTA de productos con control. */
export async function lineasSeparadasDelPedido(db: any, pedidoId: bigint): Promise<LineaSeparada[]> {
  const movs: any[] = await db.movimientoStock.findMany({
    where: { pedido_id: pedidoId, tipo: 'VENTA', producto_id: { not: null }, movimientosRevertidos: { none: {} } },
    select: { cantidad: true, producto: { select: { nombre: true } }, sabor: { select: { nombre: true } } },
  });
  return agruparSeparadas(movs.map((m) => ({ producto: m.producto?.nombre ?? 'Producto', sabor: m.sabor?.nombre ?? null, cantidad: Number(m.cantidad) })));
}

/** Suma las filas repetidas del mismo producto y sabor. */
export function agruparSeparadas(filas: LineaSeparada[]): LineaSeparada[] {
  const mapa = new Map<string, LineaSeparada>();
  for (const f of filas) {
    const k = `${f.producto}|${f.sabor ?? ''}`;
    const previa = mapa.get(k);
    if (previa) previa.cantidad += f.cantidad;
    else mapa.set(k, { ...f });
  }
  return [...mapa.values()];
}
