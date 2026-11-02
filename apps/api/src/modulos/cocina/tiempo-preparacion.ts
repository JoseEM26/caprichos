import { PrismaService } from '../../comun/prisma/prisma.service';

/** Ventana móvil de días para el promedio de preparación (igual que las opciones menos pedidas). */
export const VENTANA_DIAS_PREPARACION = 30;
/** Tiempo que el promedio de cada producto vive en memoria antes de volver a contar. */
export const TTL_PREPARACION_MS = 10 * 60 * 1000;
/** Parámetro (Configuración › Cocina) para los productos sin datos: entero 1–120. */
export const CLAVE_MINUTOS_DEFECTO = 'cocina_minutos_preparacion_defecto';
export const MINUTOS_DEFECTO = 10;
/** Pedidos que no cuentan: se anularon o se rechazaron. */
const ESTADOS_NO_CONTADOS = ['ANULADO', 'RECHAZADO'];

/** Promedio de minutos por producto (solo los que tienen datos) y el defecto para el resto. */
export interface TiemposPreparacion {
  porProducto: Map<string, number>;
  defectoMin: number;
}

interface EntradaCache {
  expira: number;
  /** null: el producto no tiene datos en la ventana. */
  minutos: number | null;
}

// ponytail: caché en memoria de un solo proceso; con varias instancias cada una cuenta por su cuenta (sin Redis)
const cache = new Map<string, EntradaCache>();

/** Valor del parámetro de defecto; cualquier cosa fuera de 1–120 cae al defecto de fábrica. */
export function minutosPreparacionDefecto(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : MINUTOS_DEFECTO;
}

/**
 * Promedio (minutos enteros, mínimo 1) de «listo» menos «llegó a cocina» de las líneas de cada producto
 * en los últimos 30 días. Llegada = la de la comanda de su área, o la del pedido si no hay comanda.
 */
export async function promedioPreparacionPorProducto(
  prisma: PrismaService,
  productoIds: string[],
  ahora: Date,
): Promise<Map<string, number | null>> {
  const resultado = new Map<string, number | null>();
  const faltantes: string[] = [];
  for (const id of new Set(productoIds)) {
    const guardado = cache.get(id);
    if (guardado && guardado.expira > ahora.getTime()) resultado.set(id, guardado.minutos);
    else faltantes.push(id);
  }
  if (faltantes.length === 0) return resultado;

  const desde = new Date(ahora.getTime() - VENTANA_DIAS_PREPARACION * 24 * 60 * 60 * 1000);
  const filas = await prisma.pedidoLinea.findMany({
    where: {
      producto_id: { in: faltantes.map((id) => BigInt(id)) },
      listo_en: { gte: desde },
      pedido: { estado: { notIn: ESTADOS_NO_CONTADOS } },
    },
    select: {
      producto_id: true,
      area_id: true,
      listo_en: true,
      producto: { select: { categoria: { select: { area_id: true } } } },
      pedido: {
        select: {
          creado_en: true,
          comandas: { select: { area_id: true, llego_en: true } },
        },
      },
    },
  });

  const muestras = new Map<string, number[]>();
  for (const f of filas) {
    if (!f.listo_en || f.producto_id === null) continue;
    const area = f.area_id ?? f.producto?.categoria?.area_id ?? null;
    const comanda = area !== null ? f.pedido.comandas.find((c) => c.area_id === area) : undefined;
    const llegada = comanda?.llego_en ?? f.pedido.creado_en;
    const minutos = (new Date(f.listo_en).getTime() - new Date(llegada).getTime()) / 60000;
    if (minutos <= 0) continue;
    const id = String(f.producto_id);
    muestras.set(id, [...(muestras.get(id) ?? []), minutos]);
  }

  for (const id of faltantes) {
    const lista = muestras.get(id);
    const minutos = lista?.length
      ? Math.max(1, Math.round(lista.reduce((s, m) => s + m, 0) / lista.length))
      : null;
    cache.set(id, { expira: ahora.getTime() + TTL_PREPARACION_MS, minutos });
    resultado.set(id, minutos);
  }
  return resultado;
}

/** Tiempos de preparación para los productos dados, con el defecto del parámetro. */
export async function tiemposPreparacion(
  prisma: PrismaService,
  productoIds: string[],
  ahora: Date = new Date(),
): Promise<TiemposPreparacion> {
  const promedios = await promedioPreparacionPorProducto(prisma, productoIds, ahora);
  let valorDefecto: unknown;
  try {
    valorDefecto = (await prisma.parametro.findUnique({ where: { clave: CLAVE_MINUTOS_DEFECTO } }))?.valor;
  } catch {
    // sin parámetro legible: el defecto de fábrica (como obtenerUmbrales)
  }
  const porProducto = new Map<string, number>();
  for (const [id, minutos] of promedios) if (minutos !== null) porProducto.set(id, minutos);
  return { porProducto, defectoMin: minutosPreparacionDefecto(valorDefecto) };
}
