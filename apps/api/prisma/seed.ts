import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { sembrarRolesYPermisos } from './sembrar-roles';

const prisma = new PrismaClient();

const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';

function generarClaveAleatoria(longitud = 12): string {
  let clave = '';
  const bytes = crypto.randomBytes(longitud);
  for (let i = 0; i < longitud; i++) {
    clave += CARACTERES[bytes[i] % CARACTERES.length];
  }
  return clave;
}

export async function main() {
  const dniAdmin = process.env.SEED_ADMIN_DNI;
  if (!dniAdmin || !/^\d{8}$/.test(dniAdmin)) {
    throw new Error('La variable de entorno SEED_ADMIN_DNI es obligatoria y debe tener exactamente 8 dígitos numéricos.');
  }

  // 1-3. Roles, permisos y matriz (compartido con crear-admin-demo.ts)
  await sembrarRolesYPermisos(prisma);

  // 4. Crear Admin si no existe
  const adminExistente = await prisma.userAccount.findFirst({
    where: { rol: 'ADMIN' },
  });

  const dniExistente = await prisma.partyIdentifier.findUnique({
    where: {
      tipo_numero: {
        tipo: 'DNI',
        numero: dniAdmin,
      },
    },
    include: {
      party: {
        include: {
          usuario: true,
        },
      },
    },
  });

  if (adminExistente || dniExistente?.party?.usuario) {
    console.log('El usuario administrador ya existe. Se mantuvieron las credenciales existentes.');
    return;
  }

  const claveGenerada = generarClaveAleatoria(12);
  const hash = await argon2.hash(claveGenerada, { type: argon2.argon2id });

  await prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        tipo: 'PERSONA',
        estado: 'ACTIVO',
      },
    });

    await tx.person.create({
      data: {
        party_id: party.id,
        nombres: 'Administrador',
        apellidos: 'Principal',
      },
    });

    await tx.partyIdentifier.create({
      data: {
        party_id: party.id,
        tipo: 'DNI',
        numero: dniAdmin,
      },
    });

    await tx.userAccount.create({
      data: {
        party_id: party.id,
        rol: 'ADMIN',
        hash,
        debe_cambiar: true,
        activo: true,
      },
    });
  });

  // Imprimir contraseña UNA sola vez por consola y no guardarla en archivos
  console.log('=== CREDENCIALES DEL ADMINISTRADOR INICIAL ===');
  console.log(`DNI: ${dniAdmin}`);
  console.log(`Contraseña: ${claveGenerada}`);
  console.log('NOTA: Esta contraseña se muestra una sola vez y no ha sido guardada en archivos.');
  console.log('==============================================');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
