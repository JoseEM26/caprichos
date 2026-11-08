import { Module } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AccesoModule } from '../acceso/acceso.module';
import { ImpresionService } from './impresion.service';
import { AgenteImpresionController } from './agente-impresion.controller';
import { AdminImpresionController } from './admin-impresion.controller';
import { ImpresionConfigController } from './impresion-config.controller';
import { ImpresionConfigService } from './impresion-config.service';
import { EquipoConfigController } from './equipo-config.controller';
import { EquipoConfigService } from './equipo-config.service';
import { DescargaAgenteController } from './descarga-agente.controller';
import { AgenteImpresionGuard } from './agente-impresion.guard';

@Module({
  imports: [
    AuditoriaModule,
    AccesoModule,
  ],
  controllers: [
    AgenteImpresionController,
    AdminImpresionController,
    ImpresionConfigController,
    EquipoConfigController,
    DescargaAgenteController,
  ],
  providers: [
    PrismaService,
    ImpresionService,
    ImpresionConfigService,
    EquipoConfigService,
    AgenteImpresionGuard,
  ],
  exports: [ImpresionService],
})
export class ImpresionModule {}
