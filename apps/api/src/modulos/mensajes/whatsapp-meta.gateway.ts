import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../chatbot/puerto/whatsapp-mensajeria.puerto';
import { MensajeEnviado, WhatsAppGateway } from './whatsapp.gateway';

/**
 * Pasarela real hacia WhatsApp (Cloud API de Meta o adaptador Simulado según configuración).
 * Delega en WhatsAppMensajeriaPuerto del módulo Chatbot y persiste en mensaje_chat relacionando con whatsapp_mensaje.
 */
@Injectable()
export class WhatsAppMetaGateway implements WhatsAppGateway {
  private readonly logger = new Logger(WhatsAppMetaGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
  ) {}

  estaConectado() {
    return this.mensajeria.estaConectado();
  }

  async enviarTexto(
    conversacionId: bigint,
    telefono: string,
    texto: string,
    autor: 'BOT' | 'PERSONA',
  ): Promise<MensajeEnviado> {
    const estadoConexion = this.mensajeria.estaConectado();

    // Enviar a través del puerto de mensajería (Meta o Simulado según credenciales)
    const resultado = await this.mensajeria.enviarTexto(telefono, texto, {
      conversacionId,
    });

    const whatsappMensajeId = resultado.id ? BigInt(resultado.id) : null;
    const metaId = resultado.waMessageId || null;

    // Guardar el mensaje en mensaje_chat enlazando whatsapp_mensaje_id y meta_id
    const m = await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor,
        tipo: 'TEXTO',
        contenido: {
          texto,
          ...(resultado.errorDetalle ? { errorDetalle: resultado.errorDetalle } : {}),
          ...(resultado.errorCodigo ? { errorCodigo: resultado.errorCodigo } : {}),
          estado: resultado.estado,
        },
        meta_id: metaId,
        whatsapp_mensaje_id: whatsappMensajeId,
      },
    });

    return {
      id: m.id.toString(),
      autor,
      texto,
      en: m.en,
      metaId,
      estado: resultado.estado,
      errorCodigo: resultado.errorCodigo || null,
      errorDetalle: resultado.errorDetalle || null,
      modo: estadoConexion.modo,
      whatsappMensajeId,
    };
  }

  async enviarPlantilla(
    conversacionId: bigint,
    telefono: string,
    plantilla: string,
    variables: string[] | Record<string, string> = [],
    autor: 'BOT' | 'PERSONA' = 'PERSONA',
  ): Promise<MensajeEnviado> {
    const estadoConexion = this.mensajeria.estaConectado();

    const resultado = await this.mensajeria.enviarPlantilla(
      telefono,
      plantilla,
      'es',
      variables,
      { conversacionId },
    );

    const whatsappMensajeId = resultado.id ? BigInt(resultado.id) : null;
    const metaId = resultado.waMessageId || null;
    const textoMensaje = `[Plantilla: ${plantilla}]`;

    const m = await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor,
        tipo: 'PLANTILLA',
        contenido: {
          texto: textoMensaje,
          plantilla,
          variables,
          ...(resultado.errorDetalle ? { errorDetalle: resultado.errorDetalle } : {}),
          ...(resultado.errorCodigo ? { errorCodigo: resultado.errorCodigo } : {}),
          estado: resultado.estado,
        },
        meta_id: metaId,
        whatsapp_mensaje_id: whatsappMensajeId,
      },
    });

    return {
      id: m.id.toString(),
      autor,
      texto: textoMensaje,
      en: m.en,
      metaId,
      estado: resultado.estado,
      errorCodigo: resultado.errorCodigo || null,
      errorDetalle: resultado.errorDetalle || null,
      modo: estadoConexion.modo,
      whatsappMensajeId,
    };
  }

  async enviarBotones(
    conversacionId: bigint,
    telefono: string,
    texto: string,
    botones: { id: string; titulo: string }[],
    autor: 'BOT' | 'PERSONA' = 'BOT',
  ): Promise<MensajeEnviado> {
    const estadoConexion = this.mensajeria.estaConectado();

    const resultado = await this.mensajeria.enviarBotones(
      telefono,
      texto,
      botones,
      { conversacionId },
    );

    const whatsappMensajeId = resultado.id ? BigInt(resultado.id) : null;
    const metaId = resultado.waMessageId || null;

    const m = await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor,
        tipo: 'BOTONES',
        contenido: {
          texto,
          botones,
          ...(resultado.errorDetalle ? { errorDetalle: resultado.errorDetalle } : {}),
          ...(resultado.errorCodigo ? { errorCodigo: resultado.errorCodigo } : {}),
          estado: resultado.estado,
        },
        meta_id: metaId,
        whatsapp_mensaje_id: whatsappMensajeId,
      },
    });

    return {
      id: m.id.toString(),
      autor,
      texto,
      en: m.en,
      metaId,
      estado: resultado.estado,
      errorCodigo: resultado.errorCodigo || null,
      errorDetalle: resultado.errorDetalle || null,
      modo: estadoConexion.modo,
      whatsappMensajeId,
    };
  }
}
