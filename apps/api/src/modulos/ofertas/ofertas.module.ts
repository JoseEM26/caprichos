import { Module } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { OfertasController, CuponesController } from './ofertas.controller';
import { OfertasPublicoController } from './ofertas-publico.controller';

@Module({
  controllers: [OfertasController, CuponesController, OfertasPublicoController],
  providers: [OfertasService],
  exports: [OfertasService],
})
export class OfertasModule {}
