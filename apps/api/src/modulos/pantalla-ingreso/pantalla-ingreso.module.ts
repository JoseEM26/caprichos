import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CartaIngresoController, PantallaIngresoAdminController } from './pantalla-ingreso.controller';
import { PantallaIngresoService } from './pantalla-ingreso.service';

@Module({
  imports: [ComunModule, AuditoriaModule],
  controllers: [CartaIngresoController, PantallaIngresoAdminController],
  providers: [PantallaIngresoService],
  exports: [PantallaIngresoService],
})
export class PantallaIngresoModule {}
