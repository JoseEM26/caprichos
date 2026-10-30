import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import {
  CartaMascotaController,
  MascotaAdminController,
} from './mascota.controller';
import { MascotaService } from './mascota.service';

@Module({
  imports: [ComunModule, AuditoriaModule],
  controllers: [CartaMascotaController, MascotaAdminController],
  providers: [MascotaService],
  exports: [MascotaService],
})
export class MascotaModule {}
