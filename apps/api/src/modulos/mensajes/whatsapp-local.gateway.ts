import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { MensajeEnviado, WhatsAppGateway } from './whatsapp.gateway';

/** Pasarela simulada: deja el mensaje guardado en la conversación; no se envía nada a Meta. */
@Injectable()
export class WhatsAppLocalGateway implements WhatsAppGateway {
  constructor(private readonly prisma: PrismaService) {}

  async enviarTexto(
    conversacionId: bigint,
    _telefono: string,
    texto: string,
    autor: 'BOT' | 'PERSONA',
    idCliente?: string,
  ): Promise<MensajeEnviado> {
    const m = await this.prisma.mensajeChat.create({
      data: { conversacion_id: conversacionId, direccion: 'SALE', autor, tipo: 'TEXTO', contenido: { texto, ...(idCliente ? { idCliente } : {}) } },
    });
    return { id: m.id.toString(), autor, texto, en: m.en, metaId: null };
  }

  async enviarBotones(
    conversacionId: bigint,
    _telefono: string,
    texto: string,
    botones: { id: string; titulo: string }[],
    autor: 'BOT' | 'PERSONA' = 'BOT',
  ): Promise<MensajeEnviado> {
    const m = await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor,
        tipo: 'BOTONES',
        contenido: { texto, botones },
      },
    });
    return { id: m.id.toString(), autor, texto, en: m.en, metaId: null };
  }
}
