import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';
import {
  MODO_WHATSAPP_ENTRANTE,
  RespuestaVerificacionWhatsapp,
  EstadoVerificacion,
  estadoVerificacion,
  iniciarVerificacion,
  modoVerificacion,
  numeroVerificacion,
  respuestaWhatsappEntrante,
  secretoVerificacion,
  verificacionNoDisponible,
} from './verificacion-whatsapp.util';

// Mismo mecanismo que recuperar la contraseña (recuperar-clave.service), con su propio espacio en Redis.
// No se importa de ahí para no crear un ciclo con ClientesService.
export const REGISTRO_TTL_SEG = 600; // el código vence a los 10 minutos
export const REGISTRO_MAX_SOLICITUDES_HORA = 3;
export const REGISTRO_MAX_INTENTOS = 5;
// Tope de envíos por IP y hora: frena que un solo origen pida códigos para muchos celulares
export const REGISTRO_MAX_SOLICITUDES_IP_HORA = 20;

export const RESPUESTA_CODIGO_REGISTRO = {
  ok: true,
  mensaje: 'Te enviamos un código por WhatsApp. Vence en 10 minutos.',
};

/** Consultas de estado por IP y minuto (la web sondea cada 2 s): frena a quien quiera adivinar tokens. */
export const VERIFICACION_MAX_CONSULTAS_IP_MIN = 120;

const MENSAJE_LIMITE_CELULAR = 'Pediste varios códigos seguidos. Espera una hora e inténtalo de nuevo.';
const MENSAJE_LIMITE_IP = 'Hay demasiados intentos desde tu conexión. Espera una hora e inténtalo de nuevo.';
export const demasiadosCodigos = (mensaje: string) => new HttpException({ codigo: 'DEMASIADOS_CODIGOS', mensaje }, HttpStatus.TOO_MANY_REQUESTS);

/**
 * Código de 6 dígitos por WhatsApp que demuestra que la persona tiene el celular antes de crear la contraseña.
 * El código solo vive en Redis como HMAC con TTL; nunca en claro en base ni en auditoría.
 */
