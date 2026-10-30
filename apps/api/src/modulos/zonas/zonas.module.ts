import { Module } from '@nestjs/common';
import { CartaEnvioController, ZonasAdminController } from './zonas.controller';
import { ZonasService } from './zonas.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [CartaEnvioController, ZonasAdminController],
  providers: [ZonasService],
  exports: [ZonasService],
})
export class ZonasModule {}
