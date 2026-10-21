import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { LocalModule } from '../local/local.module';
import { ZonasModule } from '../zonas/zonas.module';

@Module({
  imports: [LocalModule, ZonasModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
