import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Una persona = un party: un celular activo (TELEFONO o WHATSAPP) pertenece a un solo party (índice único en la BD). */
export const TIPOS_CELULAR = ['TELEFONO', 'WHATSAPP'] as const;

export const CELULAR_OTRA_PERSONA = {
  codigo: 'CELULAR_DUPLICADO',
  mensaje: 'Ese celular ya esta registrado en otra persona',
};

type Db = Pick<Prisma.TransactionClient, 'contactMechanism'>;

const variantes = (celular9: string) => [celular9, `51${celular9}`];

/** Party que ya tiene ese celular como contacto activo (cualquier tipo de celular), o null. */
export async function partyDeCelular(db: Db, celular9: string): Promise<bigint | null> {
  const contacto = await db.contactMechanism.findFirst({
    where: { tipo: { in: [...TIPOS_CELULAR] }, valor: { in: variantes(celular9) }, activo: true },
    select: { party_id: true },
  });
  return contacto?.party_id ?? null;
}

/** true si el celular está activo en otro party distinto de partyId. */
export async function celularDeOtraPersona(db: Db, partyId: bigint, celular9: string): Promise<boolean> {
  const filas = await db.contactMechanism.findMany({
    where: { tipo: { in: [...TIPOS_CELULAR] }, valor: { in: variantes(celular9) }, activo: true },
    select: { party_id: true },
  });
  return filas.some((f) => f.party_id !== partyId);
}

/**
 * Deja el celular como contacto activo del party. Si ya es suyo lo reutiliza (y si era TELEFONO y ahora es
 * WHATSAPP lo convierte, para no tener dos filas iguales del mismo party). Si es de otra persona: 409.
 */
export async function asegurarContactoCelular(
  db: Db,
  partyId: bigint,
  celular9: string,
  tipo: 'TELEFONO' | 'WHATSAPP',
): Promise<void> {
  if (await celularDeOtraPersona(db, partyId, celular9)) {
    throw new ConflictException(CELULAR_OTRA_PERSONA);
  }
  const propia = await db.contactMechanism.findFirst({
    where: { party_id: partyId, tipo: { in: [...TIPOS_CELULAR] }, valor: { in: variantes(celular9) }, activo: true },
  });
  if (!propia) {
    await db.contactMechanism.create({ data: { party_id: partyId, tipo, valor: celular9, principal: true, activo: true } });
  } else if (tipo === 'WHATSAPP' && propia.tipo === 'TELEFONO') {
    await db.contactMechanism.update({ where: { id: propia.id }, data: { tipo: 'WHATSAPP' } });
  }
}
