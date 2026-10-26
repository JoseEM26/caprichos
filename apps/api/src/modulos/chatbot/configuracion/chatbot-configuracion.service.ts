import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import {
  enmascararTelefono,
  hashTelefono,
  normalizarTelefono,
} from '../utilidades/enmascarar.util';
import {
  ANTI_SPAM_DEFECTO,
  AntiSpamParametros,
  CLAVES_TEXTOS_BOT,
  ClaveTextoBot,
  FUNCIONES_BOT_DEFECTO,
  FuncionesBotEstado,
  LIMITE_CUERPO_TEXTO,
  PRIVACIDAD_DEFECTO,
  PrivacidadParametros,
  TEXTOS_ANTI_SPAM,
  TEXTOS_BOT_DEFECTO,
  ChatbotConfiguracionCompleta,
} from './chatbot-configuracion.tipos';
import {
  ActualizarAntiSpamDto,
  ActualizarFuncionesBotDto,
  ActualizarRetencionDto,
  ActualizarTextosBotDto,
} from './dto/chatbot-configuracion.dto';

@Injectable()
export class ChatbotConfiguracionService {
  private readonly logger = new Logger(ChatbotConfiguracionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Obtiene la configuración completa del chatbot: textos, funciones, anti-spam y privacidad.
   */
  async obtenerConfiguracion(): Promise<ChatbotConfiguracionCompleta> {
    const parametros = await this.prisma.parametro.findMany({
      where: {
        clave: {
          startsWith: 'chatbot_',
        },
      },
    });

    const mapa = new Map<string, any>();
    for (const p of parametros) {
      mapa.set(p.clave, p.valor);
    }

    // 1. Textos editables (con fallback al valor por defecto)
    const textos: Record<ClaveTextoBot, string> = { ...TEXTOS_BOT_DEFECTO };
    for (const clave of CLAVES_TEXTOS_BOT) {
      const val = mapa.get(clave);
      if (typeof val === 'string' && val.trim().length > 0) {
        textos[clave] = val;
      }
    }

    // 2. Interruptores por función
    const funciones: FuncionesBotEstado = {
      pedido: this.parsearBooleano(mapa.get('chatbot_funcion_pedido'), FUNCIONES_BOT_DEFECTO.pedido),
      pago: this.parsearBooleano(mapa.get('chatbot_funcion_pago'), FUNCIONES_BOT_DEFECTO.pago),
      reservas: this.parsearBooleano(mapa.get('chatbot_funcion_reservas'), FUNCIONES_BOT_DEFECTO.reservas),
      cambios: this.parsearBooleano(mapa.get('chatbot_funcion_cambios'), FUNCIONES_BOT_DEFECTO.cambios),
      ia: this.parsearBooleano(mapa.get('chatbot_ia_activo'), FUNCIONES_BOT_DEFECTO.ia),
      promociones: this.parsearBooleano(mapa.get('chatbot_funcion_promociones'), FUNCIONES_BOT_DEFECTO.promociones),
    };

    // 3. Anti-spam
    const antiSpam: AntiSpamParametros = {
      maxPorMinuto: this.parsearNumero(mapa.get('chatbot_antispam_max_minuto'), ANTI_SPAM_DEFECTO.maxPorMinuto),
      maxPorHora: this.parsearNumero(mapa.get('chatbot_antispam_max_hora'), ANTI_SPAM_DEFECTO.maxPorHora),
    };

    // 4. Privacidad y retención
    const privacidad: PrivacidadParametros = {
      diasRetencion: this.parsearNumero(mapa.get('chatbot_retencion_dias'), PRIVACIDAD_DEFECTO.diasRetencion),
    };

    return {
      textos,
      textosDefecto: { ...TEXTOS_BOT_DEFECTO },
      funciones,
      antiSpam,
      privacidad,
    };
  }

  /**
   * Actualiza los textos editables del bot respetando el límite de 1024 caracteres de WhatsApp.
   */
  async actualizarTextos(
    dto: ActualizarTextosBotDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<Record<ClaveTextoBot, string>> {
    const entradas = Object.entries(dto) as [ClaveTextoBot, string | undefined][];

    for (const [clave, valor] of entradas) {
      if (valor === undefined) continue;

      if (!CLAVES_TEXTOS_BOT.includes(clave)) {
        throw new BadRequestException({
          codigo: 'CLAVE_TEXTO_INVALIDA',
          mensaje: `La clave de texto '${clave}' no es válida para el bot`,
        });
      }

      const textoLimpio = valor.trim();
      if (textoLimpio.length === 0) {
        throw new BadRequestException({
          codigo: 'TEXTO_VACIO',
          mensaje: `El texto '${clave}' no puede estar vacío`,
        });
      }

      if (textoLimpio.length > LIMITE_CUERPO_TEXTO) {
        throw new BadRequestException({
          codigo: 'TEXTO_EXCEDE_LIMITE_WHATSAPP',
          mensaje: `El texto '${clave}' tiene ${textoLimpio.length} caracteres y excede el límite de WhatsApp (${LIMITE_CUERPO_TEXTO} caracteres)`,
        });
      }
    }

    const antes = await this.obtenerConfiguracion();

    for (const [clave, valor] of entradas) {
      if (valor === undefined) continue;
      const textoLimpio = valor.trim();
      await this.prisma.parametro.upsert({
        where: { clave },
        update: { valor: textoLimpio },
        create: { clave, valor: textoLimpio },
      });
    }

    const despues = await this.obtenerConfiguracion();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_configuracion',
      accion: 'TEXTOS_BOT_ACTUALIZADOS',
      resultado: 'OK',
      entidad: 'parametro',
      antes: antes.textos,
      despues: despues.textos,
      partyId: usuario?.partyId,
      ip,
    });

    return despues.textos;
  }

