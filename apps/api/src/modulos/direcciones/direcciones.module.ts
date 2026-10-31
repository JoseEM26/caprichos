import { Module } from '@nestjs/common';
import { AccesoModule } from '../acceso/acceso.module';
import { DireccionesAdminController } from './direcciones-admin.controller';
import { DireccionesController } from './direcciones.controller';
import { DireccionesService } from './direcciones.service';

@Module({
  imports: [AccesoModule],
  controllers: [DireccionesController, DireccionesAdminController],
  providers: [DireccionesService],
  exports: [DireccionesService],
})
export class DireccionesModule {}
