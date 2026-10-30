import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ChatbotIaModule } from '../chatbot/ia/chatbot-ia.module';
import { AyudaAdminController } from './ayuda-admin.controller';
import { AyudaAdminService } from './ayuda-admin.service';
import { ManualesCargadorService } from './manuales-cargador.service';
import { AyudaGrafoService } from './ayuda-grafo.service';

@Module({
  imports: [ComunModule, AuditoriaModule, ChatbotIaModule],
  controllers: [AyudaAdminController],
  providers: [AyudaAdminService, ManualesCargadorService, AyudaGrafoService],
  exports: [AyudaAdminService, ManualesCargadorService, AyudaGrafoService],
})
export class AyudaAdminModule {}
