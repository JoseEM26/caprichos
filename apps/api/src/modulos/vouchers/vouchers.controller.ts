import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { VouchersService } from './vouchers.service';

const extraerIp = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

@Controller('admin/vouchers')
@UseGuards(AccesoGuard)
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  /**
   * POST /admin/vouchers
   * Sube multipart (archivo + pedidoId + medio YAPE|PLIN), analiza y guarda.
   * Permiso: vouchers/subir (MOZO, CAJERO, ADMIN)
   * Mozo recibe { id, legible: boolean, mensaje?: string }
   * Cajero/Admin recibe { id, legible, semaforo, motivos, extraido }
   */
  @Post()
  @Permiso('vouchers', 'subir')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'archivo', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ]),
  )
  async subirVoucher(
    @UploadedFiles()
    files: {
      archivo?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
    @Body('pedidoId') pedidoIdRaw: any,
    @Body('medio') medioRaw: any,
    @Req() req: any,
  ) {
    const file = files?.archivo?.[0] || files?.file?.[0];
    const pedidoId = pedidoIdRaw ? String(pedidoIdRaw).trim() : undefined;
    const medioNormalizado =
      medioRaw && String(medioRaw).toUpperCase().includes('PLIN')
        ? 'PLIN'
        : medioRaw && String(medioRaw).toUpperCase().includes('YAPE')
        ? 'YAPE'
        : undefined;

    const ip = extraerIp(req);

    return this.vouchersService.subirYProcesar(
      file,
      {
        pedidoId,
        medio: medioNormalizado,
      },
      req.usuario,
      ip,
    );
  }

  /**
   * POST /admin/vouchers/aviso-sin-foto
   * El mozo avisa a Caja que el pago digital del pedido no tiene foto todavía.
   * Permiso: vouchers/subir (MOZO, CAJERO, ADMIN)
   */
  @Post('aviso-sin-foto')
  @Permiso('vouchers', 'subir')
  async avisarSinFoto(@Body('pedidoId') pedidoIdRaw: any, @Req() req: any) {
    const pedidoId = pedidoIdRaw ? String(pedidoIdRaw).trim() : '';
    return this.vouchersService.avisarFaltaVoucher(pedidoId, req.usuario, extraerIp(req));
  }

  /**
   * POST /admin/vouchers/enviar-a-caja
   * El mozo envía a Caja el cobro de la mesa (medio: EFECTIVO | YAPE | PLIN | TRANSFERENCIA).
   * No cobra: Caja revisa el voucher y cobra. Permiso: vouchers/subir (MOZO, CAJERO, ADMIN)
   */
  @Post('enviar-a-caja')
  @Permiso('vouchers', 'subir')
  async enviarACaja(
    @Body('pedidoId') pedidoIdRaw: any,
    @Body('medio') medioRaw: any,
    @Req() req: any,
  ) {
    const pedidoId = pedidoIdRaw ? String(pedidoIdRaw).trim() : '';
    return this.vouchersService.enviarACaja(pedidoId, String(medioRaw ?? ''), req.usuario, extraerIp(req));
  }

  /**
   * GET /admin/vouchers?pedidoId= | ?conversacionId= | ?fecha=YYYY-MM-DD&estado=pendientes|todos
   * Permiso: vouchers/ver (CAJERO, ADMIN)
   */
  @Get()
  @Permiso('vouchers', 'ver')
  async listarVouchers(
    @Query('pedidoId') pedidoId?: string,
    @Query('conversacionId') conversacionId?: string,
    @Query('fecha') fecha?: string,
    @Query('estado') estado?: string,
  ) {
    return this.vouchersService.listar({
      pedidoId,
      conversacionId,
      fecha,
      estado,
    });
  }

  /**
   * GET /admin/vouchers/consumo
   * Resumen de consumo de OpenAI en vouchers para la tarjeta de Configuración.
   * Permiso: vouchers/ver (CAJERO, ADMIN) o configuracion/ver
   */
  @Get('consumo')
  @Permiso([
    { modulo: 'vouchers', accion: 'ver' },
    { modulo: 'configuracion', accion: 'ver' },
  ])
  async obtenerConsumo() {
    return this.vouchersService.obtenerConsumoMesVoucher();
  }

  /**
   * POST /admin/vouchers/:id/revisado
   * Registra revisado_por/en y auditoría.
   * Permiso: vouchers/ver (CAJERO, ADMIN)
   */
  @Post(':id/revisado')
  @Permiso('vouchers', 'ver')
  async marcarRevisado(@Param('id') id: string, @Req() req: any) {
    const ip = extraerIp(req);
    return this.vouchersService.marcarRevisado(id, req.usuario, ip);
  }
}
