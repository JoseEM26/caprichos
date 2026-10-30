/**
 * Genera una CLAVE INICIAL para una cuenta del sistema por DNI (mismo procedimiento que el admin
 * «Restablecer clave»): hash argon2id, debe_cambiar=true, sesiones revocadas, auditoría.
 * La clave se muestra UNA vez en la terminal del operador y no se guarda en claro.
 * Sirve para el primer administrador tras importar (la importación crea cuentas con clave aleatoria).
 *
 *   ENTORNO_DATOS=demo DATABASE_URL=... pnpm datos:clave-inicial --dni=12345678 --confirmar="GENERAR CLAVE INICIAL"
 */
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Cliente } from './motor';
import { leerEntornoDatos, validarDestinoDatos, EntornoDatos } from './guardas';

export const FRASE_CLAVE_INICIAL = 'GENERAR CLAVE INICIAL';

/** Igual que generarClaveAleatoria de usuarios (la imagen de producción no incluye src/). */
function claveAleatoria(longitud: number): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = crypto.randomBytes(longitud);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

export async function generarClaveInicial(db: Cliente, dni: string): Promise<string> {
  if (!/^\d{8}$/.test(dni)) throw new Error('El DNI debe tener 8 dígitos.');
  const doc = await db.partyIdentifier.findFirst({ where: { tipo: 'DNI', numero: dni } });
  if (!doc) throw new Error(`No hay persona con DNI ${dni.slice(0, 5)}***.`);
  const cuenta = await db.userAccount.findUnique({ where: { party_id: doc.party_id } });
  if (!cuenta) throw new Error(`La persona con DNI ${dni.slice(0, 5)}*** no tiene cuenta de sistema.`);
  const clave = claveAleatoria(12);
  const hash = await argon2.hash(clave, { type: argon2.argon2id });
  await db.$transaction(async (tx: Cliente) => {
    await tx.userAccount.update({ where: { id: cuenta.id }, data: { hash, debe_cambiar: true } });
    await tx.sesion.updateMany({ where: { party_id: cuenta.party_id, revocada_en: null }, data: { revocada_en: new Date() } });
    await tx.auditoria.create({
      data: {
        categoria: 'CAMBIO', modulo: 'usuarios', accion: 'RESTABLECER_CLAVE', resultado: 'OK',
        entidad: 'user_account', entidad_id: cuenta.id, motivo: 'Clave inicial generada por operador (datos:clave-inicial)',
        despues: { debeCambiar: true, dni: `${dni.slice(0, 5)}***` },
      },
    });
  });
  return clave;
}

async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  if (val('confirmar') !== FRASE_CLAVE_INICIAL) {
    throw new Error(`Falta --confirmar="${FRASE_CLAVE_INICIAL}" (literal). No se hizo nada.`);
  }
  const entorno: EntornoDatos = leerEntornoDatos(env.ENTORNO_DATOS, 'importar', env);
  validarDestinoDatos(entorno, env.DATABASE_URL);
  const dni = val('dni') ?? '';
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    const clave = await generarClaveInicial(db, dni);
    console.log(`Clave inicial para DNI ${dni.slice(0, 5)}*** (se muestra una sola vez): ${clave}`);
    console.log('Al entrar, el sistema pedirá cambiarla.');
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main(process.argv.slice(2), process.env).catch((e) => {
    console.error(`ABORTADO: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
