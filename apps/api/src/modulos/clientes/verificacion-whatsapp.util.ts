import { HttpException, HttpStatus } from '@nestjs/common';
import { createHmac, randomInt } from 'crypto';
import type { PrismaService } from '../../comun/prisma/prisma.service';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';

/*
 * VERIFICACIÓN DEL CELULAR: DOS MODOS (parámetro `verificacion_celular_modo`)
 *
 * WHATSAPP_ENTRANTE (por defecto, mientras Meta no apruebe las plantillas de código):
 *   La web muestra un botón «Abrir WhatsApp y enviar mensaje». El cliente escribe PRIMERO al número del
 *   negocio con un mensaje ya escrito que lleva un token de 8 caracteres. Como WhatsApp informa de qué número
 *   viene el mensaje, la llegada prueba que el celular es suyo. No hace falta plantilla de Meta.
 *
 * CODIGO_PLANTILLA (el anterior, conservado):
 *   El servidor envía un código de 6 dígitos por la plantilla de Meta CODIGO_CUENTA / CODIGO_RECUPERAR y el
 *   cliente lo escribe en la web. Requiere que las plantillas caprichos_codigo_cuenta y
 *   caprichos_codigo_recuperar estén APROBADAS en Meta.
 *   Para volver a este modo basta cambiar el parámetro `verificacion_celular_modo` a CODIGO_PLANTILLA.
 *
 * En los dos modos la verificación termina igual: se deja la marca `cliente:reg:ok:<celular>` (crear cuenta)
 * o `cliente:rec:ok:<celular>` (recuperar), que consumen registro y recuperar/confirmar.
 */

export const MODO_WHATSAPP_ENTRANTE = 'WHATSAPP_ENTRANTE';
export const MODO_CODIGO_PLANTILLA = 'CODIGO_PLANTILLA';
export type ModoVerificacion = typeof MODO_WHATSAPP_ENTRANTE | typeof MODO_CODIGO_PLANTILLA;

export const CLAVE_MODO_VERIFICACION = 'verificacion_celular_modo';
/** Número del negocio que recibe el mensaje (solo dígitos, con código de país). Vacío = WhatsApp de contacto del local. */
export const CLAVE_NUMERO_VERIFICACION = 'verificacion_whatsapp_numero';

export const TOKEN_TTL_SEG = 600; // vence a los 10 minutos
/** La marca «celular verificado» dura más que el token: da tiempo a llenar el formulario de datos. */
export const MARCA_TTL_SEG = 1800;
export const TOKEN_MAX_INTENTOS = 5; // mensajes con otro celular antes de invalidar el token
/** 8 caracteres sin 0, 1, I, L, O (se confunden al leerlos). 31^8 combinaciones. */
export const TOKEN_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const TEXTO_MENSAJE_VERIFICACION = (token: string) => `Hola Caprichos, quiero verificar mi celular. Mi código: ${token}`;
export const RESPUESTA_NO_VERIFICADO = 'No pudimos verificar este código. Vuelve a la carta y pide uno nuevo.';
export const RESPUESTA_VERIFICADO = 'Listo ✅ ya verificamos tu celular. Vuelve a la carta para continuar.';

/** Lo mínimo que se usa de Redis (ioredis lo cumple). */
export interface RedisVerificacion {
  get(clave: string): Promise<string | null>;
  set(clave: string, valor: string, modo: 'EX', segundos: number): Promise<unknown>;
  incr(clave: string): Promise<number>;
  expire(clave: string, segundos: number): Promise<unknown>;
  del(...claves: string[]): Promise<unknown>;
}

export type EstadoVerificacion = 'pendiente' | 'verificado' | 'vencido' | 'sin_numero';
export type PropositoVerificacion = 'REGISTRO' | 'RECUPERAR';

export interface RespuestaVerificacionWhatsapp {
  ok: true;
  modo: typeof MODO_WHATSAPP_ENTRANTE;
  token: string;
  /** Enlace wa.me con el mensaje ya escrito. En computadora abre WhatsApp Web: es lo esperado. */
  enlace: string;
  vence_seg: number;
  mensaje: string;
}

/** Secreto para el HMAC de los tokens y códigos (el mismo que usan los códigos de 6 dígitos). */
export const secretoVerificacion = (config: { get<T>(clave: string, defecto: T): T }): string =>
  config.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');

