import * as crypto from 'crypto';
import { execSync } from 'child_process';
import type { PrismaClient } from '@prisma/client';

/**
 * Deriva una clave de 32 bytes (256 bits) para cifrado AES-256-GCM
 * usando HKDF-SHA256 a partir de SUPERVISOR_CLAVE_CIFRADO o JWT_SECRET.
 */
export function derivarClaveCifrado(fuenteClave?: string): Buffer {
  const secreto =
    process.env.SUPERVISOR_CLAVE_CIFRADO ||
    fuenteClave ||
    process.env.JWT_SECRET ||
    'secreto-test-jwt-super-seguro-min-32-chars!!';

  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(secreto, 'utf-8'),
      Buffer.from('caprichos-supervisor-salt', 'utf-8'),
      Buffer.from('supervisor-totp-encryption', 'utf-8'),
      32,
    ),
  );
}

/**
 * Cifra un secreto de 20 bytes usando AES-256-GCM.
 */
export function cifrarSecreto(
  secreto: Buffer,
  claveDerivada: Buffer,
): { secretoCifrado: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', claveDerivada, iv);
  const cifrado = Buffer.concat([cipher.update(secreto), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    secretoCifrado: cifrado.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Descifra el secreto cifrado con AES-256-GCM usando la clave derivada, IV y Auth Tag.
 */
export function descifrarSecreto(
  secretoCifrado: string,
  iv: string,
  tag: string,
  claveDerivada: Buffer,
): Buffer {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    claveDerivada,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secretoCifrado, 'base64')),
    decipher.final(),
  ]);
}

/**
 * Calcula el código TOTP según RFC 6238:
 * - HMAC-SHA1
 * - Paso de tiempo: 30 segundos
 * - 6 dígitos numéricos
 */
export function generarTotp(
  secreto: Buffer,
  timestampSegundos: number = Math.floor(Date.now() / 1000),
): string {
  const paso = 30;
  const contador = Math.floor(timestampSegundos / paso);
  const bufferContador = Buffer.alloc(8);
  bufferContador.writeBigInt64BE(BigInt(contador));

  const hmac = crypto.createHmac('sha1', secreto).update(bufferContador).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codigoBinario =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = codigoBinario % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Helper para E2E:
 * Lee el secreto de la base de pruebas, lo descifra con la misma clave y calcula el código TOTP vigente.
 */
export async function obtenerCodigoSupervisorVigente(
  prisma: PrismaClient,
  localCodigo = 'CAPRICHOS',
): Promise<string> {
  const reg = await prisma.supervisorSecreto.findUnique({
    where: { local_codigo: localCodigo },
  });
  if (!reg) {
    throw new Error(`No se encontró secreto de supervisor para local ${localCodigo}`);
  }

  const claveDerivada = derivarClaveCifrado();
  const secretoBytes = descifrarSecreto(
    reg.secreto_cifrado,
    reg.iv,
    reg.tag,
    claveDerivada,
  );
  return generarTotp(secretoBytes);
}

/**
 * Limpia contadores de intentos y claves de anti-repetición de código supervisor en Redis.
 */
export function limpiarRedisSupervisor(slot = Number(process.env.E2E_SLOT || 0)) {
  const redisDb = 2 + slot;
  try {
    execSync(
      `docker exec caprichos-redis-dev redis-cli -n ${redisDb} --scan --pattern "pin:supervisor:*" | xargs -r docker exec -i caprichos-redis-dev redis-cli -n ${redisDb} del`,
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
    execSync(
      `docker exec caprichos-redis-dev redis-cli -n ${redisDb} --scan --pattern "supervisor:codigo:*" | xargs -r docker exec -i caprichos-redis-dev redis-cli -n ${redisDb} del`,
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
  } catch {
    // Ignorar si no hay claves
  }
}
