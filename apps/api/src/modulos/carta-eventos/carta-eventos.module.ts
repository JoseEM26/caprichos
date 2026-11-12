import { Module } from '@nestjs/common';
import { CartaEventosController } from './carta-eventos.controller';
import { CartaEventosService } from './carta-eventos.service';

@Module({
  controllers: [CartaEventosController],
  providers: [CartaEventosService],
  exports: [CartaEventosService],
})
export class CartaEventosModule {}
