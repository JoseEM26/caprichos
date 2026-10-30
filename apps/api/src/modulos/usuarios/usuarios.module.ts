import { Module, forwardRef } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { AvisosInternosModule } from '../chatbot/avisos-internos/avisos-internos.module';
import { ArchivosModule } from '../archivos/archivos.module';

@Module({
  imports: [forwardRef(() => AvisosInternosModule), ArchivosModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
