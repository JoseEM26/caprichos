import { Module } from '@nestjs/common';
import { PreferenciasUsuarioService } from './preferencias-usuario.service';

@Module({
  providers: [PreferenciasUsuarioService],
  exports: [PreferenciasUsuarioService],
})
export class PreferenciasModule {}
