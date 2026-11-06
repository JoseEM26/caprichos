import { Body, Controller, Get, Param, Post, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CambioCobroService, CapturasCambioCobro } from './cambio-cobro.service';

const CAMPOS_CAPTURA = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

const ipDe = (req: any): string | undefined => (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;

/**
 * Cambio de forma de pago en la puerta: el repartidor solicita (con la captura de cada medio digital) y
 * Caja, Admin o Supervisor valida. El supervisor no necesita código: es validar un pago, no anular.
 */
@Controller('admin')
@UseGuards(AccesoGuard)
export class CambioCobroController {
  constructor(private readonly cambio: CambioCobroService) {}

  /** Multipart: plan (JSON), pagaCon opcional y una captura por medio digital en `captura_<MEDIO>`. */
  @Post('repartos/:id/solicitar-cambio-cobro')
  @Permiso('repartos', 'solicitar_cambio_cobro')
  @UseInterceptors(FileFieldsInterceptor(CAMPOS_CAPTURA.map((m) => ({ name: `captura_${m}`, maxCount: 1 }))))
  async solicitar(
    @Param('id') id: string,
    @Body() body: { plan?: unknown; pagaCon?: unknown },
    @UploadedFiles() files: Record<string, Express.Multer.File[] | undefined> | undefined,
    @Req() req: any,
  ) {
    const capturas: CapturasCambioCobro = {};
    for (const m of CAMPOS_CAPTURA) capturas[m] = files?.[`captura_${m}`]?.[0];
    return this.cambio.solicitar(id, body ?? {}, capturas, req.usuario, ipDe(req));
  }

  /** Solicitud más reciente del pedido (el repartidor ve el resultado en vivo). */
  @Get('repartos/:id/cambio-cobro')
  @Permiso('repartos', 'ver')
  async vigente(@Param('id') id: string, @Req() req: any) {
    return this.cambio.vigente(id, req.usuario);
  }

  /** Solicitudes pendientes para la insignia y el panel de Caja. */
  @Get('pedidos/cambio-cobro/pendientes')
  @Permiso('pedidos', 'validar_cambio_cobro')
  async pendientes() {
    return this.cambio.pendientes();
  }

  @Post('pedidos/:id/cambio-cobro/:solicitudId/resolver')
  @Permiso('pedidos', 'validar_cambio_cobro')
  async resolver(
    @Param('id') id: string,
    @Param('solicitudId') solicitudId: string,
    @Body() dto: { accion?: unknown; motivo?: unknown },
    @Req() req: any,
  ) {
    return this.cambio.resolver(id, solicitudId, dto ?? {}, req.usuario, ipDe(req));
  }
}
