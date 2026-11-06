import { Module } from '@nestjs/common';
import { AsistenciaModule } from '../asistencia/asistencia.module';
import { PropinasModule } from './propinas.module';
import { PropinasMiController, PropinasRepartoController } from './propinas-reparto.controller';
import { PropinasRepartoService } from './propinas-reparto.service';

@Module({
  imports: [PropinasModule, AsistenciaModule],
  controllers: [PropinasRepartoController, PropinasMiController],
  providers: [PropinasRepartoService],
})
export class PropinasRepartoModule {}
