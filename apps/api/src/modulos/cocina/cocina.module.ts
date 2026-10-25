import { Module } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { CocinaExistenciasController } from './cocina-existencias.controller';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';
import { SalonModule } from '../salon/salon.module';

@Module({
  imports: [SalonModule],
  controllers: [CocinaController, CocinaExistenciasController],
  providers: [ComandasService, AgotadosService, AltaDemandaService],
  exports: [ComandasService, AgotadosService, AltaDemandaService],
})
export class CocinaModule {}

