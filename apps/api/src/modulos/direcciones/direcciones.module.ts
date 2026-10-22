import { Module } from '@nestjs/common';
import { DireccionesController } from './direcciones.controller';
import { DireccionesService } from './direcciones.service';

@Module({
  controllers: [DireccionesController],
  providers: [DireccionesService],
})
export class DireccionesModule {}
