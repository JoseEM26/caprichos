import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PedidosAdminModule } from '../pedidos-admin/pedidos-admin.module';
import { PagosOnlineVencimientoService } from './pagos-online-vencimiento.service';
import { PagosOnlineAdminController, PagosOnlinePublicoController } from './pagos-online.controller';
import { PagosOnlineService } from './pagos-online.service';
import { DevolucionCulqiModule } from './devolucion-culqi.module';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [DevolucionCulqiModule, CajaModule, ClientesModule, PedidosAdminModule, ChatbotModule],
  controllers: [PagosOnlinePublicoController, PagosOnlineAdminController],
  providers: [PagosOnlineService, PagosOnlineVencimientoService],
  exports: [PagosOnlineService],
})
export class PagosOnlineModule {}
