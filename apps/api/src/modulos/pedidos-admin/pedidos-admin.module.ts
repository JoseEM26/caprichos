import { Module } from '@nestjs/common';
import { PedidosAdminController } from './pedidos-admin.controller';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonModule } from '../salon/salon.module';

@Module({
  imports: [SalonModule],
  controllers: [PedidosAdminController],
  providers: [
    PedidosEstadoService,
  ],
  exports: [PedidosEstadoService],
})
export class PedidosAdminModule {}
