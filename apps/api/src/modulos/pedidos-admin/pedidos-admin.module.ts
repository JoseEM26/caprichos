import { Module } from '@nestjs/common';
import { PedidosAdminController } from './pedidos-admin.controller';
import { PedidosEstadoService } from './pedidos-estado.service';

@Module({
  controllers: [PedidosAdminController],
  providers: [
    PedidosEstadoService,
  ],
  exports: [PedidosEstadoService],
})
export class PedidosAdminModule {}
