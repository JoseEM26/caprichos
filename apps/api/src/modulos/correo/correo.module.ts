import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AvisosEquipoCorreoService } from './avisos-equipo-correo.service';
import { CorreoService } from './correo.service';
import { CorreosExtraService } from './correos-extra.service';
import { CorreosExtraController } from './correos-extra.controller';

@Module({
  imports: [ComunModule],
  controllers: [CorreosExtraController],
  providers: [CorreoService, CorreosExtraService, AvisosEquipoCorreoService],
  exports: [CorreoService, CorreosExtraService, AvisosEquipoCorreoService],
})
export class CorreoModule {}
