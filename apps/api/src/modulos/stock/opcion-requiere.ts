/**
 * Opciones de grupo ligadas al stock real (tabla opcion_requiere): «2 Donas» consume 2 de DONAS ARTESANALES;
 * un sabor de dona consume 1 de ese sabor. Una opción sin requisitos sigue como antes (solo agotado_hasta).
 * Función de lectura: no descuenta nada. El descuento real lo hacen las partes de combo (líneas hijas).
 */

/** Una unidad de stock que consume una opción: producto (y sabor, si es por sabor) y cuántas. */
export interface RequisitoOpcion {
  productoId: string;
  saborId: string | null;
  cantidad: number;
}

interface SaborSaldo {
  productoId: string;
  activo: boolean;
  agotadoHasta: Date | null;
  saldo: number;
}

interface ProductoSaldo {
  oculto: boolean;
  agotadoHasta: Date | null;
  controlaStock: boolean;
  /** Saldo del producto sin sabores (suma de sus filas de stock). */
  saldo: number;
  /** Sabores del producto (activos o no; se filtran al calcular). */
  sabores: Array<SaborSaldo & { id: string }>;
}

export interface SaldosRequisitos {
  productos: Map<string, ProductoSaldo>;
  sabores: Map<string, SaborSaldo & { id: string }>;
}

const sigueAgotado = (hasta: Date | null | undefined, ahora: Date) => !!hasta && new Date(hasta) > ahora;

/** Requisitos de cada opción pedida, por id de opción. */
export async function requisitosDeOpciones(db: any, opcionIds: bigint[]): Promise<Map<string, RequisitoOpcion[]>> {
  const mapa = new Map<string, RequisitoOpcion[]>();
  if (opcionIds.length === 0) return mapa;
  const filas = await db.opcionRequiere.findMany({
    where: { opcion_id: { in: opcionIds } },
    select: { opcion_id: true, producto_id: true, sabor_id: true, cantidad: true },
  });
  for (const f of filas) {
    const k = f.opcion_id.toString();
    const lista = mapa.get(k) ?? [];
    lista.push({ productoId: f.producto_id.toString(), saborId: f.sabor_id?.toString() ?? null, cantidad: f.cantidad });
    mapa.set(k, lista);
  }
  return mapa;
}

/** Saldos de los productos y sabores que piden esos requisitos (dos consultas como máximo). */
export async function saldosDeRequisitos(db: any, requisitos: RequisitoOpcion[]): Promise<SaldosRequisitos> {
  const productos = new Map<string, ProductoSaldo>();
  const sabores = new Map<string, SaborSaldo & { id: string }>();
  const ids = [...new Set(requisitos.map((r) => BigInt(r.productoId)))];
  if (ids.length === 0) return { productos, sabores };
  const filas = await db.producto.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      oculto: true,
      agotado_hasta: true,
      controla_stock: true,
      stocks: { select: { cantidad: true } },
      sabores: { select: { id: true, producto_id: true, activo: true, agotado_hasta: true, stockSabor: { select: { cantidad: true } } } },
    },
  });
  for (const p of filas) {
    const sabs = (p.sabores ?? []).map((s: any) => ({
      id: s.id.toString(),
      productoId: p.id.toString(),
      activo: s.activo,
      agotadoHasta: s.agotado_hasta ?? null,
      saldo: Number(s.stockSabor?.cantidad ?? 0),
    }));
    productos.set(p.id.toString(), {
      oculto: p.oculto,
      agotadoHasta: p.agotado_hasta ?? null,
      controlaStock: p.controla_stock,
      saldo: (p.stocks ?? []).reduce((acc: number, f: any) => acc + Number(f.cantidad), 0),
      sabores: sabs,
    });
    for (const s of sabs) sabores.set(s.id, s);
  }
  return { productos, sabores };
}

/**
 * Unidades que se pueden pedir de un producto: 0 si está oculto o agotado; Infinity si no controla stock;
 * con sabores activos, la suma del saldo de los que no están agotados; si no, su saldo.
 */
export function unidadesDeProducto(p: ProductoSaldo | undefined, ahora = new Date()): number {
  if (!p || p.oculto || sigueAgotado(p.agotadoHasta, ahora)) return 0;
  if (!p.controlaStock) return Infinity;
  const activos = p.sabores.filter((s) => s.activo);
  if (activos.length > 0) {
    return activos
      .filter((s) => !sigueAgotado(s.agotadoHasta, ahora))
      .reduce((acc, s) => acc + Math.max(0, Math.floor(s.saldo)), 0);
  }
  return Math.max(0, Math.floor(p.saldo));
}

/**
 * Requisitos que NO alcanzan con el saldo: por producto, la suma de todas las cantidades pedidas (con y sin sabor)
 * contra sus unidades; por sabor, la suma de lo pedido de ese sabor contra su saldo. Vacío = alcanza.
 */
export function requisitosFaltantes(requisitos: RequisitoOpcion[], saldos: SaldosRequisitos, ahora = new Date()): RequisitoOpcion[] {
  const porProducto = new Map<string, number>();
  const porSabor = new Map<string, { productoId: string; cantidad: number }>();
  for (const r of requisitos) {
    porProducto.set(r.productoId, (porProducto.get(r.productoId) ?? 0) + r.cantidad);
    if (r.saborId) {
      const previo = porSabor.get(r.saborId);
      porSabor.set(r.saborId, { productoId: r.productoId, cantidad: (previo?.cantidad ?? 0) + r.cantidad });
    }
  }
  const faltan: RequisitoOpcion[] = [];
  for (const [productoId, cantidad] of porProducto) {
    if (unidadesDeProducto(saldos.productos.get(productoId), ahora) < cantidad) {
      faltan.push({ productoId, saborId: null, cantidad });
    }
  }
  for (const [saborId, { productoId, cantidad }] of porSabor) {
    const s = saldos.sabores.get(saborId);
    const alcanza = !!s && s.activo && !sigueAgotado(s.agotadoHasta, ahora) && s.saldo >= cantidad;
    if (!alcanza) faltan.push({ productoId, saborId, cantidad });
  }
  return faltan;
}

/** Ids de las opciones que hoy NO alcanzan con el stock (cada una sola, para la carta). */
export async function opcionesSinStock(db: any, opcionIds: bigint[], ahora = new Date()): Promise<Set<string>> {
  const porOpcion = await requisitosDeOpciones(db, opcionIds);
  const sinStock = new Set<string>();
  if (porOpcion.size === 0) return sinStock;
  const saldos = await saldosDeRequisitos(db, [...porOpcion.values()].flat());
  for (const [id, reqs] of porOpcion) {
    if (requisitosFaltantes(reqs, saldos, ahora).length > 0) sinStock.add(id);
  }
  return sinStock;
}
