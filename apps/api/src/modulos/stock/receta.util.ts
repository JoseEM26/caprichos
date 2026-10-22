import { Prisma } from '@prisma/client';

export interface RecetaLineaEntrada {
  insumo_id: bigint | string | number;
  cantidad: number | string | Prisma.Decimal;
  producto_tamano_id?: bigint | string | number | null;
}

export interface RecetaEntrada {
  id?: bigint | string | number;
  producto_id?: bigint | string | number;
  tamano_valor_id?: bigint | string | number | null;
  es_produccion?: boolean;
  rinde?: number | string | Prisma.Decimal | null;
  lineas?: RecetaLineaEntrada[];
}

export interface AjusteOpcionEntrada {
  opcion_id: bigint | string | number;
  insumo_id: bigint | string | number;
  efecto: 'SUMA' | 'QUITA' | 'REEMPLAZA' | string;
  reemplaza_insumo_id?: bigint | string | number | null;
  cantidad?: number | string | Prisma.Decimal | null;
}

export interface InsumoCalculado {
  insumoId: string;
  cantidad: number;
}

/**
 * Función pura que calcula los insumos finales que consume una línea de pedido
 * según la receta del producto, el tamaño seleccionado y los ajustes de opciones.
 */
export function insumosDeLinea(
  receta: RecetaEntrada | RecetaEntrada[] | null | undefined,
  ajustes: AjusteOpcionEntrada[] | null | undefined,
  tamanoId?: bigint | string | number | null,
  opcionesIds?: Array<bigint | string | number> | null,
  cantidad = 1,
): InsumoCalculado[] {
  if (!receta) return [];

  // 1. Obtener la receta correspondiente (si viene un array de recetas por tamaño)
  let recetaSeleccionada: RecetaEntrada | null = null;
  if (Array.isArray(receta)) {
    if (tamanoId !== undefined && tamanoId !== null) {
      recetaSeleccionada =
        receta.find((r) => String(r.tamano_valor_id) === String(tamanoId)) ||
        receta.find((r) => r.tamano_valor_id === null || r.tamano_valor_id === undefined) ||
        null;
    } else {
      recetaSeleccionada =
        receta.find((r) => r.tamano_valor_id === null || r.tamano_valor_id === undefined) ||
        receta[0] ||
        null;
    }
  } else {
    recetaSeleccionada = receta;
  }

  if (!recetaSeleccionada || !recetaSeleccionada.lineas || recetaSeleccionada.lineas.length === 0) {
    return [];
  }

  // 2. Mapa inicial de insumos de la receta base
  const mapaInsumos = new Map<string, number>();
  for (const linea of recetaSeleccionada.lineas) {
    const insumoId = String(linea.insumo_id);
    const cant = Number(linea.cantidad);
    mapaInsumos.set(insumoId, (mapaInsumos.get(insumoId) || 0) + cant);
  }

  // 3. Aplicar ajustes de opciones si las hay
  if (opcionesIds && opcionesIds.length > 0 && ajustes && ajustes.length > 0) {
    const opsSet = new Set(opcionesIds.map((o) => String(o)));
    const ajustesAplicables = ajustes.filter((a) => opsSet.has(String(a.opcion_id)));

    for (const ajuste of ajustesAplicables) {
      const insumoId = String(ajuste.insumo_id);
      const cantAjuste = ajuste.cantidad != null ? Number(ajuste.cantidad) : 0;
      const efecto = String(ajuste.efecto).toUpperCase();

      if (efecto === 'SUMA') {
        mapaInsumos.set(insumoId, (mapaInsumos.get(insumoId) || 0) + cantAjuste);
      } else if (efecto === 'QUITA') {
        const actual = mapaInsumos.get(insumoId) || 0;
        const nueva = Math.max(0, actual - (cantAjuste > 0 ? cantAjuste : actual));
        if (nueva === 0) {
          mapaInsumos.delete(insumoId);
        } else {
          mapaInsumos.set(insumoId, nueva);
        }
      } else if (efecto === 'REEMPLAZA') {
        if (ajuste.reemplaza_insumo_id != null) {
          const reemplazadoId = String(ajuste.reemplaza_insumo_id);
          const cantidadReemplazada = mapaInsumos.get(reemplazadoId) || 0;
          mapaInsumos.delete(reemplazadoId);

          const cantidadFinal = cantAjuste > 0 ? cantAjuste : cantidadReemplazada;
          if (cantidadFinal > 0) {
            mapaInsumos.set(insumoId, (mapaInsumos.get(insumoId) || 0) + cantidadFinal);
          }
        }
      }
    }
  }

  // 4. Multiplicar por la cantidad de unidades vendidas
  const factorMultiplicador = Number(cantidad) > 0 ? Number(cantidad) : 1;
  const resultado: InsumoCalculado[] = [];

  for (const [insumoId, cant] of mapaInsumos.entries()) {
    const total = Math.round(cant * factorMultiplicador * 1000) / 1000;
    if (total > 0) {
      resultado.push({ insumoId, cantidad: total });
    }
  }

  return resultado;
}

