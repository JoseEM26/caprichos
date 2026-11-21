import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AnunciosAdminController, CartaAnunciosController, PersonalAnunciosController } from './anuncios.controller';
import { AnunciosService } from './anuncios.service';

@Module({
  imports: [ComunModule, AuditoriaModule],
  // PersonalAnunciosController va antes: '/admin/anuncios/mios' no debe caer en ':id'
  controllers: [CartaAnunciosController, PersonalAnunciosController, AnunciosAdminController],
  providers: [AnunciosService],
  exports: [AnunciosService],
})
export class AnunciosModule {}
