import { PrismaService } from '../../comun/prisma/prisma.service';

/** Marca de la cuenta «Pago en línea» (rol ADMIN, inactiva, sin contraseña válida): nadie puede iniciar sesión con ella. */
export const HASH_CUENTA_PAGO_EN_LINEA = '!pago-en-linea-sin-acceso';

/** Cuenta «Pago en línea» (la crea la migración): quien figura cobrando en línea y anulando por falta de pago. */
export async function usuarioSistema(prisma: PrismaService): Promise<{ partyId: bigint; rol: string; roles: string[] }> {
  const c = await prisma.userAccount.findFirst({ where: { hash: HASH_CUENTA_PAGO_EN_LINEA }, select: { party_id: true }, orderBy: { id: 'asc' } });
  if (!c) throw new Error('Falta la cuenta «Pago en línea» (migración 20270303100000_pagos_online)');
  return { partyId: c.party_id, rol: 'ADMIN', roles: ['ADMIN'] };
}
