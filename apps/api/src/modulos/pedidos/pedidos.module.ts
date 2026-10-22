import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { LocalModule } from '../local/local.module';
import { ZonasModule } from '../zonas/zonas.module';
import { OfertasModule } from '../ofertas/ofertas.module';

@Module({
  imports: [LocalModule, ZonasModule, OfertasModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
