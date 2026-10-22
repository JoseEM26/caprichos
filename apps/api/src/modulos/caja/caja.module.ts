import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { CobrosService } from './cobros.service';

@Module({
  controllers: [CajaController],
  providers: [CajaService, CobrosService],
  exports: [CajaService, CobrosService],
})
export class CajaModule {}
