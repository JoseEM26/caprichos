import { Module } from '@nestjs/common';
import { RepartosController } from './repartos.controller';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';

@Module({
  controllers: [RepartosController],
  providers: [RepartosService, RutaService],
  exports: [RepartosService, RutaService],
})
export class RepartosModule {}
