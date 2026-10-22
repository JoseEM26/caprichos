import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from './config/entorno.validacion';
import { PinoLoggerService } from './comun/logger/pino-logger.service';
import { ComunModule } from './comun/comun.module';
import { SaludModule } from './salud/salud.module';
import { VersionModule } from './version/version.module';
import { AccesoModule } from './modulos/acceso/acceso.module';
import { AuditoriaModule } from './modulos/auditoria/auditoria.module';
import { UsuariosModule } from './modulos/usuarios/usuarios.module';
import { ConfiguracionModule } from './modulos/configuracion/configuracion.module';
import { CatalogoModule } from './modulos/catalogo/catalogo.module';
import { LocalModule } from './modulos/local/local.module';
import { ArchivosModule } from './modulos/archivos/archivos.module';
import { ZonasModule } from './modulos/zonas/zonas.module';
import { PedidosModule } from './modulos/pedidos/pedidos.module';
import { PedidosAdminModule } from './modulos/pedidos-admin/pedidos-admin.module';
import { CajaModule } from './modulos/caja/caja.module';
import { CierreModule } from './modulos/cierre/cierre.module';
import { RepartosModule } from './modulos/repartos/repartos.module';
import { CocinaModule } from './modulos/cocina/cocina.module';
import { PlanoModule } from './modulos/plano/plano.module';
import { ReservasModule } from './modulos/reservas/reservas.module';
import { SalonModule } from './modulos/salon/salon.module';
import { ComprobantesModule } from './modulos/comprobantes/comprobantes.module';
import { ReclamosModule } from './modulos/reclamos/reclamos.module';
import { DireccionesModule } from './modulos/direcciones/direcciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    ComunModule,
    SaludModule,
    VersionModule,
    AuditoriaModule,
    AccesoModule,
    UsuariosModule,
    ConfiguracionModule,
    ArchivosModule,
    CatalogoModule,
    LocalModule,
    ZonasModule,
    PedidosModule,
    PedidosAdminModule,
    CajaModule,
    CierreModule,
    RepartosModule,
    CocinaModule,
    PlanoModule,
    ReservasModule,
    SalonModule,
    ComprobantesModule,
    ReclamosModule,
    DireccionesModule,
  ],
  providers: [
    PinoLoggerService,
  ],
  exports: [
    PinoLoggerService,
  ],
})
export class AppModule {}
