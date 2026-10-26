import { Module, forwardRef } from '@nestjs/common';
import { InsumosService } from './insumos.service';
import { StockService } from './stock.service';
import { RecetasService } from './recetas.service';
import { StockController } from './stock.controller';
import { RecetasController } from './recetas.controller';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';

@Module({
  imports: [forwardRef(() => AvisosInternosModule)],
  controllers: [StockController, RecetasController],
  providers: [InsumosService, StockService, RecetasService],
  exports: [InsumosService, StockService, RecetasService],
})
export class StockModule {}
