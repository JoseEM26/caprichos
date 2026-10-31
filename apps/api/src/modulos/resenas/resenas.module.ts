import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AccesoModule } from '../acceso/acceso.module';
import { ResenasGoogleService } from './resenas-google.service';
import { ResenasAdminController } from './resenas-admin.controller';
import { ResenasCartaController } from './resenas-carta.controller';

@Module({
  imports: [AuditoriaModule, AccesoModule],
  controllers: [ResenasAdminController, ResenasCartaController],
  providers: [ResenasGoogleService],
  exports: [ResenasGoogleService],
})
export class ResenasModule {}
