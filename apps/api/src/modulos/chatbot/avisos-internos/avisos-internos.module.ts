import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { ConfiguracionModule } from '../../configuracion/configuracion.module';
import { ChatbotModule } from '../chatbot.module';
import { AvisosInternosService } from './avisos-internos.service';
import { AlertasEsperaService } from './alertas-espera.service';

@Module({
  imports: [
    ComunModule,
    AuditoriaModule,
    ConfiguracionModule,
    forwardRef(() => ChatbotModule),
  ],
  providers: [AvisosInternosService, AlertasEsperaService],
  exports: [AvisosInternosService, AlertasEsperaService],
})
export class AvisosInternosModule {}
