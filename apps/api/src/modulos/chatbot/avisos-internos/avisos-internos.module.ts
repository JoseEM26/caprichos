import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { ConfiguracionModule } from '../../configuracion/configuracion.module';
import { ChatbotModule } from '../chatbot.module';
import { AvisosInternosService } from './avisos-internos.service';

@Module({
  imports: [
    ComunModule,
    AuditoriaModule,
    ConfiguracionModule,
    forwardRef(() => ChatbotModule),
  ],
  providers: [AvisosInternosService],
  exports: [AvisosInternosService],
})
export class AvisosInternosModule {}
