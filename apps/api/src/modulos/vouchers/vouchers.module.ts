import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { ChatbotIaModule } from '../chatbot/ia/chatbot-ia.module';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';
import { VouchersIaService } from './vouchers-ia.service';
import { PagoPlanService } from '../pedidos/pago-plan.service';
import { ComprobantesModule } from '../comprobantes/comprobantes.module';
import { ImpresionModule } from '../impresion/impresion.module';

@Module({
  imports: [
    ComunModule,
    ArchivosModule,
    AuditoriaModule,
    ChatbotIaModule,
    forwardRef(() => AvisosInternosModule),
    ComprobantesModule,
    ImpresionModule,
  ],
  controllers: [VouchersController],
  // PagoPlanService no se importa de PedidosModule (ciclo: pedidos ya importa vouchers). Es sin estado.
  providers: [VouchersService, VouchersIaService, PagoPlanService],
  exports: [VouchersService, VouchersIaService],
})
export class VouchersModule {}
