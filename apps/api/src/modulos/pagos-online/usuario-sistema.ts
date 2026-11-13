import { PrismaService } from '../../comun/prisma/prisma.service';

/** Cuenta de sistema «Pago en línea» (la crea la migración): quien figura cobrando y anulando por falta de pago. */
export async function usuarioSistema(prisma: PrismaService): Promise<{ partyId: bigint; rol: string; roles: string[] }> {
  const c = await prisma.userAccount.findFirst({ where: { rol: 'SISTEMA' }, select: { party_id: true }, orderBy: { id: 'asc' } });
  if (!c) throw new Error('Falta el usuario de sistema «Pago en línea» (migración 20270303100000_pagos_online)');
  // rol SISTEMA: sin permisos propios; los servicios que exigen ADMIN no lo aceptan
  return { partyId: c.party_id, rol: 'SISTEMA', roles: ['SISTEMA'] };
}
