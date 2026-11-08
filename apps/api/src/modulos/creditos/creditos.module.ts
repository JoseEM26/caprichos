import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { ImpresionModule } from '../impresion/impresion.module';
import { CreditosController } from './creditos.controller';
import { CreditosService } from './creditos.service';

@Module({
  imports: [StockModule, ImpresionModule],
  controllers: [CreditosController],
  providers: [CreditosService],
  exports: [CreditosService],
})
export class CreditosModule {}
