import { Module } from '@nestjs/common';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';
import { SalonVivoService } from './salon-vivo.service';
import { SalonVivoController } from './salon-vivo.controller';
import { BorradorMesaService } from './borrador-mesa.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { ImpresionModule } from '../impresion/impresion.module';

@Module({
  imports: [PedidosModule, ReservasModule, ImpresionModule],
  controllers: [SalonController, SalonVivoController],
  providers: [SalonService, BorradorMesaService, SalonVivoService],
  exports: [SalonService, SalonVivoService],
})
export class SalonModule {}
