import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ArchivosModule } from '../archivos/archivos.module';
import { RecuperarClaveService } from './recuperar-clave.service';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { PartyPuntosService } from './party-puntos.service';
import { CodigoRegistroService } from './codigo-registro.service';
import { FacturacionClienteService } from './facturacion-cliente.service';
import { AvisoCuentaService } from './aviso-cuenta.service';
import { CuentaClienteController } from './cuenta-cliente.controller';
import { ClientesAdminController } from './clientes-admin.controller';

@Module({
  imports: [
    JwtModule.register({}),
    ArchivosModule,
  ],
  controllers: [
    CuentaClienteController,
    ClientesAdminController,
  ],
  providers: [
    ClientesService,
    RecuperarClaveService,
    PuntosService,
    DireccionesClienteService,
    PartyPuntosService,
    CodigoRegistroService,
    AvisoCuentaService,
    FacturacionClienteService,
  ],
  exports: [
    ClientesService,
    PuntosService,
    DireccionesClienteService,
    PartyPuntosService,
    FacturacionClienteService,
  ],
})
export class ClientesModule {}
