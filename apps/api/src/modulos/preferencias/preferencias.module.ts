import { Module } from '@nestjs/common';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasUsuarioService } from './preferencias-usuario.service';

@Module({
  controllers: [PreferenciasController],
  providers: [PreferenciasUsuarioService],
  exports: [PreferenciasUsuarioService],
})
export class PreferenciasModule {}
