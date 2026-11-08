import { Prisma } from '@prisma/client';

export const LISTA_TAMANO = 'TAMANO';

/**
 * Id del valor de la lista TAMANO de un precio del combo. Con `tamanoValorId` se usa tal cual (herencia de las bebidas);
 * solo con nombre se busca el valor EXACTO de la lista TAMANO (sin `contains`: «Extra 20 oz» ya no cae en otro valor)
 * y si no existe se crea ahí, nunca en otra lista.
 */
export async function resolverTamanoValorId(
  tx: Prisma.TransactionClient,
  t: { tamanoValorId?: string | number | bigint | null; tamanoNombre?: string | null },
): Promise<bigint> {
  if (t.tamanoValorId) return BigInt(t.tamanoValorId);
  const nombre = (t.tamanoNombre ?? '').trim() || 'Único';
  const lista = await tx.lista.upsert({ where: { codigo: LISTA_TAMANO }, update: {}, create: { codigo: LISTA_TAMANO, nombre: 'Tamaños y presentaciones' } });
  const existente = await tx.listaValor.findFirst({ where: { lista_id: lista.id, nombre: { equals: nombre, mode: 'insensitive' } } });
  if (existente) return existente.id;
  const ultimo = await tx.listaValor.findFirst({ where: { lista_id: lista.id }, orderBy: { orden: 'desc' }, select: { orden: true } });
  return (await tx.listaValor.create({ data: { lista_id: lista.id, nombre, orden: (ultimo?.orden ?? 0) + 1, activo: true } })).id;
}
