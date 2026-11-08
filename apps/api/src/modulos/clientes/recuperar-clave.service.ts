import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';
import { enmascararTelefono } from '../chatbot/utilidades/enmascarar.util';
import { ClientesService, celular9De, validarContrasena } from './clientes.service';
import { AvisoCuentaService } from './aviso-cuenta.service';
import { REGISTRO_MAX_SOLICITUDES_IP_HORA, demasiadosCodigos } from './codigo-registro.service';
import {
  MODO_WHATSAPP_ENTRANTE,
  RespuestaVerificacionWhatsapp,
  MARCA_TTL_SEG,
  claveMarcaVerificacion,
  iniciarVerificacion,
  modoVerificacion,
  numeroVerificacion,
  respuestaWhatsappEntrante,
  secretoVerificacion,
  verificacionNoDisponible,
} from './verificacion-whatsapp.util';

export const RECUPERAR_TTL_SEG = 600; // el código vence a los 10 minutos
export const RECUPERAR_MAX_SOLICITUDES_HORA = 3;
export const RECUPERAR_MAX_INTENTOS = 5;

export const RESPUESTA_SOLICITUD = {
  ok: true,
  mensaje: 'Si ese celular tiene cuenta, te enviamos un código por WhatsApp. Vence en 10 minutos.',
};

/**
 * Recuperar la contraseña del cliente con un código de 6 dígitos por WhatsApp (outbox).
 * El código solo vive en Redis como HMAC con TTL; nunca en claro en base ni en auditoría.
 */
