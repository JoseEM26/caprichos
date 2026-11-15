/** Cálculos puros de Análisis › Productos (margen, clasificación, marcas y días). Sin base de datos. */

export const MARGEN_BAJO = 30;
export const MARGEN_ALTO = 70;
export type GrupoMargen = 'BAJO' | 'MEDIO' | 'ALTO' | 'SIN_COSTO';

export interface InsumoCosto {
  nombre: string;
  costo_unit: unknown;
  factor_receta: unknown;
  merma_pct?: unknown;
}
export interface RecetaCosto {
  tamano_valor_id: bigint | null;
  es_produccion: boolean;
  rinde: unknown;
  lineas: Array<{ cantidad: unknown; insumo: InsumoCosto }>;
}

const n = (v: unknown) => Number(v ?? 0);

/** Receta que aplica a un tamaño: la de ese tamaño; si no hay, la general (sin tamaño). Solo cuentan las que tienen insumos; gana la de producción. */
export function elegirReceta(recetas: RecetaCosto[], tamanoValorId: bigint | null): RecetaCosto | null {
  const con = recetas.filter((r) => r.lineas.length > 0);
  const pick = (xs: RecetaCosto[]) => xs.find((r) => r.es_produccion) ?? xs[0] ?? null;
  const propias = tamanoValorId == null ? [] : con.filter((r) => r.tamano_valor_id === tamanoValorId);
  return pick(propias) ?? pick(con.filter((r) => r.tamano_valor_id == null));
}

/**
 * Costo de UNA unidad vendida: suma de cantidad × costo del insumo por unidad de receta (costo_unit ÷ factor_receta),
 * con la merma habitual del insumo (la receta guarda la cantidad neta) y dividida entre lo que rinde si es de producción.
 * Sin receta o con algún insumo sin costo no se inventa nada: costo null y el motivo.
 */
export function costoDeReceta(receta: RecetaCosto | null): { costo: number | null; motivos: string[] } {
  if (!receta) return { costo: null, motivos: ['Sin receta'] };
  const motivos: string[] = [];
  let suma = 0;
  for (const l of receta.lineas) {
    const unit = n(l.insumo.costo_unit);
    if (!(unit > 0)) {
      motivos.push(`${l.insumo.nombre} sin costo`);
      continue;
    }
    const merma = Math.min(99.99, Math.max(0, n(l.insumo.merma_pct)));
    suma += (n(l.cantidad) / (1 - merma / 100)) * (unit / (n(l.insumo.factor_receta) || 1));
  }
  if (motivos.length) return { costo: null, motivos };
  const rinde = n(receta.rinde);
  return { costo: receta.es_produccion && rinde > 0 ? suma / rinde : suma, motivos: [] };
}

/** Margen en % = (venta − costo) / venta. null si no hay venta. */
export const margenPct = (venta: number, costo: number): number | null => (venta > 0 ? Math.round(((venta - costo) / venta) * 1000) / 10 : null);

/** Menos de 30 % bajo, de 30 a 70 % medio, más de 70 % alto. */
export const clasificarMargen = (pct: number): Exclude<GrupoMargen, 'SIN_COSTO'> => (pct < MARGEN_BAJO ? 'BAJO' : pct > MARGEN_ALTO ? 'ALTO' : 'MEDIO');

export interface GrupoVendido {
  tamano: string | null;
  unidades: number;
  /** Venta en céntimos. */
  ventaC: number;
}

/**
 * Margen de un producto: cada grupo (tamaño) vendido se costea con la receta de su tamaño. Un solo grupo sin costo deja
 * todo el producto «sin costo registrado». Sin ventas se usa la referencia de catálogo (precio y receta del primer tamaño).
 */
export function margenDeProducto(
  recetas: RecetaCosto[],
  tamanos: Map<string, bigint>,
  vendido: GrupoVendido[],
  referencia: { tamano: string | null; precio: number },
) {
  const base = vendido.length ? ('ventas' as const) : ('catalogo' as const);
  const grupos: GrupoVendido[] = vendido.length ? vendido : [{ tamano: referencia.tamano, unidades: 1, ventaC: Math.round(referencia.precio * 100) }];
  const motivos = new Set<string>();
  let ventaC = 0;
  let costoC = 0;
  for (const g of grupos) {
    ventaC += g.ventaC;
    const { costo, motivos: m } = costoDeReceta(elegirReceta(recetas, g.tamano ? (tamanos.get(g.tamano) ?? null) : null));
    if (costo == null) m.forEach((x) => motivos.add(x));
    else costoC += costo * g.unidades * 100;
  }
  const unidades = grupos.reduce((s, g) => s + g.unidades, 0);
  if (motivos.size) return { grupo: 'SIN_COSTO' as GrupoMargen, margen: null, costoC: null, ventaC, unidades, motivos: [...motivos], base };
  const margen = margenPct(ventaC, costoC);
  return {
    grupo: (margen == null ? 'SIN_COSTO' : clasificarMargen(margen)) as GrupoMargen,
    margen,
    costoC: Math.round(costoC),
    ventaC,
    unidades,
    motivos: margen == null ? ['Sin precio de venta'] : [],
    base,
  };
}

/** Marca el 20 % que más vende (solo con ventas) y el 20 % que menos vende. Con menos de 5 productos no se marca. `filas` ya viene de más a menos vendido. */
export function marcarExtremos<T extends { unidades: number }>(filas: T[]): Array<T & { marca: 'TOP' | 'BAJO' | null }> {
  const k = Math.ceil(filas.length * 0.2);
  return filas.map((f, i) => ({
    ...f,
    marca: filas.length < 5 ? null : i >= filas.length - k ? 'BAJO' : i < k && f.unidades > 0 ? 'TOP' : null,
  }));
}

/** Variación % contra el período anterior; null si antes no se vendió nada (no hay base). */
export const tendencia = (ahora: number, antes: number): number | null => (antes > 0 ? Math.round(((ahora - antes) / antes) * 1000) / 10 : null);

export const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
/** 0 = lunes … 6 = domingo, de una fecha AAAA-MM-DD. */
export const diaSemana = (fecha: string): number => (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7;

export interface DiaVenta {
  fecha: string;
  pedidos: number;
  /** céntimos */
  c: number;
}

/** Promedio por día de la semana sobre los días CON ventas de ese día (un lunes cerrado no baja el promedio). */
export function promedioPorDiaSemana(dias: DiaVenta[]) {
  return NOMBRES_DIA.map((nombre, i) => {
    const d = dias.filter((x) => diaSemana(x.fecha) === i);
    const pedidos = d.reduce((s, x) => s + x.pedidos, 0);
    const c = d.reduce((s, x) => s + x.c, 0);
    return { dia: nombre, dias: d.length, pedidos, c, promedioPedidos: d.length ? Math.round((pedidos / d.length) * 10) / 10 : null, promedioC: d.length ? Math.round(c / d.length) : null };
  });
}
