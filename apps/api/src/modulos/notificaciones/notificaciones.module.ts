import { Module } from '@nestjs/common';
import { AsistenciaModule } from '../asistencia/asistencia.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  imports: [AsistenciaModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
