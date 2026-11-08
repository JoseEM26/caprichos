import { Module } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { ArchivosModule } from '../../archivos/archivos.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { OfertasModule } from '../../ofertas/ofertas.module';
import { ChatbotConfiguracionController } from './chatbot-configuracion.controller';
import { ChatbotConfiguracionService } from './chatbot-configuracion.service';
import { ConsumoWhatsappController } from './consumo-whatsapp.controller';
import { ConsumoWhatsappService } from './consumo-whatsapp.service';
import { SpamDesbloqueoController } from './spam-desbloqueo.controller';

@Module({
  imports: [ComunModule, AuditoriaModule, ArchivosModule, OfertasModule],
  controllers: [ChatbotConfiguracionController, SpamDesbloqueoController, ConsumoWhatsappController],
  providers: [ChatbotConfiguracionService, ConsumoWhatsappService],
  exports: [ChatbotConfiguracionService, ConsumoWhatsappService],
})
export class ChatbotConfiguracionModule {}
