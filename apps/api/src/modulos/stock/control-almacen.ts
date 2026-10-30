/**
 * Interruptor «Control de almacén» (parámetro `stock_control_activo`, «si»/«no»; sin parámetro, apagado).
 * Apagado, vender no toca el stock y el sistema no genera avisos de insumos (stock bajo, agotados por receta).
 * Se lee directo del parámetro para que cualquier módulo pueda consultarlo sin depender de StockService.
 */
export async function controlAlmacenActivo(db: any): Promise<boolean> {
  try {
    const p = await db?.parametro?.findUnique?.({ where: { clave: 'stock_control_activo' } });
    const v = p?.valor;
    return v === true || String(v ?? '').toLowerCase().trim() === 'si';
  } catch {
    return false;
  }
}
