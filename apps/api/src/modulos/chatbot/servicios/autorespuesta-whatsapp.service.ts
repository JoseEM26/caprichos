import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { LocalService } from '../../local/local.service';
import { armarBienvenida, nombreParaSaludo } from '../conversacion/bienvenida.util';
import { EMOJI_AGRADECIMIENTO, EMOJI_VOUCHER_RECIBIDO, esAgradecimiento, esSaludo } from '../conversacion/cortesia-entrante.util';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { horarioDelLocal } from '../evolution/horario-local';
import { WHATSAPP_MENSAJERIA_PUERTO, WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import { urlPublicaCarta } from './carrusel.util';
import { OutboxWhatsappService } from './outbox-whatsapp.service';

/** Cada cuánto como máximo se le repite al mismo cliente el aviso de «fuera de horario» o la bienvenida con la carta. */
export const HORAS_ENTRE_AUTORESPUESTAS = 6;
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

/** «mañana a las 09:00» → «mañana a las 9:00 a. m.» */
export function aHora12(texto: string): string {
  return texto.replace(/(\d{1,2}):(\d{2})/g, (_m, h: string, m: string) => {
    const n = Number(h);
    return `${n % 12 || 12}:${m} ${n >= 12 && n < 24 ? 'p. m.' : 'a. m.'}`;
  });
}

export const TEXTOS_CORTESIA = {
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
    @Optional() private readonly configuracionBot?: ChatbotConfiguracionService,
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
    const evolution = await this.esEvolution();
    const estadoFlujo = String((e.conversacion.flujo as any)?.estado ?? 'INICIO');

    // «Gracias», «ok», «listo»: ❤️ en vez de texto (solo Evolution), si no estamos en medio de una pregunta del bot y el cliente tiene un pedido de hoy
    if (
      evolution &&
      esAgradecimiento(e.texto) &&
      (ESTADOS_SIN_PREGUNTA.has(estadoFlujo) || !e.puedeProcesarMotor) &&
      e.conversacion.estado !== 'VALIDAR_PAGO' &&
      (await this.pedidoDesde(e.telefono, 24 * 3_600_000, false)) &&
      (await this.reaccionar(e.telefono, e.waMessageId, EMOJI_AGRADECIMIENTO))
    ) {
      return true;
    }

    if (e.conversacion.tomado_por != null) return false; // una persona lo está atendiendo

    const cfg = await this.evolution.obtener();
    const horario = await horarioDelLocal(this.local, this.prisma, new Date(), { desde: cfg.evolution_horario_desde, hasta: cfg.evolution_horario_hasta });
    const link = urlPublicaCarta((k) => this.config.get<string>(k));
    const nombre = nombreParaSaludo(e.nombre);

    // Local cerrado (Meta y Evolution por igual): el bot NO conversa (ni menú ni IA ni «hola de nuevo»). UN solo aviso
    // (saludo + «Ahora estamos cerrados. Abrimos…») y silencio total hasta que abra o pasen HORAS_ENTRE_AUTORESPUESTAS.
    // Excepción: quien tiene un pedido en curso o un pago por validar sigue con el bot.
    if (!horario.abierto) {
      const enCurso = estadoFlujo.startsWith('PAGO') || e.conversacion.estado === 'VALIDAR_PAGO' || (await this.pedidoDesde(e.telefono, 24 * 3_600_000, true));
      if (enCurso) return false;
      return this.enviarUnaVez(e.telefono, 'FUERA_DE_HORARIO', await this.avisoCerrado(nombre, horario.apertura, link));
    }
    if (!evolution) return false; // con el local abierto, Meta sigue exactamente como antes

    // Abierto y el bot va a contestar: él ya saluda
    if (e.puedeProcesarMotor && (await this.botActivo())) return false;

    // Saludo de alguien sin pedido activo: bienvenida con la carta (solo si hay enlace público que dar)
    if (esSaludo(e.texto) && link && !(await this.pedidoDesde(e.telefono, 2 * 24 * 3_600_000, true))) {
      return this.enviarUnaVez(e.telefono, 'BIENVENIDA', TEXTOS_CORTESIA.bienvenidaConCarta(nombre, link));
    }
    return false;
  }

  /** El mismo saludo + aviso de cierre que arma el bot (textos de Configuración), con «hoy/mañana a las HH:MM». */
  private async avisoCerrado(nombre: string, apertura: string | null, link: string): Promise<string> {
    const textos = (await this.configuracionBot?.obtenerTextosBot().catch(() => null)) ?? null;
    return armarBienvenida(nombre, { abierta: false, aperturaTexto: apertura }, { textos, linkCarta: link });
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

  /** Encola la respuesta (origen AUTORESPUESTA: responde a un mensaje del cliente) una sola vez cada 6 h por cliente. */
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
