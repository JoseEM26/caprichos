import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PagosOnlineAdminController, PagosOnlinePublicoController } from './pagos-online.controller';
import { PagosOnlineService } from './pagos-online.service';
import { PASARELA_PAGO } from './pasarela.puerto';
import { crearPasarela } from './pasarela.fabrica';

@Module({
  imports: [CajaModule, ClientesModule],
  controllers: [PagosOnlinePublicoController, PagosOnlineAdminController],
  providers: [PagosOnlineService, { provide: PASARELA_PAGO, useFactory: () => crearPasarela() }],
  exports: [PagosOnlineService],
})
export class PagosOnlineModule {}
