import { Module } from '@nestjs/common';
import { AlmacenController } from './almacen.controller';
import { AlmacenService } from './almacen.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  controllers: [AlmacenController],
  providers: [AlmacenService],
  exports: [AlmacenService],
})
export class AlmacenModule {}
