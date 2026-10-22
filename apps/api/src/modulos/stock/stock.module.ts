import { Module } from '@nestjs/common';
import { InsumosService } from './insumos.service';
import { StockService } from './stock.service';
import { RecetasService } from './recetas.service';
import { StockController } from './stock.controller';
import { RecetasController } from './recetas.controller';

@Module({
  controllers: [StockController, RecetasController],
  providers: [InsumosService, StockService, RecetasService],
  exports: [InsumosService, StockService, RecetasService],
})
export class StockModule {}
