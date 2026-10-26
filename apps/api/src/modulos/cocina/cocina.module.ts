import { Module, forwardRef } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { CocinaExistenciasController } from './cocina-existencias.controller';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';
import { SalonModule } from '../salon/salon.module';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';

@Module({
  imports: [SalonModule, forwardRef(() => AvisosInternosModule)],
  controllers: [CocinaController, CocinaExistenciasController],
  providers: [ComandasService, AgotadosService, AltaDemandaService],
  exports: [ComandasService, AgotadosService, AltaDemandaService],
})
export class CocinaModule {}

