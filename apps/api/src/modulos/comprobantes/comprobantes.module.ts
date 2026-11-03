import { Module } from '@nestjs/common';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesReintentosService } from './comprobantes-reintentos.service';
import { ComprobantesSunatService } from './comprobantes-sunat.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobanteDefectoService } from './comprobante-defecto.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { siguienteCorrelativo } from './secuencia';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { LocalModule } from '../local/local.module';

@Module({
  imports: [LocalModule],
  controllers: [ComprobantesController],
  providers: [
    ComprobantesService,
    ComprobantesReintentosService,
    ComprobantesSunatService,
    ComprobantesSaludService,
    ComprobanteDefectoService,
    {
      provide: SunatEmisor,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new SunatEmisor({
          emisorLocal: async () => ((await prisma.parametro.findUnique({ where: { clave: 'local_datos' } }))?.valor ?? {}) as Record<string, unknown>,
          correlativo: (clave: string) => siguienteCorrelativo(prisma, clave),
        }),
    },
  ],
  exports: [ComprobantesService, ComprobanteDefectoService],
})
export class ComprobantesModule {}
