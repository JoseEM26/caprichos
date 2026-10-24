import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Caracteres seguros sin ambigüedades visuales (evita 0, O, 1, l, I)
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz!@#$%&*';

function generarClaveSegura16(): string {
  const bytes = crypto.randomBytes(16);
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += CHARSET[bytes[i] % CHARSET.length];
  }
  return res;
}

interface DefinicionUsuarioDemo {
  rol: string;
  dni: string;
  nombres: string;
  apellidos: string;
}

const USUARIOS_DEMO: DefinicionUsuarioDemo[] = [
  { rol: 'ADMIN', dni: '10000001', nombres: 'Administrador', apellidos: 'Principal' },
  { rol: 'CAJERO', dni: '10000002', nombres: 'Cajero', apellidos: 'Turno' },
  { rol: 'MOZO', dni: '10000003', nombres: 'Mozo', apellidos: 'Salon' },
  { rol: 'COCINA', dni: '10000004', nombres: 'Cocinero', apellidos: 'Jefe' },
  { rol: 'ALMACEN', dni: '10000005', nombres: 'Almacenero', apellidos: 'Central' },
  { rol: 'REPARTIDOR', dni: '10000006', nombres: 'Repartidor', apellidos: 'Motorizado' },
];

export async function main() {
  const credencialesGeneradas: Array<{
    rol: string;
    dni: string;
    nombreCompleto: string;
    clave: string;
  }> = [];

  for (const u of USUARIOS_DEMO) {
    const clave = generarClaveSegura16();
    const hash = await argon2.hash(clave, { type: argon2.argon2id });

    await prisma.$transaction(async (tx) => {
      // 1. Buscar identificador existente o crearlo
      let idRegistro = await tx.partyIdentifier.findUnique({
        where: {
          tipo_numero: {
            tipo: 'DNI',
            numero: u.dni,
          },
        },
        include: {
          party: {
            include: { usuario: true },
          },
        },
      });

      let partyId: bigint;

      if (idRegistro) {
        partyId = idRegistro.party_id;
        // Actualizar nombres si es necesario
        await tx.person.upsert({
          where: { party_id: partyId },
          update: { nombres: u.nombres, apellidos: u.apellidos },
          create: { party_id: partyId, nombres: u.nombres, apellidos: u.apellidos },
        });

        // Actualizar cuenta de usuario con nueva contraseña y forzar cambio
        await tx.userAccount.upsert({
          where: { party_id: partyId },
          update: {
            rol: u.rol,
            hash,
            debe_cambiar: true,
            activo: true,
          },
          create: {
            party_id: partyId,
            rol: u.rol,
            hash,
            debe_cambiar: true,
            activo: true,
          },
        });
      } else {
        // Crear Party nuevo
        const party = await tx.party.create({
          data: {
            tipo: 'PERSONA',
            estado: 'ACTIVO',
          },
        });
        partyId = party.id;

        await tx.person.create({
          data: {
            party_id: partyId,
            nombres: u.nombres,
            apellidos: u.apellidos,
          },
        });

        await tx.partyIdentifier.create({
          data: {
            party_id: partyId,
            tipo: 'DNI',
            numero: u.dni,
          },
        });

        await tx.userAccount.create({
          data: {
            party_id: partyId,
            rol: u.rol,
            hash,
            debe_cambiar: true,
            activo: true,
          },
        });
      }
    });

    credencialesGeneradas.push({
      rol: u.rol,
      dni: u.dni,
      nombreCompleto: `${u.nombres} ${u.apellidos}`,
      clave,
    });
  }

  // Imprimir resumen en formato tabla una sola vez
  console.log('\n========================================================================================');
  console.log('              CAPRICHOS — CREDENCIALES DE DEMOSTRACIÓN (MOSTRADAS UNA SOLA VEZ)');
  console.log('========================================================================================');
  console.log(
    '  ' +
      'ROL'.padEnd(12) +
      'DNI'.padEnd(12) +
      'NOMBRE'.padEnd(26) +
      'CONTRASEÑA TEMPORAL (16 CAR.)'.padEnd(30) +
      'CAMBIO OBLIG.',
  );
  console.log('----------------------------------------------------------------------------------------');

  for (const c of credencialesGeneradas) {
    console.log(
      '  ' +
        c.rol.padEnd(12) +
        c.dni.padEnd(12) +
        c.nombreCompleto.padEnd(26) +
        c.clave.padEnd(30) +
        'Sí (debeCambiar=true)',
    );
  }

  console.log('========================================================================================');
  console.log('  AVISO IMPORTANTE DE SEGURIDAD:');
  console.log('  1. Estas contraseñas fueron generadas de forma aleatoria con OpenSSL/crypto.');
  console.log('  2. NUNCA se guardan en archivos del servidor, ni en el repositorio, ni en logs.');
  console.log('  3. Cópielas en un lugar seguro ahora mismo.');
  console.log('  4. Al iniciar sesión en https://<dominio>/admin, el sistema forzará el cambio.');
  console.log('========================================================================================\n');
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Error al generar usuarios de demostración:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