export const verificacionNoDisponible = () =>
  new HttpException(
    {
      codigo: 'VERIFICACION_NO_DISPONIBLE',
      mensaje: 'La verificación del celular no está disponible en este momento. Intenta más tarde.',
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );

/** Parámetro de la tabla `parametro` (null si no existe). */
async function leerParametro(prisma: PrismaService, clave: string): Promise<unknown> {
  return (await prisma.parametro.findUnique({ where: { clave } }))?.valor ?? null;
}

/** Sin fila en `parametro`, vale WHATSAPP_ENTRANTE (el modo por defecto). */
export async function modoVerificacion(prisma: PrismaService): Promise<ModoVerificacion> {
  return (await leerParametro(prisma, CLAVE_MODO_VERIFICACION)) === MODO_CODIGO_PLANTILLA
    ? MODO_CODIGO_PLANTILLA
    : MODO_WHATSAPP_ENTRANTE;
}

/** Variable de entorno opcional del número que recibe la verificación (la define el despliegue de la demo). */
export const VARIABLE_NUMERO_VERIFICACION = 'VERIFICACION_WHATSAPP_NUMERO';

/**
 * Número al que el cliente escribe, con código de país (p. ej. 51914244077). Orden:
 *  1. parámetro `verificacion_whatsapp_numero` si está bien escrito;
 *  2. variable de entorno VERIFICACION_WHATSAPP_NUMERO (la demo apunta aquí a su número de prueba de Meta);
 *  3. WhatsApp de contacto del local (Configuración › Mi local › Contacto).
 * Null si no hay ninguno válido.
 */
export async function numeroVerificacion(prisma: PrismaService, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const aNumero = (bruto: unknown): string | null => {
    const n = normalizarCelularPeru(String(bruto ?? ''));
    return n.valido && n.celular9 ? `51${n.celular9}` : null;
  };
  const propio = aNumero(await leerParametro(prisma, CLAVE_NUMERO_VERIFICACION));
  if (propio) return propio;
  const deEntorno = aNumero(env[VARIABLE_NUMERO_VERIFICACION]);
  if (deEntorno) return deEntorno;
  return aNumero(((await leerParametro(prisma, 'local_datos')) as { whatsapp?: unknown } | null)?.whatsapp);
}

export function generarToken(): string {
  let token = '';
  for (let i = 0; i < 8; i++) token += TOKEN_ALFABETO[randomInt(TOKEN_ALFABETO.length)];
  return token;
}

/** En Redis solo vive el HMAC del token: nunca el token en claro. */
const claveToken = (token: string, secreto: string, tipo: 'tok' | 'int' = 'tok') =>
  `cliente:wa:${tipo}:${createHmac('sha256', secreto).update(token).digest('hex')}`;

/** Marca que consumen registro (crear cuenta) y recuperar/confirmar. Misma clave que deja el código de 6 dígitos. */
export const claveMarcaVerificacion = (proposito: PropositoVerificacion, tel9: string) =>
  proposito === 'REGISTRO' ? `cliente:reg:ok:${tel9}` : `cliente:rec:ok:${tel9}`;

/** Crea el token de un solo uso ligado al celular que lo pide. Valor guardado: «celular|propósito|P» (P pendiente, V verificado). */
export async function iniciarVerificacion(
  redis: RedisVerificacion,
  secreto: string,
  tel9: string,
  proposito: PropositoVerificacion,
): Promise<string> {
  const token = generarToken();
  await redis.set(claveToken(token, secreto), `${tel9}|${proposito}|P`, 'EX', TOKEN_TTL_SEG);
  return token;
}

export function respuestaWhatsappEntrante(numero: string, token: string, mensaje: string): RespuestaVerificacionWhatsapp {
  return {
    ok: true,
    modo: MODO_WHATSAPP_ENTRANTE,
    token,
    enlace: `https://wa.me/${numero}?text=${encodeURIComponent(TEXTO_MENSAJE_VERIFICACION(token))}`,
    vence_seg: TOKEN_TTL_SEG,
    mensaje,
  };
}

/** Lo que mira la web cada 2 s. Nunca revela celulares: solo el estado del token. */
export async function estadoVerificacion(redis: RedisVerificacion, secreto: string, token: string): Promise<EstadoVerificacion> {
  const t = String(token ?? '').trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(t)) return 'vencido';
  const valor = await redis.get(claveToken(t, secreto));
  if (!valor) return 'vencido';
  if (valor.endsWith('|V')) return 'verificado';
  // S: WhatsApp no mostró el número del remitente; la web pasa al código de 6 dígitos
  return valor.endsWith('|S') ? 'sin_numero' : 'pendiente';
}

