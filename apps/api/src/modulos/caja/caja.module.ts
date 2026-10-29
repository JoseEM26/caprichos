import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { CobrosService } from './cobros.service';
import { CajaAvisoAperturaService } from './caja-aviso-apertura.service';
import { LocalModule } from '../local/local.module';
import { SalonModule } from '../salon/salon.module';
import { ComprobantesModule } from '../comprobantes/comprobantes.module';
import { ClientesModule } from '../clientes/clientes.module';
import { StockModule } from '../stock/stock.module';
import { OfertasModule } from '../ofertas/ofertas.module';

@Module({
  imports: [SalonModule, ComprobantesModule, ClientesModule, StockModule, OfertasModule, LocalModule],
  controllers: [CajaController],
  providers: [CajaService, CobrosService, CajaAvisoAperturaService],
  exports: [CajaService, CobrosService],
})
export class CajaModule {}
