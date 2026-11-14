import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { MediosPagoController } from './medios-pago.controller';
import { ConfiguracionService } from './configuracion.service';

@Module({
  controllers: [ConfiguracionController, MediosPagoController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
