import { Module } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AccesoModule } from '../acceso/acceso.module';
import { ImpresionService } from './impresion.service';
import { AgenteImpresionController } from './agente-impresion.controller';
import { AdminImpresionController } from './admin-impresion.controller';
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
    DescargaAgenteController,
  ],
  providers: [
    PrismaService,
    ImpresionService,
    AgenteImpresionGuard,
  ],
  exports: [ImpresionService],
})
export class ImpresionModule {}
