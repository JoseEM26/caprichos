import { Module, forwardRef } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { CocinaExistenciasController } from './cocina-existencias.controller';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { DespachoService } from './despacho.service';
import { AltaDemandaService } from './alta-demanda.service';
import { SalonModule } from '../salon/salon.module';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { PreferenciasModule } from '../preferencias/preferencias.module';
import { AjustesPersonalesCocinaService } from './ajustes-personales.service';

@Module({
  imports: [
    SalonModule,
    PreferenciasModule,
    forwardRef(() => AvisosInternosModule),
    forwardRef(() => ChatbotModule),
  ],
  controllers: [CocinaController, CocinaExistenciasController],
  providers: [ComandasService, AgotadosService, AltaDemandaService, AjustesPersonalesCocinaService, DespachoService],
  exports: [ComandasService, AgotadosService, AltaDemandaService],
})
export class CocinaModule {}

