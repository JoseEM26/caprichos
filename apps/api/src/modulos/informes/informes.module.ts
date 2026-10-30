import { Module } from '@nestjs/common';
import { InformesController } from './informes.controller';
import { InformesService } from './informes.service';
import { EncuestasEstadisticaController } from './encuestas-estadistica.controller';
import { EncuestasEstadisticaService } from './encuestas-estadistica.service';

@Module({
  controllers: [InformesController, EncuestasEstadisticaController],
  providers: [InformesService, EncuestasEstadisticaService],
  exports: [InformesService],
})
export class InformesModule {}
