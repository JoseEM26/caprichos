import { Module } from '@nestjs/common';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ReservasModule } from '../reservas/reservas.module';

@Module({
  imports: [PedidosModule, ReservasModule],
  controllers: [SalonController],
  providers: [SalonService],
  exports: [SalonService],
})
export class SalonModule {}
