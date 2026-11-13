import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ImpresionModule } from '../impresion/impresion.module';
import { ClientesModule } from '../clientes/clientes.module';
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';
import { ControlCuadreService } from './control-cuadre.service';
import { AnalisisCierreService } from './analisis-cierre.service';

@Module({
  imports: [CajaModule, ClientesModule, ImpresionModule],
  controllers: [CierreController],
  providers: [CierreService, ControlCuadreService, AnalisisCierreService],
  exports: [CierreService],
})
export class CierreModule {}
