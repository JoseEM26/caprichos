import { Module } from '@nestjs/common';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesReintentosService } from './comprobantes-reintentos.service';
import { ComprobantesNocturnoService } from './comprobantes-nocturno.service';
import { ComprobantesSunatService } from './comprobantes-sunat.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobanteDefectoService } from './comprobante-defecto.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { siguienteCorrelativo } from './secuencia';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { LocalModule } from '../local/local.module';
import { CorreoModule } from '../correo/correo.module';
import { ComprobantesCertificadoAvisoService } from './comprobantes-certificado-aviso.service';

@Module({
  imports: [LocalModule, CorreoModule],
  controllers: [ComprobantesController],
  providers: [
    ComprobantesService,
    ComprobantesReintentosService,
    ComprobantesSunatService,
    ComprobantesNocturnoService,
    ComprobantesSaludService,
    ComprobanteDefectoService,
    ComprobantesCertificadoAvisoService,
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
