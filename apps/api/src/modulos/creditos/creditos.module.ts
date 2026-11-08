import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { CreditosController } from './creditos.controller';
import { CreditosService } from './creditos.service';

@Module({
  imports: [StockModule],
  controllers: [CreditosController],
  providers: [CreditosService],
  exports: [CreditosService],
})
export class CreditosModule {}
