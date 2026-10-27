import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ChatbotIaModule } from '../chatbot/ia/chatbot-ia.module';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';
import { VouchersIaService } from './vouchers-ia.service';

@Module({
  imports: [
    ComunModule,
    ArchivosModule,
    AuditoriaModule,
    ChatbotIaModule,
  ],
  controllers: [VouchersController],
  providers: [VouchersService, VouchersIaService],
  exports: [VouchersService, VouchersIaService],
})
export class VouchersModule {}
