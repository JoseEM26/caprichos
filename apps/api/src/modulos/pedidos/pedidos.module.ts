import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { LocalModule } from '../local/local.module';
import { ZonasModule } from '../zonas/zonas.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [LocalModule, ZonasModule, OfertasModule, ClientesModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
