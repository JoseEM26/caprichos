import { Module } from '@nestjs/common';
import { CortesiasController, CortesiaLineaController } from './cortesias.controller';
import { CortesiasService } from './cortesias.service';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [StockModule],
  controllers: [CortesiasController, CortesiaLineaController],
  providers: [CortesiasService],
  exports: [CortesiasService],
})
export class CortesiasModule {}
