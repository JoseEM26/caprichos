import { Module, forwardRef } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsuariosAreasController } from './usuarios-areas.controller';
import { UsuariosAreasService } from './usuarios-areas.service';
import { UsuariosRolesService } from './usuarios-roles.service';
import { UsuariosPermisosService } from './usuarios-permisos.service';
import { UsuariosRolesMasivoService } from './usuarios-roles-masivo.service';
import { UsuariosActividadService } from './usuarios-actividad.service';

@Module({
  imports: [forwardRef(() => AvisosInternosModule), ArchivosModule, AuditoriaModule],
  controllers: [UsuariosController, UsuariosAreasController],
  providers: [UsuariosService, UsuariosAreasService, UsuariosRolesService, UsuariosPermisosService, UsuariosRolesMasivoService, UsuariosActividadService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
