import { Module } from '@nestjs/common';
import { PedidosAdminController } from './pedidos-admin.controller';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonModule } from '../salon/salon.module';
import { ZonasModule } from '../zonas/zonas.module';
import { ClientesModule } from '../clientes/clientes.module';
import { StockModule } from '../stock/stock.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ImpresionModule } from '../impresion/impresion.module';
import { UbicarPedidoService } from './ubicar-pedido.service';
import { PedidoComprobanteService } from './pedido-comprobante.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { ComprobantesModule } from '../comprobantes/comprobantes.module';
import { DevolucionPedidoService } from './devolucion-pedido.service';

@Module({
  imports: [SalonModule, ZonasModule, ClientesModule, StockModule, PedidosModule, ImpresionModule, ChatbotModule, VouchersModule, ComprobantesModule],
  controllers: [PedidosAdminController],
  providers: [
    PedidosEstadoService,
    UbicarPedidoService,
    PedidoComprobanteService,
    DevolucionPedidoService,
  ],
  exports: [PedidosEstadoService],
})
export class PedidosAdminModule {}
