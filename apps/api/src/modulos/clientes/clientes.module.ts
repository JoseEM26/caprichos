import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import { CuentaClienteController } from './cuenta-cliente.controller';
import { ClientesAdminController } from './clientes-admin.controller';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [
    CuentaClienteController,
    ClientesAdminController,
  ],
  providers: [
    ClientesService,
    PuntosService,
  ],
  exports: [
    ClientesService,
    PuntosService,
  ],
})
export class ClientesModule {}
