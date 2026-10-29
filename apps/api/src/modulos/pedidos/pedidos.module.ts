import { Module, forwardRef } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { SeguimientoController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';
import { PagoPlanService } from './pago-plan.service';
import { LocalModule } from '../local/local.module';
import { ZonasModule } from '../zonas/zonas.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { ClientesModule } from '../clientes/clientes.module';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [
    LocalModule,
    ZonasModule,
    OfertasModule,
    ClientesModule,
    VouchersModule,
    forwardRef(() => AvisosInternosModule),
    forwardRef(() => ChatbotModule),
  ],
  controllers: [PedidosController, SeguimientoController],
  providers: [PedidosService, SeguimientoService, PagoPlanService],
  exports: [PedidosService, SeguimientoService, PagoPlanService],
})
export class PedidosModule {}
