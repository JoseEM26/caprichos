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
import { CambioUbicacionService } from './cambio-ubicacion.service';
import { PropuestaUbicacionService } from './propuesta-ubicacion.service';
import { CambioUbicacionController } from './cambio-ubicacion.controller';
import { UbicacionWhatsappPedidoService } from './ubicacion-whatsapp-pedido.service';
import { UBICACION_PEDIDO_PUERTO } from '../chatbot/puerto/ubicacion-pedido.puerto';
import { PropuestaUbicacionController } from './propuesta-ubicacion.controller';
import { CambioCobroService } from './cambio-cobro.service';
import { CambioCobroController } from './cambio-cobro.controller';
import { CajaModule } from '../caja/caja.module';
import { PagoPlanService } from '../pedidos/pago-plan.service';
import { OfertasModule } from '../ofertas/ofertas.module';
import { EditarPedidoService } from './editar-pedido.service';
import { EditarPedidoController } from './editar-pedido.controller';
import { PedidoExtraService } from './pedido-extra.service';
import { CorregirClienteService } from './corregir-cliente.service';
import { ReabrirPedidoService } from './reabrir-pedido.service';
import { PedidoExtraController } from './pedido-extra.controller';

@Module({
  imports: [SalonModule, ZonasModule, ClientesModule, StockModule, PedidosModule, ImpresionModule, ChatbotModule, VouchersModule, ComprobantesModule, CajaModule, OfertasModule],
  controllers: [PedidosAdminController, CambioUbicacionController, PropuestaUbicacionController, CambioCobroController, EditarPedidoController, PedidoExtraController],
  providers: [
    PedidosEstadoService,
    UbicarPedidoService,
    CorregirClienteService,
    ReabrirPedidoService,
    PedidoComprobanteService,
    DevolucionPedidoService,
    CambioUbicacionService,
    PropuestaUbicacionService,
    CambioCobroService,
    EditarPedidoService,
    PedidoExtraService,
    // Sin estado ni dependencias; PedidosModule no lo exporta
    PagoPlanService,
    UbicacionWhatsappPedidoService,
    { provide: UBICACION_PEDIDO_PUERTO, useExisting: UbicacionWhatsappPedidoService },
  ],
  exports: [PedidosEstadoService, UBICACION_PEDIDO_PUERTO],
})
export class PedidosAdminModule {}
