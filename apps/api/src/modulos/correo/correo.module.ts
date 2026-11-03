import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AvisosEquipoCorreoService } from './avisos-equipo-correo.service';
import { CorreoService } from './correo.service';

@Module({
  imports: [ComunModule],
  providers: [CorreoService, AvisosEquipoCorreoService],
  exports: [CorreoService, AvisosEquipoCorreoService],
})
export class CorreoModule {}
