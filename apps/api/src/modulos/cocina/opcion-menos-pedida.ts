import { PrismaService } from '../../comun/prisma/prisma.service';

/** Ventana móvil de días que se cuentan las elecciones (cruza de mes: nunca empieza de cero). */
export const VENTANA_DIAS_MENOS_PEDIDA = 30;
/** Tiempo que el resultado por producto vive en memoria antes de volver a contar. */
export const TTL_MENOS_PEDIDA_MS = 10 * 60 * 1000;
/** Pedidos que no cuentan: se anularon o se rechazaron. */
const ESTADOS_NO_CONTADOS = ['ANULADO', 'RECHAZADO'];

interface EntradaCache {
  expira: number;
  marcadas: Set<string>;
}

// ponytail: caché en memoria de un solo proceso; con varias instancias cada una cuenta por su cuenta (sin Redis)
const cache = new Map<string, EntradaCache>();

/**
 * Las opciones menos pedidas de un grupo: todas las que tienen el conteo mínimo (si varias empatan, se resaltan
 * todas; si nadie la eligió, el mínimo es 0 y cuentan todas las activas). Un grupo con menos de dos opciones
 * no tiene con qué comparar: devuelve lista vacía. `opcionesEnOrden` trae los ids de las opciones activas.
 */
export function opcionesMenosPedidas(opcionesEnOrden: string[], conteos: Map<string, number>): string[] {
  if (opcionesEnOrden.length < 2) return [];
  const cuenta = opcionesEnOrden.map((id) => conteos.get(id) ?? 0);
  const minimo = Math.min(...cuenta);
  return opcionesEnOrden.filter((_, i) => cuenta[i] === minimo);
}

/** Ids de las opciones marcadas para un producto: las menos pedidas de cada grupo con al menos dos opciones. */
export function marcadasDeGrupos(gruposEnOrden: string[][], conteos: Map<string, number>): Set<string> {
  const marcadas = new Set<string>();
  for (const opciones of gruposEnOrden) {
    for (const id of opcionesMenosPedidas(opciones, conteos)) marcadas.add(id);
  }
  return marcadas;
}

/** Quita el resultado guardado de un producto (o de todos) para que el próximo cálculo sea fresco. */
export function invalidarOpcionesMenosPedida(productoId?: bigint | string | number): void {
  if (productoId === undefined) cache.clear();
  else cache.delete(String(productoId));
}

/** Cuenta, para un producto, las elecciones de sus opciones en los últimos 30 días. Sin el check encendido no cuenta nada. */
async function calcularParaProducto(prisma: PrismaService, productoId: string, ahora: Date): Promise<Set<string>> {
  const producto = await prisma.producto.findUnique({
    where: { id: BigInt(productoId) },
    select: { resaltar_opcion_menos_pedida: true },
  });
  if (!producto?.resaltar_opcion_menos_pedida) return new Set();

  const grupos = await prisma.productoGrupo.findMany({
    where: { producto_id: BigInt(productoId) },
    orderBy: { orden: 'asc' },
    select: {
      grupo: {
        select: {
          opciones: {
            where: { activo: true },
            orderBy: [{ valor: { orden: 'asc' } }, { id: 'asc' }],
            select: { id: true },
          },
        },
      },
    },
  });

  const gruposEnOrden: string[][] = grupos.map((pg: any) =>
    (pg.grupo?.opciones ?? []).map((o: any) => o.id.toString()),
  );
  const todasLasOpciones = gruposEnOrden.flat();
  if (todasLasOpciones.length === 0) return new Set();

  const desde = new Date(ahora.getTime() - VENTANA_DIAS_MENOS_PEDIDA * 24 * 60 * 60 * 1000);
  // Una sola consulta agregada por producto: elecciones de sus opciones en pedidos vigentes de la ventana
  const filas = await prisma.pedidoLineaOpcion.groupBy({
    by: ['opcion_id'],
    where: {
      opcion_id: { in: todasLasOpciones.map((id) => BigInt(id)) },
      pedido_linea: {
        producto_id: BigInt(productoId),
        pedido: {
          creado_en: { gte: desde },
          estado: { notIn: ESTADOS_NO_CONTADOS },
        },
      },
    },
    _count: { _all: true },
  });

  const conteos = new Map<string, number>();
  for (const f of filas) {
    if (f.opcion_id !== null && f.opcion_id !== undefined) {
      conteos.set(String(f.opcion_id), Number(f._count?._all ?? 0));
    }
  }
  return marcadasDeGrupos(gruposEnOrden, conteos);
}

/**
 * Para cada producto pedido, el conjunto de ids de opciones marcadas como «menos pedida».
 * Usa la caché de 10 minutos; solo cuenta los productos que no están guardados o venció su tiempo.
 */
export async function opcionesMenosPedidasPorProducto(
  prisma: PrismaService,
  productoIds: string[],
  ahora: Date = new Date(),
): Promise<Map<string, Set<string>>> {
  const resultado = new Map<string, Set<string>>();
  for (const id of new Set(productoIds)) {
    const guardado = cache.get(id);
    if (guardado && guardado.expira > ahora.getTime()) {
      resultado.set(id, guardado.marcadas);
      continue;
    }
    const marcadas = await calcularParaProducto(prisma, id, ahora);
    cache.set(id, { expira: ahora.getTime() + TTL_MENOS_PEDIDA_MS, marcadas });
    resultado.set(id, marcadas);
  }
  return resultado;
}
