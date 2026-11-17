import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { validarDestinos } from './reset/guardas';
import { sembrarRolesYPermisos } from './sembrar-roles';

/**
 * Administrador de PRUEBA de la DEMO (demo.caprichos.pe). Lo lanza infra/compose/scripts/crear-admin-demo.sh
 * dentro del contenedor api. La clave llega por CLAVE_DEMO_ADMIN y jamás se imprime ni se guarda.
 * Idempotente: si el DNI ya existe, cambia la clave, reactiva la cuenta y deja ADMIN. No toca otros usuarios.
 */

export const NOMBRES_ADMIN_DEMO = { nombres: 'Administrador de prueba', apellidos: 'Demo' };

/** Se niega fuera de la demo: AMBIENTE_DESPLIEGUE lo fija docker-compose.demo.yml; la base debe ser la de demo. */
export function exigirDemo(env: NodeJS.ProcessEnv): void {
  if (env.AMBIENTE_DESPLIEGUE !== 'demo') {
    throw new Error('Solo se crea en el ambiente DEMO (AMBIENTE_DESPLIEGUE=demo). Abortado.');
  }
  validarDestinos('demo', env.DATABASE_URL, env.REDIS_URL);
}

export async function crearAdminDemo(prisma: PrismaClient, dni: string, clave: string): Promise<'creado' | 'actualizado'> {
  const hash = await argon2.hash(clave, { type: argon2.argon2id });

  return prisma.$transaction(async (tx) => {
    const existente = await tx.partyIdentifier.findUnique({
      where: { tipo_numero: { tipo: 'DNI', numero: dni } },
      include: { party: { include: { usuario: true } } },
    });

    let partyId: bigint;
    if (existente) {
      partyId = existente.party_id;
      await tx.party.update({ where: { id: partyId }, data: { estado: 'ACTIVO' } });
    } else {
      const party = await tx.party.create({ data: { tipo: 'PERSONA', estado: 'ACTIVO' } });
      partyId = party.id;
      await tx.partyIdentifier.create({ data: { party_id: partyId, tipo: 'DNI', numero: dni } });
    }

    await tx.person.upsert({
      where: { party_id: partyId },
      update: NOMBRES_ADMIN_DEMO,
      create: { party_id: partyId, ...NOMBRES_ADMIN_DEMO },
    });

    // debe_cambiar=false: es una clave de prueba conocida; no se obliga a cambiarla al ingresar.
    const datos = { rol: 'ADMIN', hash, debe_cambiar: false, activo: true };
    if (existente?.party?.usuario) {
      await tx.userAccount.update({
        where: { id: existente.party.usuario.id },
        data: { ...datos, sesiones_cerradas_en: new Date() },
      });
      return 'actualizado';
    }
    await tx.userAccount.create({ data: { party_id: partyId, ...datos } });
    return 'creado';
  });
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  exigirDemo(env);
  const dni = env.DNI_ADMIN_DEMO ?? '';
  const clave = env.CLAVE_DEMO_ADMIN ?? '';
  if (!/^\d{8}$/.test(dni)) throw new Error('DNI_ADMIN_DEMO debe tener exactamente 8 dígitos.');
  if (clave.length < 8) throw new Error('Falta CLAVE_DEMO_ADMIN o tiene menos de 8 caracteres.');

  const prisma = new PrismaClient();
  try {
    await sembrarRolesYPermisos(prisma);
    await crearAdminDemo(prisma, dni, clave);
    console.log(`OK: administrador de prueba listo (DNI ${dni}).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(`ERROR: ${e instanceof Error ? e.message : 'fallo desconocido'}`);
    process.exit(1);
  });
}
