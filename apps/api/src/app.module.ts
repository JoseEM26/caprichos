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
import { NotificacionesModule } from './modulos/notificaciones/notificaciones.module';
import { DireccionesModule } from './modulos/direcciones/direcciones.module';
import { StockModule } from './modulos/stock/stock.module';
import { ComprasModule } from './modulos/compras/compras.module';
import { AlmacenModule } from './modulos/almacen/almacen.module';

import { ClientesModule } from './modulos/clientes/clientes.module';
import { OfertasModule } from './modulos/ofertas/ofertas.module';
import { InformesModule } from './modulos/informes/informes.module';
import { CreditosModule } from './modulos/creditos/creditos.module';
import { IniciativasModule } from './modulos/iniciativas/iniciativas.module';
import { MensajesModule } from './modulos/mensajes/mensajes.module';
import { PantallasModule } from './modulos/pantallas/pantallas.module';
import { ContenidoModule } from './modulos/contenido/contenido.module';
import { SupervisorCodigoModule } from './modulos/supervisor-codigo/supervisor-codigo.module';
import { ChatbotModule } from './modulos/chatbot/chatbot.module';
import { ImpresionModule } from './modulos/impresion/impresion.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    ComunModule,
    SupervisorCodigoModule,
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
    ChatbotModule,
    ReclamosModule,
    DireccionesModule,
    NotificacionesModule,
    InformesModule,
    OfertasModule,
    ClientesModule,
    StockModule,
    MensajesModule,
    PantallasModule,
    IniciativasModule,
    CreditosModule,
    ComprasModule,
    AlmacenModule,
    ContenidoModule,
    ImpresionModule,
  ],
  providers: [
    PinoLoggerService,
  ],
  exports: [
    PinoLoggerService,
  ],
})
export class AppModule {}
