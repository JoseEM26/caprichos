import { Module } from '@nestjs/common';
import { AlmacenController } from './almacen.controller';
import { AlmacenService } from './almacen.service';
import { PendientesAlmacenService } from './pendientes-almacen.service';
import { ConsumoRecetaModule } from './consumo-receta.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule, ConsumoRecetaModule],
  controllers: [AlmacenController],
  providers: [AlmacenService, PendientesAlmacenService],
  exports: [AlmacenService],
})
export class AlmacenModule {}
