import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { LocalService } from '../../local/local.service';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';
import { interpolar, NOMBRE_LOCAL_BOT, textoBot } from '../conversacion/bienvenida.util';
import { EMOJI_AGRADECIMIENTO, EMOJI_VOUCHER_RECIBIDO, esAgradecimiento, esSaludo } from '../conversacion/cortesia-entrante.util';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { horarioDelLocal } from '../evolution/horario-local';
import { WHATSAPP_MENSAJERIA_PUERTO, WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import { urlPublicaCarta } from './carrusel.util';
import { OutboxWhatsappService } from './outbox-whatsapp.service';

/** Cada cuánto como máximo se le repite al mismo cliente el aviso de «fuera de horario» o la bienvenida con la carta. */
export const HORAS_ENTRE_AUTORESPUESTAS = 12;
const ESTADOS_PEDIDO_TERMINADOS = ['ENTREGADO', 'ANULADO', 'CANCELADO', 'FINALIZADO', 'RECHAZADO'];
/** Estados del bot en los que un «ok» o «gracias» puede ser la respuesta a una pregunta: ahí no se reacciona. */
const ESTADOS_SIN_PREGUNTA = new Set(['INICIO', 'MENU', 'ATENCION_PERSONA']);

export interface EntradaCortesia {
  telefono: string;
  nombre: string;
  texto: string;
  waMessageId?: string | null;
  conversacion: { id: bigint; flujo: unknown; estado: string; duenio: string; tomado_por: unknown };
  /** El motor del bot recibiría este mensaje (la conversación es suya o está en un estado que atiende). */
  puedeProcesarMotor: boolean;
}

export const TEXTOS_CORTESIA = {
  /** Reusa el texto «fuera de horario» del bot (chatbot_texto_fuera_horario) y le suma el saludo y la carta. */
  fueraDeHorario: (nombre: string, fueraDeHorarioBot: string, linkCarta: string): string =>
    [
      `¡Hola${nombre ? ` ${nombre}` : ''}! 💛 Gracias por escribirnos.`,
      fueraDeHorarioBot,
      linkCarta ? `Mientras tanto puedes ver nuestra carta aquí: ${linkCarta} 🍰 ¡Te esperamos con algo rico!` : '¡Te esperamos con algo rico! 🍰',
    ].join('\n\n'),
  bienvenidaConCarta: (nombre: string, linkCarta: string): string =>
    `¡Hola${nombre ? ` ${nombre}` : ''}! 💛 Qué gusto saludarte. Mira nuestra carta aquí: ${linkCarta} 🍰 Cuando quieras pedir, escríbenos y te ayudamos. ¡Te esperamos con algo rico!`,
};

/**
 * Cortesías que no necesitan al bot: reacciones (✅ al voucher, ❤️ a un «gracias») y, solo cuando el bot no va a
 * contestar (apagado o chat en manos de una persona), el aviso de «fuera de horario» y la bienvenida con el enlace a la
 * carta. Todo sale por el puerto/outbox: el guardia de salida y WHATSAPP_SOLO_NUMEROS se aplican igual que a cualquier envío.
 */
@Injectable()
export class AutorespuestaWhatsappService {
  private readonly logger = new Logger(AutorespuestaWhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWhatsappService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO) private readonly mensajeria: WhatsAppMensajeriaPuerto,
    private readonly config: ConfigService,
    private readonly evolution: EvolutionConfigService,
    @Optional() private readonly local?: LocalService,
    @Optional() private readonly chatbotConfig?: ChatbotConfiguracionService,
  ) {}

  /** Reacciona al mensaje del cliente. true si quedó la reacción (si falla o no se puede, quien llama contesta con texto como antes). */
  async reaccionar(telefono: string, waMessageId: string | null | undefined, emoji: string): Promise<boolean> {
    // Decisión del dueño: las novedades son solo de Evolution; con Meta todo sigue como antes (acuse en texto)
    if (!waMessageId || !this.mensajeria.reaccionar || !(await this.esEvolution())) return false;
    try {
      const r = await this.mensajeria.reaccionar(telefono, waMessageId, emoji);
      return r.exito;
    } catch (err: any) {
      this.logger.warn(`No se pudo reaccionar al mensaje: ${err?.message}`);
      return false;
    }
  }

  /** ✅ al voucher recibido, en vez del acuse en texto. */
  reaccionarAVoucher(telefono: string, waMessageId: string | null | undefined): Promise<boolean> {
    return this.reaccionar(telefono, waMessageId, EMOJI_VOUCHER_RECIBIDO);
  }

  /** true si el mensaje quedó atendido aquí (el bot no debe contestarlo). */
  async atender(e: EntradaCortesia): Promise<boolean> {
    if (!(await this.esEvolution())) return false; // con Meta el bot y los avisos siguen exactamente como antes
    const tomado = e.conversacion.tomado_por != null;
    const estadoFlujo = String((e.conversacion.flujo as any)?.estado ?? 'INICIO');

    // «Gracias», «ok», «listo»: ❤️ en vez de texto, si no estamos en medio de una pregunta del bot y el cliente tiene un pedido de hoy
    if (esAgradecimiento(e.texto) && (ESTADOS_SIN_PREGUNTA.has(estadoFlujo) || !e.puedeProcesarMotor) && e.conversacion.estado !== 'VALIDAR_PAGO') {
      if ((await this.pedidoDesde(e.telefono, 24 * 3_600_000, false)) && (await this.reaccionar(e.telefono, e.waMessageId, EMOJI_AGRADECIMIENTO))) return true;
      return false;
    }

    // Si el bot va a contestar, él ya saluda y avisa del horario (con la bienvenida y chatbot_texto_fuera_horario)
    if (e.puedeProcesarMotor && (await this.botActivo())) return false;
    if (tomado) return false; // una persona lo está atendiendo

    const cfg = await this.evolution.obtener();
    const horario = await horarioDelLocal(this.local, this.prisma, new Date(), { desde: cfg.evolution_horario_desde, hasta: cfg.evolution_horario_hasta });
    const link = urlPublicaCarta((k) => this.config.get<string>(k));
    const nombre = String(e.nombre ?? '').trim();

    if (!horario.abierto) {
      const textos = await this.chatbotConfig?.obtenerTextosBot().catch(() => null);
      const apertura = horario.apertura ? `Abrimos ${horario.apertura}.` : 'Abrimos en nuestro próximo horario regular.';
      const fuera = interpolar(textoBot(textos, 'chatbot_texto_fuera_horario'), {
        nombre,
        local: NOMBRE_LOCAL_BOT,
        link_carta: link,
        horario: '',
        hora_apertura: horario.apertura ?? 'nuestro próximo horario',
        apertura,
      });
      return this.enviarUnaVez(e.telefono, 'FUERA_DE_HORARIO', TEXTOS_CORTESIA.fueraDeHorario(nombre, fuera, link));
    }

    // Saludo de alguien sin pedido activo: bienvenida con la carta (solo si hay enlace público que dar)
    if (esSaludo(e.texto) && link && !(await this.pedidoDesde(e.telefono, 2 * 24 * 3_600_000, true))) {
      return this.enviarUnaVez(e.telefono, 'BIENVENIDA', TEXTOS_CORTESIA.bienvenidaConCarta(nombre, link));
    }
    return false;
  }

  private async esEvolution(): Promise<boolean> {
    return (await this.evolution.proveedor()) === 'EVOLUTION';
  }

  private async botActivo(): Promise<boolean> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'chatbot_activo' } });
    return !!p && (p.valor === true || String(p.valor).toLowerCase().trim() === 'si');
  }

  /** Pedido del celular creado en el periodo; `soloActivo` descarta los entregados, anulados y cancelados. */
  private async pedidoDesde(telefono: string, ms: number, soloActivo: boolean): Promise<boolean> {
    const n = await this.prisma.pedido.count({
      where: {
        cliente_telefono: { contains: telefono.replace(/\D/g, '').slice(-9) },
        creado_en: { gte: new Date(Date.now() - ms) },
        ...(soloActivo ? { estado: { notIn: ESTADOS_PEDIDO_TERMINADOS } } : {}),
      },
    });
    return n > 0;
  }

  /** Encola la respuesta (origen AUTORESPUESTA: responde a un mensaje del cliente) una sola vez cada 12 h por cliente. */
  private async enviarUnaVez(telefono: string, tipo: 'FUERA_DE_HORARIO' | 'BIENVENIDA', texto: string): Promise<boolean> {
    const previa = await this.prisma.salienteWhatsapp.findFirst({
      where: { origen: 'AUTORESPUESTA', telefono_destino: telefono, creado_en: { gte: new Date(Date.now() - HORAS_ENTRE_AUTORESPUESTAS * 3_600_000) } },
      select: { id: true },
    });
    if (previa) return true; // ya se le respondió hace poco: el bot tampoco debe volver a hablarle
    const nuevo = await this.outbox.encolar({
      telefono,
      tipo: 'TEXTO',
      clave: `autorespuesta:${tipo}:${telefono}:${Math.floor(Date.now() / (HORAS_ENTRE_AUTORESPUESTAS * 3_600_000))}`,
      origen: 'AUTORESPUESTA',
      carga: { textoLibre: texto, autor: 'BOT', etapa: `AUTORESPUESTA_${tipo}` },
    });
    if (nuevo) this.outbox.despertar();
    return true;
  }
}