@Injectable()
export class CodigoRegistroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** El outbox es del módulo del chatbot (que importa a Clientes): se busca en tiempo de ejecución para no crear un ciclo. */
  private outbox(): OutboxWhatsappService | null {
    return this.moduleRef.get(OutboxWhatsappService, { strict: false }) ?? null;
  }

  private hashCodigo(tel: string, codigo: string): string {
    const secreto = this.config.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');
    return createHmac('sha256', secreto).update(`registro:${tel}:${codigo}`).digest('hex');
  }

  /** Modo WHATSAPP_ENTRANTE: el cliente escribe él primero; el servidor no envía nada, solo entrega el token y el enlace. */
  private async iniciarPorWhatsapp(tel: string): Promise<RespuestaVerificacionWhatsapp> {
    const numero = await numeroVerificacion(this.prisma);
    if (!numero) throw verificacionNoDisponible();
    const token = await iniciarVerificacion(this.redisService.obtenerCliente(), secretoVerificacion(this.config), tel, 'REGISTRO');
    return respuestaWhatsappEntrante(
      numero,
      token,
      'Toca el botón, envía el mensaje en WhatsApp y vuelve aquí. Vence en 10 minutos.',
    );
  }

  /** Lo que mira la web cada 2 s. Solo devuelve el estado del token; con límite por IP. */
  async estadoVerificacion(token: string, ip?: string): Promise<{ estado: EstadoVerificacion }> {
    const redis = this.redisService.obtenerCliente();
    const claveIp = `cliente:wa:est:${ip ?? 'sin-ip'}`;
    const n = await redis.incr(claveIp);
    if (n === 1) await redis.expire(claveIp, 60);
    if (n > VERIFICACION_MAX_CONSULTAS_IP_MIN) {
      throw demasiadosCodigos('Hay demasiadas consultas desde tu conexión. Espera un minuto.');
    }
    return { estado: await estadoVerificacion(redis, secretoVerificacion(this.config), token) };
  }

  private celular(raw: string | null | undefined): string | null {
    const n = normalizarCelularPeru(raw ?? '');
    return n.valido ? (n.celular9 ?? null) : null;
  }

  /**
   * Envía el código por WhatsApp. Errores controlados que la web muestra tal cual:
   *  - CUENTA_EXISTENTE (409): el celular ya tiene cuenta con contraseña; no se envía nada.
   *  - DEMASIADOS_CODIGOS (429): más de REGISTRO_MAX_SOLICITUDES_HORA por celular, o más de
   *    REGISTRO_MAX_SOLICITUDES_IP_HORA por IP en una hora; tampoco se envía nada.
   * Contrapartida de seguridad (decisión del dueño): con CUENTA_EXISTENTE se puede saber si un celular tiene cuenta.
   * Se acepta porque el cliente necesita saber qué hacer; se mitiga con los límites por celular e IP.
   * recuperar-clave.service NO cambia: sigue respondiendo igual exista o no la cuenta.
   */
  async solicitar(telefono: string, ip?: string): Promise<typeof RESPUESTA_CODIGO_REGISTRO | RespuestaVerificacionWhatsapp> {
    const tel = this.celular(telefono);
    if (!tel) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El celular debe tener 9 dígitos y empezar con 9.',
      });
    }

    const redis = this.redisService.obtenerCliente();
    try {
      const claveSol = `cliente:reg:sol:${tel}`;
      const n = await redis.incr(claveSol);
      if (n === 1) await redis.expire(claveSol, 3600);
      if (n > REGISTRO_MAX_SOLICITUDES_HORA) throw demasiadosCodigos(MENSAJE_LIMITE_CELULAR);
      if (ip) {
        const claveIp = `cliente:reg:ip:${ip}`;
        const m = await redis.incr(claveIp);
        if (m === 1) await redis.expire(claveIp, 3600);
        if (m > REGISTRO_MAX_SOLICITUDES_IP_HORA) throw demasiadosCodigos(MENSAJE_LIMITE_IP);
      }

      const cuenta = await this.prisma.customerAccount.findFirst({ where: { telefono: tel, activo: true }, select: { hash: true } });
      if (cuenta?.hash) {
        throw new ConflictException({
          codigo: 'CUENTA_EXISTENTE',
          mensaje: 'Este celular ya tiene cuenta. Ingresa con tu contraseña o usa «¿Olvidaste tu contraseña?».',
        });
      }

      if ((await modoVerificacion(this.prisma)) === MODO_WHATSAPP_ENTRANTE) return await this.iniciarPorWhatsapp(tel);

      const outbox = this.outbox();
      if (!outbox) return RESPUESTA_CODIGO_REGISTRO;

      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await redis.set(`cliente:reg:cod:${tel}`, this.hashCodigo(tel, codigo), 'EX', REGISTRO_TTL_SEG);
      await redis.del(`cliente:reg:int:${tel}`);

      await outbox.encolar({
        telefono: `51${tel}`,
        tipo: 'TEXTO',
        clave: `codigo-registro-${tel}-${Date.now()}`,
        origen: 'CODIGO_CUENTA',
        carga: {
          textoLibre: `Tu código para crear tu cuenta en Caprichos es ${codigo}. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.`,
          plantillaClave: 'CODIGO_CUENTA',
          variablesPlantilla: [codigo],
          autor: 'BOT',
        },
      });
      outbox.despertar();
    } catch (err) {
      // Los errores controlados llegan a la web; un fallo interno no cambia la respuesta
      if (err instanceof HttpException) throw err;
    }
    return RESPUESTA_CODIGO_REGISTRO;
  }

  /**
   * Paso 2 de crear cuenta: valida el código y lo consume. Si es correcto deja el celular «verificado» por
   * REGISTRO_TTL_SEG; el registro (paso 3, contraseña) exige esa marca.
   */
  async verificar(telefono: string, codigo: string): Promise<{ ok: true }> {
    const tel = this.celular(telefono);
    await this.consumir(telefono, codigo);
    const redis = this.redisService.obtenerCliente();
    try {
      await redis.set(`cliente:reg:ok:${tel}`, '1', 'EX', REGISTRO_TTL_SEG);
    } catch {
      throw new BadRequestException({ codigo: 'CODIGO_INVALIDO', mensaje: 'El código no es correcto o ya venció. Pide uno nuevo.' });
    }
    return { ok: true };
  }

  /** Registro: el celular debe haber pasado por verificar() hace poco. La marca se consume. */
  async exigirVerificado(telefono: string): Promise<void> {
    const tel = this.celular(telefono);
    const noVerificado = () =>
      new BadRequestException({
        codigo: 'CELULAR_NO_VERIFICADO',
        mensaje: 'Primero confirma tu celular con el código que llega por WhatsApp.',
      });
    if (!tel) throw noVerificado();
    const redis = this.redisService.obtenerCliente();
    let marca: string | null = null;
    try {
      marca = await redis.get(`cliente:reg:ok:${tel}`);
      if (marca) await redis.del(`cliente:reg:ok:${tel}`);
    } catch {
      throw noVerificado();
    }
    if (!marca) throw noVerificado();
  }

  /** Valida y consume el código de registro. Error genérico: no revela si el código existe o venció. */
  async consumir(telefono: string, codigo: string): Promise<void> {
    const invalido = () =>
      new BadRequestException({
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'El código no es correcto o ya venció. Pide uno nuevo.',
      });
    const tel = this.celular(telefono);
    const cod = String(codigo ?? '').trim();
    if (!tel || !/^\d{6}$/.test(cod)) throw invalido();

    const redis = this.redisService.obtenerCliente();
    const claveCod = `cliente:reg:cod:${tel}`;
    const claveInt = `cliente:reg:int:${tel}`;
    let guardado: string | null = null;
    try {
      const n = await redis.incr(claveInt);
      if (n === 1) await redis.expire(claveInt, REGISTRO_TTL_SEG);
      if (n > REGISTRO_MAX_INTENTOS) {
        await redis.del(claveCod);
        throw invalido();
      }
      guardado = await redis.get(claveCod);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw invalido();
    }

    const esperado = guardado ? Buffer.from(guardado) : null;
    const recibido = Buffer.from(this.hashCodigo(tel, cod));
    if (!esperado || esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) throw invalido();

    // Se consume: el mismo código no sirve dos veces
    try {
      await redis.del(claveCod, claveInt);
    } catch { /* expira por TTL */ }
  }
}
