import { Module } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';

@Module({
  controllers: [CocinaController],
  providers: [ComandasService, AgotadosService, AltaDemandaService],
  exports: [ComandasService, AgotadosService, AltaDemandaService],
})
export class CocinaModule {}
