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

/** Lee un parámetro «si»/«no» (acepta también true/false); sin parámetro o ante un error devuelve `defecto`. */
async function leerSiNo(db: any, clave: string, defecto: boolean): Promise<boolean> {
  try {
    const p = await db?.parametro?.findUnique?.({ where: { clave } });
    if (p === null || p === undefined || p.valor === null || p.valor === undefined) return defecto;
    const v = p.valor;
    if (v === true) return true;
    if (v === false) return false;
    const t = String(v).toLowerCase().trim();
    if (t === 'si' || t === 'sí' || t === 'true') return true;
    if (t === 'no' || t === 'false') return false;
    return defecto;
  } catch {
    return defecto;
  }
}

/**
 * `almacen_consumir_al_preparar` («si»/«no», nace en «no»): los insumos por receta de lo que se vende sobre pedido se
 * descuentan del stock de COCINA cuando Cocina marca lo preparado, en vez de al cobrar. Solo tiene efecto con el
 * interruptor general encendido (quien lo usa debe comprobarlo antes).
 */
export const almacenConsumirAlPreparar = (db: any) => leerSiNo(db, 'almacen_consumir_al_preparar', false);

/**
 * `almacen_permitir_cocina_negativa` («si»/«no», nace en «si»): si Cocina no tiene insumo suficiente, la preparación
 * sigue y el stock de Cocina queda en negativo con un pendiente de emitir. En «no», registrar una tanda se bloquea
 * (como hasta hoy) cuando Cocina no alcanza; la cocina en vivo nunca se detiene.
 */
export const almacenPermitirCocinaNegativa = (db: any) => leerSiNo(db, 'almacen_permitir_cocina_negativa', true);