/**
 * Texto tal como llega de WhatsApp para buscar el token: NFC, sin caracteres de ancho cero y con los espacios raros
 * (no separable, fino, ideográfico...) convertidos en espacio normal. Un espacio no estándar no debe ocultar el token.
 */
export const normalizarTextoVerificacion = (texto: string): string =>
  String(texto ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

/** Busca «Mi código: TOKEN» en el mensaje (8 caracteres alfanuméricos). */
// Tolera espacio antes de los dos puntos ("código :") y la falta de dos puntos.
const REGEX_TOKEN_MENSAJE = /mi\s+c[oó]digo\s*:?\s*([A-Za-z0-9]{8})(?![A-Za-z0-9])/i;

/** true si el texto es un mensaje de verificación («Mi código: TOKEN»). */
export const esMensajeVerificacion = (texto: string): boolean =>
  REGEX_TOKEN_MENSAJE.test(normalizarTextoVerificacion(texto));

/** Diagnóstico para los logs: nunca recibe el token completo ni el número completo. */
export type DiagnosticoVerificacion = (evento: string, datos?: Record<string, string | number | boolean>) => void;
const enmascararToken = (t: string) => `${t.slice(0, 2)}******`;
const ultimos3 = (d: string) => (d ? `***${d.slice(-3)}` : 'sin-numero');

/** Número oculto (LID) y no se pudo averiguar: el token pasa a «sin_numero» y la web pide el código de 6 dígitos. */
export const RESPUESTA_SIN_NUMERO =
  'No pudimos ver tu número desde WhatsApp. Vuelve a la página: te enviaremos un código de 6 dígitos a tu celular para verificarlo 🙏';

/** Pares LID ↔ celular aprendidos (Redis). 90 días: un número cambia poco y el par se vuelve a aprender al escribir. */
export const PAR_LID_TTL_SEG = 90 * 24 * 3600;
export const claveParLidCelular = (lid: string) => `cliente:wa:lid:${String(lid ?? '').replace(/\D/g, '')}`;

export type ResultadoConfirmacionLid = 'CONFIRMADO' | 'OTRO' | 'NO_RESUELTO';

/**
 * Lo que el webhook sabe de un LID (identificador anónimo de WhatsApp, sin número en el evento) para averiguar su celular.
 * Cada método puede fallar o no saber: el llamador trata null / NO_RESUELTO como «no sé» y nunca verifica por eso.
 */
export interface PuenteLid {
  /** Celular ya aprendido para este LID (tabla o caché), o null. */
  aprendido(lid: string): Promise<string | null>;
  /** Celular que Evolution asocia a este LID, o null. */
  numeroDeLid(lid: string): Promise<string | null>;
  /** Prueba de propiedad: ¿Evolution confirma que ese número (51…) tiene este LID? */
  confirmaLid(numero51: string, lid: string): Promise<ResultadoConfirmacionLid>;
  /** Guarda el par aprendido para la próxima vez. */
  aprender(lid: string, celular9: string): Promise<void>;
}

/**
 * Mensaje de verificación de un remitente sin número visible. Orden:
 *  1. token inexistente o vencido → RESPUESTA_NO_VERIFICADO (sin consultar nada);
 *  2. par ya aprendido, o celular que Evolution asocia al LID → se verifica como un mensaje normal (si el celular no es el del token, no marca);
 *  3. si no hay celular: Evolution confirma que el número del token tiene ese LID → se verifica; si dice que no → no marca;
 *  4. no se pudo probar → el token pasa a «sin_numero» (la web pide el código de 6 dígitos) y se responde RESPUESTA_SIN_NUMERO.
 * Sin LID (p. ej. identificador de usuario de Meta) se va directo al paso 4.
 */
export async function atenderVerificacionSinNumero(
  redis: RedisVerificacion,
  secreto: string,
  texto: string,
  lid: string | null,
  puente: PuenteLid | null,
  diagnostico?: DiagnosticoVerificacion,
): Promise<string> {
  const m = REGEX_TOKEN_MENSAJE.exec(normalizarTextoVerificacion(texto));
  if (!m) return RESPUESTA_NO_VERIFICADO;
  const token = m[1].toUpperCase();
  const clave = claveToken(token, secreto);
  const valor = await redis.get(clave);
  const datos = { token: enmascararToken(token), lid: lid ? `***${lid.slice(-3)}` : 'sin-lid' };
  if (!valor) {
    diagnostico?.('TOKEN_NO_ENCONTRADO', datos);
    return RESPUESTA_NO_VERIFICADO;
  }
  const [tel9, proposito, estado] = valor.split('|');
  if (estado === 'V') {
    diagnostico?.('YA_VERIFICADO', datos);
    return RESPUESTA_VERIFICADO;
  }

  if (lid && puente) {
    const aprendido = await puente.aprendido(lid).catch(() => null);
    if (aprendido) {
      diagnostico?.('LID_RESUELTO_TABLA', datos);
      return (await atenderMensajeVerificacion(redis, secreto, texto, `51${aprendido}`, diagnostico)) ?? RESPUESTA_NO_VERIFICADO;
    }
    const numero = await puente.numeroDeLid(lid).catch(() => null);
    const celular9 = numero ? normalizarCelularPeru(numero).celular9 : null;
    if (celular9) {
      diagnostico?.('LID_RESUELTO_EVOLUTION', datos);
      await puente.aprender(lid, celular9).catch(() => undefined);
      return (await atenderMensajeVerificacion(redis, secreto, texto, `51${celular9}`, diagnostico)) ?? RESPUESTA_NO_VERIFICADO;
    }
    const confirmacion = await puente.confirmaLid(`51${tel9}`, lid).catch((): ResultadoConfirmacionLid => 'NO_RESUELTO');
    if (confirmacion === 'CONFIRMADO') {
      diagnostico?.('LID_CONFIRMADO_EVOLUTION', datos);
      await puente.aprender(lid, tel9).catch(() => undefined);
      return (await atenderMensajeVerificacion(redis, secreto, texto, `51${tel9}`, diagnostico)) ?? RESPUESTA_NO_VERIFICADO;
    }
    if (confirmacion === 'OTRO') {
      diagnostico?.('LID_NO_CORRESPONDE', datos);
      return RESPUESTA_NO_VERIFICADO;
    }
  }

  // No se pudo probar que el remitente es el celular del token: se pasa al código de 6 dígitos
  await redis.set(clave, `${tel9}|${proposito}|S`, 'EX', TOKEN_TTL_SEG);
  diagnostico?.('LID_SIN_NUMERO', datos);
  return RESPUESTA_SIN_NUMERO;
}

/**
 * Atiende un mensaje entrante de texto. Devuelve la frase a responder, o null si el texto no trae un token
 * (en ese caso el webhook sigue su curso normal). Solo verifica si el remitente es el celular que pidió el token.
 */
export async function atenderMensajeVerificacion(
  redis: RedisVerificacion,
  secreto: string,
  texto: string,
  remitenteRaw: string,
  diagnostico?: DiagnosticoVerificacion,
): Promise<string | null> {
  const m = REGEX_TOKEN_MENSAJE.exec(normalizarTextoVerificacion(texto));
  if (!m) return null;
  const token = m[1].toUpperCase();
  const clave = claveToken(token, secreto);
  const remitente = normalizarCelularPeru(remitenteRaw).celular9 ?? '';
  const valor = await redis.get(clave);
  if (!valor) {
    // venció o nunca existió (o el secreto de firma es otro: ver secretoVerificacion)
    diagnostico?.('TOKEN_NO_ENCONTRADO', { token: enmascararToken(token), remitente: ultimos3(remitente) });
    return RESPUESTA_NO_VERIFICADO;
  }

  const [tel9, proposito, estado] = valor.split('|');
  if (!remitente || remitente !== tel9) {
    // Otro celular: no marca nada. Tras varios intentos el token se invalida.
    const claveIntentos = claveToken(token, secreto, 'int');
    const n = await redis.incr(claveIntentos);
    if (n === 1) await redis.expire(claveIntentos, TOKEN_TTL_SEG);
    if (n >= TOKEN_MAX_INTENTOS) await redis.del(clave);
    diagnostico?.('REMITENTE_DISTINTO', { token: enmascararToken(token), remitente: ultimos3(remitente), esperado: ultimos3(tel9 ?? ''), intento: n });
    return RESPUESTA_NO_VERIFICADO;
  }

  // Mismo celular que pidió el token: si ya estaba verificado, se responde lo mismo sin volver a marcar.
  if (estado === 'V') {
    diagnostico?.('YA_VERIFICADO', { token: enmascararToken(token), remitente: ultimos3(remitente) });
    return RESPUESTA_VERIFICADO;
  }
  await redis.set(clave, `${tel9}|${proposito}|V`, 'EX', TOKEN_TTL_SEG);
  await redis.set(claveMarcaVerificacion(proposito as PropositoVerificacion, tel9), '1', 'EX', MARCA_TTL_SEG);
  diagnostico?.('MARCADO', { token: enmascararToken(token), remitente: ultimos3(remitente), proposito });
  return RESPUESTA_VERIFICADO;
}