export type SemaforoColor = 'rojo' | 'naranja' | 'verde';
export type EstadoInsumoTexto = 'Agotado' | 'Poco' | 'Por acabarse' | 'Bien' | 'Lleno';

export interface SemaforoInfo {
  semaforo: SemaforoColor;
  estado: EstadoInsumoTexto;
  porcentaje: number;
}

/**
 * Calcula semáforo, texto descriptivo y porcentaje frente al máximo (RN-CAP-041, RN-CAP-118, RQ-STK-01-06).
 */
export function calcularSemaforoYEstado(
  stockTotal: number,
  minimo: number,
  intermedio: number | null,
  maximo: number,
): SemaforoInfo {
  const max = maximo > 0 ? maximo : 1;
  const pct = Math.min(100, Math.max(0, Math.round((stockTotal / max) * 100)));

  if (stockTotal <= 0) {
    return { semaforo: 'rojo', estado: 'Agotado', porcentaje: 0 };
  }
  if (stockTotal <= minimo) {
    return { semaforo: 'rojo', estado: 'Poco', porcentaje: pct };
  }
  if (intermedio !== null && intermedio !== undefined && stockTotal <= intermedio) {
    return { semaforo: 'naranja', estado: 'Por acabarse', porcentaje: pct };
  }
  if (maximo > 0 && stockTotal >= maximo * 0.95) {
    return { semaforo: 'verde', estado: 'Lleno', porcentaje: pct };
  }
  return { semaforo: 'verde', estado: 'Bien', porcentaje: pct };
}

export interface CalculoCostoMargen {
  costo: number | null;
  margenSoles: number | null;
  margenPorcentaje: number | null;
  tieneReceta: boolean;
}

/**
 * Calcula el costo del plato y su margen en soles y porcentaje frente al precio (FT-STK-02).
 * Usa aritmética Decimal para evitar errores de redondeo de punto flotante (RNF-CAP-011).
 */
export function calcularCostoYMargen(
  costoTotal: number | Prisma.Decimal | null | undefined,
  precioVenta: number | Prisma.Decimal,
): CalculoCostoMargen {
  if (costoTotal === null || costoTotal === undefined) {
    return {
      costo: null,
      margenSoles: null,
      margenPorcentaje: null,
      tieneReceta: false,
    };
  }

  const decCosto = new Prisma.Decimal(costoTotal);
  const decPrecio = new Prisma.Decimal(precioVenta);

  const costoRedondeado = decCosto.toDecimalPlaces(2);
  const margenSoles = decPrecio.minus(costoRedondeado).toDecimalPlaces(2);

  let margenPorcentaje = 0;
  if (decPrecio.greaterThan(0)) {
    margenPorcentaje = Number(
      margenSoles.dividedBy(decPrecio).times(100).toDecimalPlaces(1).toString(),
    );
  }

  return {
    costo: Number(costoRedondeado.toString()),
    margenSoles: Number(margenSoles.toString()),
    margenPorcentaje,
    tieneReceta: true,
  };
}

/**
 * Convierte una cantidad de cualquier unidad a la unidad de almacén según factores del insumo.
 */
export function convertirAUnidadAlmacen(
  cantidad: number,
  unidad: 'compra' | 'almacen' | 'receta' | string = 'almacen',
  factorCompra: number | Prisma.Decimal,
  factorReceta: number | Prisma.Decimal,
): number {
  const fCompra = Number(factorCompra) || 1;
  const fReceta = Number(factorReceta) || 1;

  if (unidad === 'compra') {
    return Math.round(cantidad * fCompra * 1000) / 1000;
  }
  if (unidad === 'receta') {
    return Math.round((cantidad / fReceta) * 1000) / 1000;
  }
  return Math.round(cantidad * 1000) / 1000;
}
