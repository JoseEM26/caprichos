import { Module } from '@nestjs/common';
import { TiemposController } from './tiempos/tiempos.controller';
import { TiemposService } from './tiempos/tiempos.service';
import { RepartoAnalisisController } from './reparto/reparto.controller';
import { RepartoService } from './reparto/reparto.service';
import { EquipoController } from './equipo/equipo.controller';
import { EquipoService } from './equipo/equipo.service';
import { AlmacenAnalisisController } from './almacen/almacen.controller';
import { AlmacenAnalisisService } from './almacen/almacen.service';
import { AsistenciaModule } from '../asistencia';
import { CierreModule } from '../cierre';

/**
 * Módulo único de Análisis. Para sumar una pestaña (demanda, ventas, clientes…): crea su carpeta `<tema>/` con
 * `<tema>.controller.ts` (ruta `admin/analisis/<tema>`, permiso `analisis/ver`) y `<tema>.service.ts`,
 * y agrégalos a las dos listas de abajo. Los filtros y rangos comunes salen de `./comun/filtros`.
 */
@Module({
  imports: [AsistenciaModule, CierreModule],
  controllers: [
    TiemposController,
    RepartoAnalisisController,
    EquipoController,
    AlmacenAnalisisController,
  ],
  providers: [
    TiemposService,
    RepartoService,
    EquipoService,
    AlmacenAnalisisService,
  ],
})
export class AnalisisModule {}
