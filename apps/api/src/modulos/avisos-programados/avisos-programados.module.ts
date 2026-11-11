import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo';
import { LocalModule } from '../local';
import { PcImpresionAvisoService } from './pc-impresion-aviso.service';
import { ChatSinResponderAvisoService } from './chat-sin-responder-aviso.service';

/** Avisos por correo programados: computadoras de impresión sin conectar y chats de WhatsApp sin responder. */
@Module({
  imports: [CorreoModule, LocalModule],
  providers: [PcImpresionAvisoService, ChatSinResponderAvisoService],
  exports: [PcImpresionAvisoService, ChatSinResponderAvisoService],
})
export class AvisosProgramadosModule {}