@Injectable()
export class RecuperarClaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
    private readonly clientes: ClientesService,
    private readonly moduleRef: ModuleRef,
    private readonly avisoCuenta: AvisoCuentaService,
  ) {}

  /** El outbox es del módulo del chatbot (que importa a Clientes): se busca en tiempo de ejecución para no crear un ciclo. */
  private outbox(): OutboxWhatsappService | null {
    return this.moduleRef.get(OutboxWhatsappService, { strict: false }) ?? null;
  }

  private hashCodigo(tel: string, codigo: string): string {
    const secreto = this.config.get<string>('JWT_SECRET', 'desarrollo_jwt_secret_caprichos_2026_muy_seguro');
    return createHmac('sha256', secreto).update(`${tel}:${codigo}`).digest('hex');
  }

  /**
   * Responde SIEMPRE lo mismo, tenga o no cuenta ese celular y se haya excedido o no el límite (modo CODIGO_PLANTILLA).
   * En WHATSAPP_ENTRANTE la respuesta tampoco depende de la cuenta (mismo formato, con token), y el exceso de
   * envíos responde 429: el conteo es por celular e IP, no revela si existe la cuenta.
   */
  async solicitar(telefono: string, ip?: string): Promise<typeof RESPUESTA_SOLICITUD | RespuestaVerificacionWhatsapp> {
    const tel = celular9De(telefono);
    if (!tel) {
      throw new BadRequestException({
        codigo: 'TELEFONO_INVALIDO',
        mensaje: 'El celular debe tener 9 dígitos y empezar con 9.',
      });
    }
    const redis = this.redisService.obtenerCliente();
    try {
      const entrante = (await modoVerificacion(this.prisma)) === MODO_WHATSAPP_ENTRANTE;
      const claveSol = `cliente:rec:sol:${tel}`;
      const n = await redis.incr(claveSol);
      if (n === 1) await redis.expire(claveSol, 3600);
      if (n > RECUPERAR_MAX_SOLICITUDES_HORA) {
        if (entrante) throw demasiadosCodigos('Pediste varios códigos seguidos. Espera una hora e inténtalo de nuevo.');
        return RESPUESTA_SOLICITUD;
      }
      if (ip) {
        const claveIp = `cliente:rec:ip:${ip}`;
        const m = await redis.incr(claveIp);
        if (m === 1) await redis.expire(claveIp, 3600);
        if (m > REGISTRO_MAX_SOLICITUDES_IP_HORA) {
          if (entrante) throw demasiadosCodigos('Hay demasiados intentos desde tu conexión. Espera una hora e inténtalo de nuevo.');
          return RESPUESTA_SOLICITUD;
        }
      }

      if (entrante) {
        const numero = await numeroVerificacion(this.prisma);
        if (!numero) throw verificacionNoDisponible();
        const token = await iniciarVerificacion(redis, secretoVerificacion(this.config), tel, 'RECUPERAR');
        return respuestaWhatsappEntrante(
          numero,
          token,
          'Toca el botón, envía el mensaje en WhatsApp y vuelve aquí. Vence en 10 minutos.',
        );
      }

      const cuenta = await this.clientes.cuentaPorCelular(tel);
      const outbox = this.outbox();
      if (!cuenta || !outbox) return RESPUESTA_SOLICITUD;

      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await redis.set(`cliente:rec:cod:${tel}`, this.hashCodigo(tel, codigo), 'EX', RECUPERAR_TTL_SEG);
      await redis.del(`cliente:rec:int:${tel}`);

      await outbox.encolar({
        telefono: `51${tel}`,
        tipo: 'TEXTO',
        clave: `codigo-cuenta-${cuenta.party_id}-${Date.now()}`,
        origen: 'CODIGO_CUENTA',
        carga: {
          textoLibre: `Tu código de Caprichos es ${codigo}. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.`,
          plantillaClave: 'CODIGO_RECUPERAR',
          variablesPlantilla: [codigo],
          autor: 'BOT',
        },
      });
      outbox.despertar();

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'clientes',
        accion: 'CLIENTE_RECUPERACION_SOLICITADA',
        entidad: 'party',
        entidadId: cuenta.party_id,
        despues: { telefono: enmascararTelefono(tel) },
        ip,
      });
    } catch (err) {
      // Los errores controlados (límite, verificación no disponible) llegan a la web; un fallo interno no cambia la respuesta
      if (err instanceof HttpException) throw err;
    }
    return RESPUESTA_SOLICITUD;
  }

  async confirmar(
    dto: { telefono: string; codigo?: string; contrasenaNueva: string },
    ip?: string,
  ): Promise<{ ok: true }> {
    const invalido = () =>
      new BadRequestException({
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'El código no es correcto o ya venció. Pide uno nuevo.',
      });
    const tel = celular9De(dto.telefono);
    // WHATSAPP_ENTRANTE: no hay código que escribir; vale la marca que dejó el mensaje verificado por WhatsApp.
    // CODIGO_PLANTILLA: el código de 6 dígitos de siempre.
    const entrante = (await modoVerificacion(this.prisma)) === MODO_WHATSAPP_ENTRANTE;
    const codigo = String(dto.codigo ?? '').trim();
    if (!tel || (!entrante && !/^\d{6}$/.test(codigo))) throw invalido();
    validarContrasena(dto.contrasenaNueva);

    const redis = this.redisService.obtenerCliente();
    const claveCod = `cliente:rec:cod:${tel}`;
    const claveInt = `cliente:rec:int:${tel}`;
    if (entrante) {
      let marca: string | null = null;
      try {
        // Solo se mira: la marca se gasta al cambiar la contraseña (o al pasar a crear cuenta), no antes
        marca = await redis.get(claveMarcaVerificacion('RECUPERAR', tel));
      } catch {
        throw invalido();
      }
      if (!marca) throw invalido();
    } else {
      let guardado: string | null = null;
      try {
        const n = await redis.incr(claveInt);
        if (n === 1) await redis.expire(claveInt, RECUPERAR_TTL_SEG);
        if (n > RECUPERAR_MAX_INTENTOS) {
          await redis.del(claveCod);
          throw invalido();
        }
        guardado = await redis.get(claveCod);
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw invalido();
      }

      const esperado = guardado ? Buffer.from(guardado) : null;
      const recibido = Buffer.from(this.hashCodigo(tel, codigo));
      if (!esperado || esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) throw invalido();
    }

    const cuenta = await this.clientes.cuentaPorCelular(tel);
    if (!cuenta) {
      // Celular verificado pero sin cuenta (p. ej. solo acumuló puntos al pedir): la prueba del celular vale para
      // crear la cuenta, que se vincula al mismo party y conserva sus puntos. No se dice «código incorrecto».
      try {
        await redis.set(claveMarcaVerificacion('REGISTRO', tel), '1', 'EX', MARCA_TTL_SEG);
        await redis.del(claveCod, claveInt, claveMarcaVerificacion('RECUPERAR', tel));
      } catch { /* sin Redis se vuelve a verificar al crear la cuenta */ }
      throw new BadRequestException({
        codigo: 'SIN_CUENTA',
        mensaje: 'Ese celular aún no tiene cuenta. Créala ahora: tus puntos se conservan.',
      });
    }

    const hash = await argon2.hash(dto.contrasenaNueva);
    // clave_cambiada_en deja sin efecto las sesiones anteriores; el código se consume
    await this.prisma.customerAccount.update({
      where: { id: cuenta.id },
      data: { hash, telefono: tel, clave_cambiada_en: new Date() },
    });
    try {
      await redis.del(claveCod, claveInt, claveMarcaVerificacion('RECUPERAR', tel), `bloqueo:cliente:${tel}`);
    } catch { /* limpiar bloqueos en Redis es best-effort; expiran por TTL */ }
    await this.avisoCuenta.avisar(cuenta.party_id, tel, 'CLAVE_CAMBIADA');

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'clientes',
      accion: 'CLIENTE_CLAVE_CAMBIADA',
      entidad: 'party',
      entidadId: cuenta.party_id,
      despues: { medio: 'CODIGO_WHATSAPP' },
      partyId: cuenta.party_id,
      ip,
    });
    return { ok: true };
  }
}
