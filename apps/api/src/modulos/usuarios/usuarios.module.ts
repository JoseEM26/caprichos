import { Module, forwardRef } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsuariosAreasController } from './usuarios-areas.controller';
import { UsuariosAreasService } from './usuarios-areas.service';

@Module({
  imports: [forwardRef(() => AvisosInternosModule), ArchivosModule, AuditoriaModule],
  controllers: [UsuariosController, UsuariosAreasController],
  providers: [UsuariosService, UsuariosAreasService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