  /**
   * Restablece un texto del bot a su valor por defecto del mockup.
   */
  async restablecerTexto(
    clave: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ clave: string; valor: string }> {
    if (!CLAVES_TEXTOS_BOT.includes(clave as ClaveTextoBot)) {
      throw new BadRequestException({
        codigo: 'CLAVE_TEXTO_INVALIDA',
        mensaje: `La clave '${clave}' no es un texto editable del bot`,
      });
    }

    const claveTipada = clave as ClaveTextoBot;
    const valorPorDefecto = TEXTOS_BOT_DEFECTO[claveTipada];

    const anterior = await this.prisma.parametro.findUnique({
      where: { clave },
    });

    await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor: valorPorDefecto },
      create: { clave, valor: valorPorDefecto },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_configuracion',
      accion: 'TEXTO_BOT_RESTABLECIDO',
      resultado: 'OK',
      entidad: 'parametro',
      antes: anterior ? { clave, valor: anterior.valor } : null,
      despues: { clave, valor: valorPorDefecto },
      partyId: usuario?.partyId,
      ip,
    });

    return { clave, valor: valorPorDefecto };
  }

  /**
   * Actualiza los interruptores de función del bot (pedido, pago, reservas, cambios, IA, promociones).
   */
  async actualizarFunciones(
    dto: ActualizarFuncionesBotDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<FuncionesBotEstado> {
    const configActual = await this.obtenerConfiguracion();
    const antes = configActual.funciones;

    const actualizadores: Promise<any>[] = [];

    if (dto.pedido !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_funcion_pedido' },
          update: { valor: dto.pedido ? 'si' : 'no' },
          create: { clave: 'chatbot_funcion_pedido', valor: dto.pedido ? 'si' : 'no' },
        }),
      );
    }
    if (dto.pago !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_funcion_pago' },
          update: { valor: dto.pago ? 'si' : 'no' },
          create: { clave: 'chatbot_funcion_pago', valor: dto.pago ? 'si' : 'no' },
        }),
      );
    }
    if (dto.reservas !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_funcion_reservas' },
          update: { valor: dto.reservas ? 'si' : 'no' },
          create: { clave: 'chatbot_funcion_reservas', valor: dto.reservas ? 'si' : 'no' },
        }),
      );
    }
    if (dto.cambios !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_funcion_cambios' },
          update: { valor: dto.cambios ? 'si' : 'no' },
          create: { clave: 'chatbot_funcion_cambios', valor: dto.cambios ? 'si' : 'no' },
        }),
      );
    }
    if (dto.ia !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_ia_activo' },
          update: { valor: dto.ia ? 'si' : 'no' },
          create: { clave: 'chatbot_ia_activo', valor: dto.ia ? 'si' : 'no' },
        }),
      );
    }
    if (dto.promociones !== undefined) {
      actualizadores.push(
        this.prisma.parametro.upsert({
          where: { clave: 'chatbot_funcion_promociones' },
          update: { valor: dto.promociones ? 'si' : 'no' },
          create: { clave: 'chatbot_funcion_promociones', valor: dto.promociones ? 'si' : 'no' },
        }),
      );
    }

    await Promise.all(actualizadores);

    const configNueva = await this.obtenerConfiguracion();
    const despues = configNueva.funciones;

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_configuracion',
      accion: 'FUNCIONES_BOT_ACTUALIZADAS',
      resultado: 'OK',
      entidad: 'parametro',
      antes,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    return despues;
  }

  /**
   * Actualiza los límites de frecuencia anti-spam.
   */
  async actualizarAntiSpam(
    dto: ActualizarAntiSpamDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<AntiSpamParametros> {
    const antes = (await this.obtenerConfiguracion()).antiSpam;

    await Promise.all([
      this.prisma.parametro.upsert({
        where: { clave: 'chatbot_antispam_max_minuto' },
        update: { valor: dto.maxPorMinuto },
        create: { clave: 'chatbot_antispam_max_minuto', valor: dto.maxPorMinuto },
      }),
      this.prisma.parametro.upsert({
        where: { clave: 'chatbot_antispam_max_hora' },
        update: { valor: dto.maxPorHora },
        create: { clave: 'chatbot_antispam_max_hora', valor: dto.maxPorHora },
      }),
    ]);

    const despues: AntiSpamParametros = {
      maxPorMinuto: dto.maxPorMinuto,
      maxPorHora: dto.maxPorHora,
    };

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_configuracion',
      accion: 'ANTISPAM_ACTUALIZADO',
      resultado: 'OK',
      entidad: 'parametro',
      antes,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    return despues;
  }

  /**
   * Actualiza el plazo de retención de mensajes en días (Ley 29733).
   */
  async actualizarRetencion(
    dto: ActualizarRetencionDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<PrivacidadParametros> {
    const antes = (await this.obtenerConfiguracion()).privacidad;

    await this.prisma.parametro.upsert({
      where: { clave: 'chatbot_retencion_dias' },
      update: { valor: dto.diasRetencion },
      create: { clave: 'chatbot_retencion_dias', valor: dto.diasRetencion },
    });

    const despues: PrivacidadParametros = {
      diasRetencion: dto.diasRetencion,
    };

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_configuracion',
      accion: 'RETENCION_PRIVACIDAD_ACTUALIZADA',
      resultado: 'OK',
      entidad: 'parametro',
      antes,
      despues,
      partyId: usuario?.partyId,
      ip,
    });

    return despues;
  }

  /**
   * Ejecuta la anonimización de mensajes antiguos según la política de retención.
   * Regla de oro de Caprichos: NADA SE ELIMINA; el contenido sensible se anonimiza en base de datos.
   */
  async ejecutarAnonimizacionRetencion(
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ anonimizados: number; fechaCorte: string; diasRetencion: number }> {
    const config = await this.obtenerConfiguracion();
    const dias = config.privacidad.diasRetencion;
    const msRetencion = dias * 24 * 60 * 60 * 1000;
    const fechaCorte = new Date(Date.now() - msRetencion);

    // Mensajes de chat que superan el período de retención y cuyo contenido no haya sido anonimizado
    const mensajesAntiguos = await this.prisma.mensajeChat.findMany({
      where: {
        en: { lt: fechaCorte },
      },
      select: {
        id: true,
        contenido: true,
      },
    });

    let totalAnonimizados = 0;
    const textoAnonimizado = '[Mensaje anonimizado por política de retención Ley 29733]';

    for (const msg of mensajesAntiguos) {
      const contenidoObj = (msg.contenido as any) || {};
      if (contenidoObj.texto === textoAnonimizado) {
        continue; // Ya anonimizado previamente
      }

      await this.prisma.mensajeChat.update({
        where: { id: msg.id },
        data: {
          contenido: {
            texto: textoAnonimizado,
            anonimizado: true,
            anonimizado_en: new Date().toISOString(),
          },
        },
      });
      totalAnonimizados++;
    }

    this.logger.log(
      `Anonimización por retención Ley 29733 completada: ${totalAnonimizados} mensajes anonimizados (corte: ${fechaCorte.toISOString()}).`,
    );

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_privacidad',
      accion: 'ANONIMIZACION_RETENCION',
      resultado: 'OK',
      entidad: 'mensaje_chat',
      antes: null,
      despues: {
        totalAnonimizados,
        diasRetencion: dias,
        fechaCorte: fechaCorte.toISOString(),
      },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      anonimizados: totalAnonimizados,
      fechaCorte: fechaCorte.toISOString(),
      diasRetencion: dias,
    };
  }

  /**
   * Exporta todos los datos recopilados de un cliente a solicitud de un administrador (derecho de acceso Ley 29733).
   * Regla de seguridad estricta: NUNCA expone teléfonos completos en el informe ni en la respuesta.
   */
  async exportarDatosCliente(
    identificador: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<Record<string, any>> {
    const rawId = String(identificador || '').trim();
    if (!rawId) {
      throw new BadRequestException({
        codigo: 'IDENTIFICADOR_REQUERIDO',
        mensaje: 'Debe proporcionar un identificador o teléfono del cliente',
      });
    }

    const telNorm = normalizarTelefono(rawId);
    const telMask = enmascararTelefono(telNorm || rawId);
    const telHash = hashTelefono(telNorm || rawId);

    // Búsqueda de conversación
    const conversacion = await this.prisma.conversacion.findFirst({
      where: {
        OR: [
          { telefono: telNorm || rawId },
          { telefono: rawId },
        ],
      },
      include: {
        mensajes: {
          orderBy: { en: 'asc' },
        },
      },
    });

    // Consentimiento
    const consentimiento = await this.prisma.clienteWhatsappConsentimiento.findUnique({
      where: { telefono_hash: telHash },
    });

    // Pedidos asociados por teléfono
    const pedidos = telNorm
      ? await this.prisma.pedido.findMany({
          where: {
            cliente_telefono: { contains: telNorm.slice(-8) },
          },
          select: {
            codigo: true,
            modalidad: true,
            estado: true,
            total: true,
            creado_en: true,
          },
          orderBy: { creado_en: 'desc' },
        })
      : [];

    await this.auditoria.registrar({
      categoria: 'LECTURA_SENSIBLE',
      modulo: 'chatbot_privacidad',
      accion: 'EXPORTAR_DATOS_CLIENTE',
      resultado: 'OK',
      entidad: 'cliente',
      antes: null,
      despues: { identificador: telMask },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      identificadorEnmascarado: telMask,
      nombreContacto: conversacion?.nombre_contacto || 'Cliente',
      identificadorTipo: conversacion?.identificador_tipo || 'TELEFONO',
      consentimiento: {
        aceptaComunicaciones: consentimiento ? consentimiento.acepta : true,
        origen: consentimiento?.origen || 'POR_DEFECTO',
        actualizadoEn: consentimiento?.en || null,
      },
      conversacion: conversacion
        ? {
            id: conversacion.id.toString(),
            estado: conversacion.estado,
            duenio: conversacion.duenio,
            ultimaActividad: conversacion.ultima_actividad,
          }
        : null,
      totalMensajes: conversacion?.mensajes.length || 0,
      mensajes: (conversacion?.mensajes || []).map((m) => ({
        fecha: m.en,
        direccion: m.direccion,
        autor: m.autor,
        tipo: m.tipo,
        contenido: m.contenido,
      })),
      totalPedidos: pedidos.length,
      pedidos: pedidos.map((p) => ({
        codigo: p.codigo,
        modalidad: p.modalidad,
        estado: p.estado,
        total: Number(p.total),
        fecha: p.creado_en,
      })),
    };
  }

  /**
   * Da de baja y anonimiza los datos de un cliente a solicitud de un administrador (derecho de cancelación Ley 29733).
   * Revoca consentimiento, anonimiza nombre y mensajes; nada se elimina físicamente.
   */
  async darDeBajaCliente(
    identificador: string,
    motivo?: string,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ): Promise<{ exito: boolean; mensaje: string; identificador: string }> {
    const rawId = String(identificador || '').trim();
    if (!rawId) {
      throw new BadRequestException({
        codigo: 'IDENTIFICADOR_REQUERIDO',
        mensaje: 'Debe proporcionar un identificador o teléfono del cliente',
      });
    }

    const telNorm = normalizarTelefono(rawId);
    const telMask = enmascararTelefono(telNorm || rawId);
    const telHash = hashTelefono(telNorm || rawId);

    // 1. Revocar consentimiento
    await this.prisma.clienteWhatsappConsentimiento.upsert({
      where: { telefono_hash: telHash },
      update: {
        acepta: false,
        origen: 'ADMIN_BAJA',
        en: new Date(),
      },
      create: {
        telefono_hash: telHash,
        acepta: false,
        origen: 'ADMIN_BAJA',
        en: new Date(),
      },
    });

    // 2. Anonimizar conversación y mensajes si existen
    const conversacion = await this.prisma.conversacion.findFirst({
      where: {
        OR: [
          { telefono: telNorm || rawId },
          { telefono: rawId },
        ],
      },
    });

    let mensajesAnonimizados = 0;
    if (conversacion) {
      await this.prisma.conversacion.update({
        where: { id: conversacion.id },
        data: {
          nombre_contacto: '[Anonimizado]',
          flujo: {},
          duenio: 'BOT',
        },
      });

      const actualizados = await this.prisma.mensajeChat.updateMany({
        where: { conversacion_id: conversacion.id },
        data: {
          contenido: {
            texto: '[Anonimizado por solicitud de baja Ley 29733]',
            anonimizado: true,
            anonimizado_en: new Date().toISOString(),
          },
        },
      });
      mensajesAnonimizados = actualizados.count;
    }

    this.logger.log(
      `Baja de cliente completada para ${telMask}: consentimiento revocado y ${mensajesAnonimizados} mensajes anonimizados.`,
    );

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'chatbot_privacidad',
      accion: 'BAJA_CLIENTE',
      resultado: 'OK',
      entidad: 'cliente',
      antes: null,
      despues: {
        identificador: telMask,
        motivo: motivo?.trim() || 'Solicitud de baja y cancelación Ley 29733',
        mensajesAnonimizados,
      },
      partyId: usuario?.partyId,
      ip,
    });

    return {
      exito: true,
      mensaje: 'Cliente dado de baja y datos personales anonimizados conforme a la Ley 29733',
      identificador: telMask,
    };
  }

  /**
   * Comprueba el límite de frecuencia anti-spam de un cliente usando Redis.
   * Si supera el límite de mensajes por minuto o por hora:
   * - Emite un aviso amable una sola vez.
   * - Permanece en silencio mientras continúe el exceso.
   */
  async verificarAntiSpam(telefonoOId: string): Promise<{
    permitido: boolean;
    enviarAvisoSpam: boolean;
    mensajeAviso?: string;
  }> {
    if (!telefonoOId) return { permitido: true, enviarAvisoSpam: false };

    try {
      const redis = this.redisService.obtenerCliente();
      const config = await this.obtenerConfiguracion();
      const { maxPorMinuto, maxPorHora } = config.antiSpam;

      const idLimpio = encodeURIComponent(telefonoOId.trim());
      const claveMin = `chatbot:antispam:min:${idLimpio}`;
      const claveHora = `chatbot:antispam:hora:${idLimpio}`;
      const claveAviso = `chatbot:antispam:aviso:${idLimpio}`;

      const conteoMin = await redis.incr(claveMin);
      if (conteoMin === 1) {
        await redis.expire(claveMin, 60);
      }

      const conteoHora = await redis.incr(claveHora);
      if (conteoHora === 1) {
        await redis.expire(claveHora, 3600);
      }

      if (conteoMin > maxPorMinuto || conteoHora > maxPorHora) {
        const yaAvisado = await redis.get(claveAviso);
        if (!yaAvisado) {
          // Enviar respuesta amable UNA SOLA VEZ y registrar aviso en Redis por 60 segundos
          await redis.set(claveAviso, '1', 'EX', 60);
          return {
            permitido: false,
            enviarAvisoSpam: true,
            mensajeAviso: TEXTOS_ANTI_SPAM.avisoExceso(),
          };
        }

        // Si ya fue avisado, SILENCIO TOTAL
        return {
          permitido: false,
          enviarAvisoSpam: false,
        };
      }

      return { permitido: true, enviarAvisoSpam: false };
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para verificación anti-spam: ${err.message}`);
      return { permitido: true, enviarAvisoSpam: false };
    }
  }

  /**
   * Devuelve los textos vigentes del bot para interpolación en el motor conversacional.
   */
  async obtenerTextosBot(): Promise<Record<ClaveTextoBot, string>> {
    const config = await this.obtenerConfiguracion();
    return config.textos;
  }

  /**
   * Devuelve los estados vigentes de los interruptores por función.
   */
  async obtenerFuncionesActivas(): Promise<FuncionesBotEstado> {
    const config = await this.obtenerConfiguracion();
    return config.funciones;
  }

  private parsearBooleano(valor: any, porDefecto: boolean): boolean {
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'string') {
      const v = valor.toLowerCase().trim();
      if (v === 'si' || v === 'true') return true;
      if (v === 'no' || v === 'false') return false;
    }
    return porDefecto;
  }

  private parsearNumero(valor: any, porDefecto: number): number {
    if (typeof valor === 'number' && !isNaN(valor)) return valor;
    if (typeof valor === 'string') {
      const n = Number(valor);
      if (!isNaN(n)) return n;
    }
    return porDefecto;
  }
}
