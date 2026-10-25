import { Module } from '@nestjs/common';
import { AlmacenController } from './almacen.controller';
import { AlmacenService } from './almacen.service';
import { StockModule } from '../stock/stock.module';
import { SupervisorCodigoModule } from '../supervisor-codigo/supervisor-codigo.module';

@Module({
  imports: [StockModule, SupervisorCodigoModule],
  controllers: [AlmacenController],
  providers: [AlmacenService],
  exports: [AlmacenService],
})
export class AlmacenModule {}
