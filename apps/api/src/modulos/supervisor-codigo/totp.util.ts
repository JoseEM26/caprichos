import * as crypto from 'crypto';

/**
 * Deriva una clave de 32 bytes (256 bits) para cifrado AES-256-GCM
 * usando HKDF-SHA256 a partir de SUPERVISOR_CLAVE_CIFRADO o JWT_SECRET.
 */
export function derivarClaveCifrado(fuenteClave?: string): Buffer {
  const secreto =
    process.env.SUPERVISOR_CLAVE_CIFRADO ||
    fuenteClave ||
    process.env.JWT_SECRET ||
    'secreto-dev-cambiar';

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
 * Cifra el secreto de 20 bytes usando AES-256-GCM.
 * Retorna el texto cifrado, el IV (12 bytes) y el Auth Tag (16 bytes) en Base64.
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
 * - Algoritmo HMAC-SHA1
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
 * Compara dos cadenas de 6 caracteres en tiempo constante usando crypto.timingSafeEqual.
 */
export function compararEnTiempoConstante(codigo1: string, codigo2: string): boolean {
  if (typeof codigo1 !== 'string' || typeof codigo2 !== 'string') return false;
  if (codigo1.length !== 6 || codigo2.length !== 6) return false;
  return crypto.timingSafeEqual(Buffer.from(codigo1, 'utf-8'), Buffer.from(codigo2, 'utf-8'));
}

/**
 * Calcula cuántos segundos restan en la ventana de 30 segundos actual.
 */
export function calcularSegundosRestantes(
  timestampSegundos: number = Math.floor(Date.now() / 1000),
): number {
  const paso = 30;
  const resto = timestampSegundos % paso;
  return paso - resto;
}
