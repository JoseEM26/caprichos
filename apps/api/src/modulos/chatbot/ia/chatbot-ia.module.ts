import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { CatalogoModule } from '../../catalogo/catalogo.module';
import { OfertasModule } from '../../ofertas/ofertas.module';
import { LocalModule } from '../../local/local.module';
import { ZonasModule } from '../../zonas/zonas.module';
import { IaHerramientasService } from './ia-herramientas.service';
import { IaConsumoService } from './ia-consumo.service';
import { ConocimientoBotService } from './conocimiento-bot.service';
import { ChatbotIaService } from './chatbot-ia.service';
import { IaConsumoController } from './ia-consumo.controller';

@Module({
  imports: [
    ComunModule,
    CatalogoModule,
    OfertasModule,
    LocalModule,
    ZonasModule,
  ],
  controllers: [IaConsumoController],
  providers: [
    IaHerramientasService,
    IaConsumoService,
    ChatbotIaService,
    ConocimientoBotService,
  ],
  exports: [
    IaHerramientasService,
    IaConsumoService,
    ChatbotIaService,
    ConocimientoBotService,
  ],
})
export class ChatbotIaModule {}
