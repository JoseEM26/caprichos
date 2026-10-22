import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { CobrosService } from './cobros.service';
import { SalonModule } from '../salon/salon.module';
import { ComprobantesModule } from '../comprobantes/comprobantes.module';
import { ClientesModule } from '../clientes/clientes.module';
import { StockModule } from '../stock/stock.module';
import { OfertasModule } from '../ofertas/ofertas.module';

@Module({
  imports: [SalonModule, ComprobantesModule, ClientesModule, StockModule, OfertasModule],
  controllers: [CajaController],
  providers: [CajaService, CobrosService],
  exports: [CajaService, CobrosService],
})
export class CajaModule {}
