import { personaAtiendeDesdeWhatsapp } from '../utilidades/canal-whatsapp-business';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { LocalService } from '../../local/local.service';
import { armarBienvenida, nombreParaSaludo } from '../conversacion/bienvenida.util';
import { EMOJI_AGRADECIMIENTO, EMOJI_VOUCHER_RECIBIDO, esAgradecimiento, esConformeConResumen, esSaludo } from '../conversacion/cortesia-entrante.util';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';
import { EvolutionConfigService } from '../evolution/evolution-config.service';
import { horarioDelLocal } from '../evolution/horario-local';
import { WHATSAPP_MENSAJERIA_PUERTO, WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import { urlPublicaCarta } from './carrusel.util';
import { textoConformeConfirmada } from '../conversacion/textos-reparto';
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

    // «OK» / «CONFORME» al resumen del pedido: agradece una sola vez. Antes de la reacción ❤️ porque es el mismo «ok».
    if (
      esConformeConResumen(e.texto) &&
      ESTADOS_SIN_PREGUNTA.has(estadoFlujo) &&
      e.conversacion.estado !== 'VALIDAR_PAGO' &&
      e.conversacion.tomado_por == null &&
      !(await personaAtiendeDesdeWhatsapp(this.prisma, e.conversacion)) &&
      (await this.confirmarResumen(e.telefono, e.nombre))
    ) {
      return true;
    }

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
    if (await personaAtiendeDesdeWhatsapp(this.prisma, e.conversacion)) return false; // la persona escribió desde WhatsApp Business

    const cfg = await this.evolution.obtener();
    const horario = await horarioDelLocal(this.local, this.prisma, new Date(), { desde: cfg.evolution_horario_desde, hasta: cfg.evolution_horario_hasta });
    const link = urlPublicaCarta((k) => this.config.get<string>(k));
    const nombre = nombreParaSaludo(e.nombre);

    // Local cerrado (Meta y Evolution por igual): si el bot va a contestar, él SIEMPRE responde (aviso de fuera de horario
    // con opción de programar; nunca silencio). Si el bot no contesta (apagado, mensaje que no procesa), UN solo aviso
    // (saludo + «Ahora estamos cerrados. Abrimos…») hasta que abra o pasen HORAS_ENTRE_AUTORESPUESTAS.
    // Quien tiene un pedido en curso o un pago por validar sigue con el bot.
    if (!horario.abierto) {
      const enCurso = estadoFlujo.startsWith('PAGO') || e.conversacion.estado === 'VALIDAR_PAGO' || (await this.pedidoDesde(e.telefono, 24 * 3_600_000, true));
      if (enCurso) return false;
      // Cerrado por horario o fecha especial: el bot ofrece programar (si el parámetro está encendido) o avisa el horario.
      if (e.puedeProcesarMotor && (await this.botActivo()) && (await this.cerradoPorHorario())) return false;
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

  /**
   * El cliente respondió «ok» al resumen: pedido activo del celular cuyo resumen ya salió y que aún no confirmó.
   * La marca se toma con un UPDATE condicional (una sola vez por pedido); responde por el outbox (respuesta a su mensaje).
   */
  private async confirmarResumen(telefono: string, nombreCompleto: string): Promise<boolean> {
    const pedido = await this.prisma.pedido.findFirst({
      where: {
        cliente_telefono: { contains: telefono.replace(/\D/g, '').slice(-9) },
        cliente_conforme_en: null,
        estado: { notIn: ESTADOS_PEDIDO_TERMINADOS },
        creado_en: { gte: new Date(Date.now() - 2 * 24 * 3_600_000) },
        salientesWhatsapp: { some: { origen: 'AVISO_PEDIDO', estado: 'ENVIADO', clave_idempotencia: { endsWith: '-RECIBIDO' } } },
      },
      orderBy: { id: 'desc' },
      select: { id: true, codigo: true },
    });
    if (!pedido) return false;
    const marca = await this.prisma.pedido.updateMany({ where: { id: pedido.id, cliente_conforme_en: null }, data: { cliente_conforme_en: new Date() } });
    if (marca.count === 0) return false;
    const nombre = nombreParaSaludo(nombreCompleto);
    const nuevo = await this.outbox.encolar({
      telefono,
      tipo: 'TEXTO',
      clave: `conforme-pedido-${pedido.id}`,
      origen: 'AUTORESPUESTA',
      pedidoId: pedido.id,
      carga: { textoLibre: textoConformeConfirmada(nombre, pedido.codigo), autor: 'BOT', nombre, pedidoCodigo: pedido.codigo, etapa: 'CONFORME_RESUMEN' },
    });
    if (nuevo) this.outbox.despertar();
    return true;
  }

  /** El mismo saludo + aviso de cierre que arma el bot (textos de Configuración), con «hoy/mañana a las HH:MM». */
  private async avisoCerrado(nombre: string, apertura: string | null, link: string): Promise<string> {
    const textos = (await this.configuracionBot?.obtenerTextosBot().catch(() => null)) ?? null;
    return armarBienvenida(nombre, { abierta: false, aperturaTexto: apertura }, { textos, linkCarta: link });
  }

  /** Local cerrado por horario o fecha especial (una pausa por alta demanda la sigue avisando el aviso único). */
  private async cerradoPorHorario(): Promise<boolean> {
    if (!this.local) return false;
    try {
      const estado = await this.local.obtenerEstadoCartaSeguro();
      return !estado.abierta && estado.motivo !== 'PAUSA';
    } catch {
      return false;
    }
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
