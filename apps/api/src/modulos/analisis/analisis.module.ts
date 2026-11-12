import { Module } from '@nestjs/common';
import { TiemposController } from './tiempos/tiempos.controller';
import { TiemposService } from './tiempos/tiempos.service';

/**
 * Módulo único de Análisis. Para sumar una pestaña (demanda, ventas, clientes…): crea su carpeta `<tema>/` con
 * `<tema>.controller.ts` (ruta `admin/analisis/<tema>`, permiso `analisis/ver`) y `<tema>.service.ts`,
 * y agrégalos a las dos listas de abajo. Los filtros y rangos comunes salen de `./comun/filtros`.
 */
@Module({
  controllers: [TiemposController],
  providers: [TiemposService],
})
export class AnalisisModule {}
