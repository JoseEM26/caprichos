/**
 * Cálculo de montos de BOLETA y FACTURA. Todo en céntimos enteros; sin floats en los montos.
 * Los precios de la carta ya traen IGV: base = redondeo(total * 1000 / (1000 + pct*10)), igv = total - base.
 * El redondeo de la base se hace una sola vez sobre el total del comprobante y la diferencia de céntimos
 * cae en la última línea, así la suma de líneas cuadra al céntimo con el total del pedido.
 */

export const IGV_PCT_DEFECTO = 10.5;

export interface LineaCalculo {
  nombre: string;
  cantidad: number;
  /** Subtotal de la línea CON IGV, en céntimos (cantidad x precio unitario). */
  subtotalCents: number;
}

export interface EntradaCalculo {
  lineas: LineaCalculo[];
  /** Envío de delivery (con IGV), en céntimos. 0 si no hay. */
  envioCents: number;
  /** Descuento del pedido (cupones/puntos), con IGV, en céntimos. */
  descuentoCents: number;
  /** Total del pedido (subtotal - descuento + envío), en céntimos: se verifica contra el cálculo. */
  totalCents: number;
  igvPct: number;
}

export interface ItemCalculado {
  nombre: string;
  esEnvio: boolean;
  cantidad: number;
  /** Precio unitario con IGV, en céntimos (envío: el monto del envío). */
  precioUnitCents: number;
  /** Valor de venta sin IGV de la línea, en céntimos. */
  baseCents: number;
  igvCents: number;
  totalCents: number;
}

export interface TotalesCalculados {
  items: ItemCalculado[];
  totalGravadaCents: number;
  totalIgvCents: number;
  descuentoCents: number;
  descuentoBaseCents: number;
  descuentoIgvCents: number;
  totalCents: number;
}

/** División entera con redondeo mitad hacia arriba (n >= 0, d > 0). */
export function dividirRedondeado(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

/** Base sin IGV de un monto con IGV, en céntimos. pct en décimas (10.5 -> 105). */
function baseDeCents(totalCents: number, pctDecimas: number): number {
  return dividirRedondeado(totalCents * 1000, 1000 + pctDecimas);
}

/** Convierte un monto en soles (number o texto) a céntimos enteros. Rechaza más de 2 decimales. */
export function aCentimos(valor: number | string): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new Error(`Monto no numérico: ${valor}`);
  const cents = Math.round(n * 100);
  if (Math.abs(cents - n * 100) > 1e-6) throw new Error(`Monto con más de 2 decimales: ${valor}`);
  return cents;
}

function esEntero(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

export function calcularComprobante(e: EntradaCalculo): TotalesCalculados {
  const pctDecimas = Math.round(e.igvPct * 10);
  if (!Number.isFinite(e.igvPct) || pctDecimas < 0 || Math.abs(pctDecimas - e.igvPct * 10) > 1e-9) {
    throw new Error('IGV no válido');
  }
  if (!esEntero(e.envioCents) || e.envioCents < 0) throw new Error('Envío no válido');
  if (!esEntero(e.descuentoCents) || e.descuentoCents < 0) throw new Error('Descuento no válido');
  if (!esEntero(e.totalCents) || e.totalCents < 0) throw new Error('Total no válido');
  if (e.lineas.length === 0 && e.envioCents === 0) throw new Error('El comprobante no tiene productos');

  // Ítems con IGV: productos y, si hay, el envío como ítem ZZ
  const brutos = e.lineas.map((l) => {
    if (!esEntero(l.cantidad) || l.cantidad <= 0) throw new Error(`Cantidad no válida en ${l.nombre}`);
    if (!esEntero(l.subtotalCents) || l.subtotalCents < 0) throw new Error(`Subtotal no válido en ${l.nombre}`);
    return {
      nombre: l.nombre,
      esEnvio: false,
      cantidad: l.cantidad,
      totalCents: l.subtotalCents,
    };
  });
  if (e.envioCents > 0) {
    brutos.push({ nombre: 'Servicio de delivery', esEnvio: true, cantidad: 1, totalCents: e.envioCents });
  }

  const sumaConIgv = brutos.reduce((acc, b) => acc + b.totalCents, 0);
  if (e.descuentoCents > sumaConIgv) throw new Error('El descuento supera el total');
  if (sumaConIgv - e.descuentoCents !== e.totalCents) {
    throw new Error('Los montos no cuadran con el total del pedido');
  }

  // Base por línea; la diferencia con la base global (redondeada una sola vez) va a la última línea
  const baseGlobal = baseDeCents(sumaConIgv, pctDecimas);
  const bases = brutos.map((b) => baseDeCents(b.totalCents, pctDecimas));
  const sumaBases = bases.reduce((a, b) => a + b, 0);
  bases[bases.length - 1] += baseGlobal - sumaBases;

  const items: ItemCalculado[] = brutos.map((b, i) => ({
    nombre: b.nombre,
    esEnvio: b.esEnvio,
    cantidad: b.cantidad,
    precioUnitCents: b.esEnvio ? b.totalCents : dividirRedondeado(b.totalCents, b.cantidad),
    baseCents: bases[i],
    igvCents: b.totalCents - bases[i],
    totalCents: b.totalCents,
  }));

  // Descuento global: su base se resta de la base gravada y su IGV del IGV total; el total no cambia de método
  const descuentoBaseCents = baseDeCents(e.descuentoCents, pctDecimas);
  const descuentoIgvCents = e.descuentoCents - descuentoBaseCents;

  const totalGravadaCents = baseGlobal - descuentoBaseCents;
  const totalIgvCents = sumaConIgv - baseGlobal - descuentoIgvCents;

  return {
    items,
    totalGravadaCents,
    totalIgvCents,
    descuentoCents: e.descuentoCents,
    descuentoBaseCents,
    descuentoIgvCents,
    totalCents: totalGravadaCents + totalIgvCents,
  };
}

/** Formatea céntimos como texto con 2 decimales (ej. 1234 -> "12.34"). */
export function centsATexto(c: number): string {
  const signo = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
