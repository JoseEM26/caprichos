/**
 * Avisos de stock de INSUMOS por cruce (no ventas bloqueadas: los insumos nunca bloquean, solo avisan).
 *
 * Umbral de «por pedir» = max(mínimo, máximo × porcentaje/100). Sin máximo vale el mínimo.
 * Niveles: POR_PEDIR (0 < saldo ≤ umbral), AGOTADO (saldo ≤ 0). Por encima del umbral no hay nivel.
 *
 * Un aviso sale solo al CRUZAR: de normal a POR_PEDIR, de normal o POR_PEDIR a AGOTADO. El nivel anterior queda guardado en
 * `insumo.alerta_stock`; al reponerse por encima del umbral vuelve a null y así se re-arma. El cambio se reclama con un
 * UPDATE condicionado al nivel anterior: quien gana el UPDATE avisa, el resto no. Así la venta, el movimiento manual, el
 * traslado, el consumo por receta y el cron no duplican un mismo cruce.
 */
export const STOCK_ALERTA_PCT_DEFECTO = 20;
export const CLAVE_STOCK_ALERTA_PCT = 'stock_alerta_porcentaje';

export type NivelAlertaStock = 'POR_PEDIR' | 'AGOTADO';

/** Umbral efectivo: max(mínimo, máximo × pct/100). Sin máximo (0 o nulo) vale el mínimo. */
export function umbralAlertaStock(minimo: number, maximo: number, pct: number = STOCK_ALERTA_PCT_DEFECTO): number {
  const min = Math.max(0, Number(minimo) || 0);
  const max = Number(maximo) || 0;
  if (max <= 0) return min;
  const p = Math.min(100, Math.max(1, Number(pct) || STOCK_ALERTA_PCT_DEFECTO));
  return Math.max(min, Math.round(((max * p) / 100) * 1000) / 1000);
}

/**
 * Nivel del insumo según su saldo TOTAL (todos los lugares). Con `sinUso` (mínimo 0, sin stock cargado ni movimientos)
 * no está agotado: es un insumo que nadie usa todavía.
 */
export function nivelAlertaStock(total: number, umbral: number, sinUso = false): NivelAlertaStock | null {
  if (total <= 0) return sinUso ? null : 'AGOTADO';
  if (total <= umbral) return 'POR_PEDIR';
  return null;
}

/** Qué aviso sale al pasar de `anterior` a `nuevo`. Nada si no hay cruce hacia un nivel más grave. */
export function cruceAlertaStock(anterior: NivelAlertaStock | null, nuevo: NivelAlertaStock | null): NivelAlertaStock | null {
  if (nuevo === 'AGOTADO') return anterior === 'AGOTADO' ? null : 'AGOTADO';
  if (nuevo === 'POR_PEDIR') return anterior === null ? 'POR_PEDIR' : null;
  return null;
}

export interface CruceStock {
  insumoId: bigint;
  nombre: string;
  unidad: string;
  minimo: number;
  /** Saldo TOTAL del insumo (suma de todos sus lugares): lo mismo que se muestra en el aviso. */
  total: number;
  tipo: NivelAlertaStock;
  lugarNombre: string | null;
  /** Marca del cruce (instante de la reclamación): hace única la clave de cada aviso. */
  marca: string;
}

/** Porcentaje del parámetro `stock_alerta_porcentaje` (entero 1 a 100). Ausente o inválido = 20. */
export async function porcentajeAlertaStock(db: any): Promise<number> {
  try {
    const p = await db?.parametro?.findUnique?.({ where: { clave: CLAVE_STOCK_ALERTA_PCT } });
    const n = Number(p?.valor);
    return Number.isFinite(n) && n >= 1 && n <= 100 ? n : STOCK_ALERTA_PCT_DEFECTO;
  } catch {
    return STOCK_ALERTA_PCT_DEFECTO;
  }
}

/**
 * Evalúa el saldo total de los insumos activos (o solo `insumoIds`) y devuelve los cruces a avisar. Reclama el nuevo
 * nivel en la base; un insumo cuyo nivel ya cambió por otro proceso se omite. No notifica: lo hace el llamador.
 * Con el control de almacén apagado el llamador no debe llamarla (ver controlAlmacenActivo).
 */
export async function evaluarCrucesStock(
  db: any,
  opciones: { insumoIds?: bigint[]; pct?: number } = {},
): Promise<CruceStock[]> {
  if (opciones.insumoIds && opciones.insumoIds.length === 0) return [];
  const pct = opciones.pct ?? (await porcentajeAlertaStock(db));
  const insumos = await db.insumo.findMany({
    where: { activo: true, ...(opciones.insumoIds ? { id: { in: opciones.insumoIds } } : {}) },
    select: {
      id: true,
      nombre: true,
      unidad_almacen: true,
      minimo: true,
      maximo: true,
      alerta_stock: true,
      lugarConsumo: { select: { nombre: true } },
      stocks: { select: { cantidad: true } },
    },
  });

  const cruces: CruceStock[] = [];
  for (const i of insumos) {
    const total = i.stocks.reduce((acc: number, s: { cantidad: unknown }) => acc + Number(s.cantidad), 0);
    const minimo = Number(i.minimo);
    const sinUso =
      minimo <= 0 && i.stocks.length === 0 && (await db.movimientoStock.count({ where: { insumo_id: i.id } })) === 0;
    const anterior = (i.alerta_stock as NivelAlertaStock | null) ?? null;
    const nuevo = nivelAlertaStock(total, umbralAlertaStock(minimo, Number(i.maximo), pct), sinUso);
    if (nuevo === anterior) continue;

    const reclamado = await db.insumo.updateMany({
      where: { id: i.id, alerta_stock: anterior },
      data: { alerta_stock: nuevo },
    });
    if (reclamado.count === 0) continue;

    const tipo = cruceAlertaStock(anterior, nuevo);
    if (tipo) {
      cruces.push({
        insumoId: i.id,
        nombre: i.nombre,
        unidad: i.unidad_almacen,
        minimo,
        total,
        tipo,
        lugarNombre: i.lugarConsumo?.nombre ?? null,
        marca: String(Date.now()),
      });
    }
  }
  return cruces;
}
