import { Module } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { OfertasController, CuponesController } from './ofertas.controller';
import { OfertasPublicoController } from './ofertas-publico.controller';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  controllers: [OfertasController, CuponesController, OfertasPublicoController],
  imports: [ClientesModule],
  providers: [OfertasService],
  exports: [OfertasService],
})
export class OfertasModule {}
