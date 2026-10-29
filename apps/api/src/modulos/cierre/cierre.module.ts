import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ClientesModule } from '../clientes/clientes.module';
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';

@Module({
  imports: [CajaModule, ClientesModule],
  controllers: [CierreController],
  providers: [CierreService],
  exports: [CierreService],
})
export class CierreModule {}
