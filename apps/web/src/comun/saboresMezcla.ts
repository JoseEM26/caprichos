/** Funciones puras del selector de sabores mezclados (donas y galletas por media docena o docena). */

/** Hasta cuántas unidades se muestra «Quedan N» junto al sabor. */
export const UMBRAL_QUEDAN_SABOR = 5;

/** Cantidad elegida por saborId. Los sabores con 0 no cuentan. */
export type Reparto = Record<string, number>;

export interface SaborMezcla {
  id: string;
  nombre: string;
  disponible: boolean;
  /** null: sin tope (no hay apertura de stock hoy para ese sabor). */
  quedan: number | null;
}

/** Forma que viaja en la línea del pedido: { saborId, cantidad }. */
export interface SaborElegido {
  saborId: string;
  cantidad: number;
}

type SaborConTope = Pick<SaborMezcla, 'id' | 'quedan'>;

/** Suma de unidades elegidas en el reparto. */
export function totalElegido(valor: Reparto): number {
  return Object.values(valor).reduce((acc, n) => acc + (Number.isFinite(n) && n > 0 ? n : 0), 0);
}

/** Cuántas unidades faltan por repartir (0 si ya está completo o pasado). */
export function faltanUnidades(valor: Reparto, total: number): number {
  return Math.max(0, total - totalElegido(valor));
}

/** Reparto válido: suma exacta del total, enteros, sin sabores desconocidos y sin pasar el tope de cada sabor. */
export function repartoValido(valor: Reparto, total: number, sabores: SaborConTope[]): boolean {
  if (total <= 0) return false;
  let suma = 0;
  for (const [id, cantidad] of Object.entries(valor)) {
    if (!Number.isInteger(cantidad) || cantidad < 0) return false;
    if (cantidad === 0) continue;
    const sabor = sabores.find((s) => s.id === id);
    if (!sabor) return false;
    if (sabor.quedan !== null && cantidad > sabor.quedan) return false;
    suma += cantidad;
  }
  return suma === total;
}

/**
 * Deja el reparto dentro del tope: cada sabor no pasa de lo que queda y la suma no pasa del total.
 * Un sabor que ya no está en la lista (agotado o inactivo) sale del reparto.
 */
export function recortarAlTope(valor: Reparto, sabores: SaborConTope[], total: number): Reparto {
  const nuevo: Reparto = {};
  let restan = Math.max(0, total);
  for (const [id, cantidad] of Object.entries(valor)) {
    const sabor = sabores.find((s) => s.id === id);
    if (!sabor) continue;
    const tope = sabor.quedan === null ? Infinity : sabor.quedan;
    const cupo = Math.min(Math.max(0, Math.floor(cantidad)), tope, restan);
    if (cupo > 0) {
      nuevo[id] = cupo;
      restan -= cupo;
    }
  }
  return nuevo;
}

/** Cuántas unidades puede tomar este sabor, dado lo que ya está elegido en los demás. */
export function topeParaSabor(valor: Reparto, saborId: string, sabor: SaborConTope, total: number): number {
  const enOtros = totalElegido(valor) - (valor[saborId] ?? 0);
  const porTotal = Math.max(0, total - enOtros);
  return sabor.quedan === null ? porTotal : Math.min(porTotal, sabor.quedan);
}

/** Reparto con todo el total en un solo sabor (atajo «Todas del mismo sabor»). */
export function todasDeUn(saborId: string, total: number): Reparto {
  return total > 0 ? { [saborId]: total } : {};
}

/** Pasa el reparto a la forma de la línea: solo sabores con cantidad, en el orden en que se eligieron. */
export function aArreglo(valor: Reparto): SaborElegido[] {
  return Object.entries(valor)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([saborId, cantidad]) => ({ saborId, cantidad }));
}

/** Lo contrario de aArreglo: de la forma de la línea al reparto. */
export function aReparto(arreglo: SaborElegido[]): Reparto {
  const valor: Reparto = {};
  for (const { saborId, cantidad } of arreglo) {
    if (cantidad > 0) valor[saborId] = (valor[saborId] ?? 0) + cantidad;
  }
  return valor;
}

/**
 * Cuántas mezclas (cada una de `unidadesPorMezcla` unidades) caben con lo que queda.
 * Null: algún sabor disponible no tiene tope, así que no hay límite.
 */
export function maximoMezclas(sabores: SaborMezcla[], unidadesPorMezcla: number): number | null {
  const disponibles = sabores.filter((s) => s.disponible);
  if (disponibles.some((s) => s.quedan === null)) return null;
  const suma = disponibles.reduce((acc, s) => acc + (s.quedan ?? 0), 0);
  return Math.floor(suma / Math.max(1, unidadesPorMezcla));
}

/** Texto legible de la mezcla: «2 Fresa · 3 Oreo · 1 Manjar». */
export function resumenMezcla(arreglo: SaborElegido[], nombres: Record<string, string>): string {
  return arreglo
    .filter((s) => s.cantidad > 0)
    .map((s) => `${s.cantidad} ${nombres[s.saborId] ?? 'sabor'}`)
    .join(' · ');
}
