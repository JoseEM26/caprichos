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
import { ReasignarVoucherDto } from './dto/reasignar-voucher.dto';

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
    // Motivo del cambio (solo cuando reemplaza un voucher vigente), viene en el cuerpo multipart
    const motivoCambio = req.body?.motivoCambio != null ? String(req.body.motivoCambio) : undefined;
    const medioTexto = String(medioRaw ?? '').toUpperCase();
    const medioNormalizado = medioTexto.includes('PLIN')
      ? 'PLIN'
      : medioTexto.includes('YAPE')
      ? 'YAPE'
      : medioTexto.includes('TRANSF')
      ? 'TRANSFERENCIA'
      : medioTexto.includes('TARJ')
      ? 'TARJETA'
      : undefined;

    const ip = extraerIp(req);

    return this.vouchersService.subirYProcesar(
      file,
      {
        pedidoId,
        medio: medioNormalizado,
        motivoCambio,
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
   * El mozo envía a Caja el cobro de la mesa. Forma nueva: plan [{medio, monto}] (pago dividido),
   * recibido (efectivo) y comprobante {tipo, doc, razon}.
   * Forma anterior: medio (EFECTIVO | YAPE | PLIN | TRANSFERENCIA).
   * No cobra: Caja revisa el voucher y cobra. Permiso: vouchers/subir (MOZO, CAJERO, ADMIN)
   */
  @Post('enviar-a-caja')
  @Permiso('vouchers', 'subir')
  async enviarACaja(
    @Body('pedidoId') pedidoIdRaw: any,
    @Body('medio') medioRaw: any,
    @Body('plan') planRaw: any,
    @Body('recibido') recibidoRaw: any,
    @Body('comprobante') comprobanteRaw: any,
    @Req() req: any,
  ) {
    const pedidoId = pedidoIdRaw ? String(pedidoIdRaw).trim() : '';
    return this.vouchersService.enviarACaja(
      pedidoId,
      String(medioRaw ?? ''),
      req.usuario,
      extraerIp(req),
      planRaw ?? undefined,
      {
        recibido: recibidoRaw ?? undefined,
        comprobante: comprobanteRaw && typeof comprobanteRaw === 'object' ? comprobanteRaw : undefined,
      },
    );
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
   * GET /admin/vouchers/estado-ia
   * Pausa de la lectura con IA (saldo, clave o errores) y tope mensual. Lo usa la franja de Caja.
   * Permiso: vouchers/ver o configuracion/ver
   */
  @Get('estado-ia')
  @Permiso([
    { modulo: 'vouchers', accion: 'ver' },
    { modulo: 'configuracion', accion: 'ver' },
  ])
  async estadoIa() {
    return this.vouchersService.estadoIa();
  }

  /**
   * POST /admin/vouchers/:id/revisado
   * Registra revisado_por/en y auditoría.
   * Permiso: vouchers/ver (CAJERO, ADMIN)
   */
  /** Pedidos del mismo cliente a los que se puede mover este voucher (pago digital pendiente). */
  @Get(':id/destinos')
  @Permiso([
    { modulo: 'vouchers', accion: 'ver' },
    { modulo: 'caja', accion: 'ver' },
  ])
  async destinosReasignacion(@Param('id') id: string) {
    return this.vouchersService.destinosReasignacion(id);
  }

  /**
   * Caja mueve el comprobante a otro pedido del mismo cliente. La IA no aprueba nada: el pago se aprueba aparte.
   * Permiso: vouchers/ver o caja/ver (CAJERO y ADMIN tienen ambos).
   */
  @Post(':id/reasignar')
  @Permiso([
    { modulo: 'vouchers', accion: 'ver' },
    { modulo: 'caja', accion: 'ver' },
  ])
  async reasignar(@Param('id') id: string, @Body() dto: ReasignarVoucherDto, @Req() req: any) {
    const ip = extraerIp(req);
    return this.vouchersService.reasignar(id, dto.pedidoId, req.usuario, ip);
  }

  /**
   * POST /admin/vouchers/:id/quitar: retira el voucher sin borrarlo (queda en el historial como Retirado).
   * Mozo: solo sus pedidos, mientras Caja no apruebe el pago. Caja/Admin: motivo ≥5.
   */
  @Post(':id/quitar')
  @Permiso('vouchers', 'subir')
  async quitarVoucher(@Param('id') id: string, @Body('motivo') motivo: unknown, @Req() req: any) {
    return this.vouchersService.quitarVoucher(id, motivo, req.usuario, extraerIp(req));
  }

  @Post(':id/revisado')
  @Permiso('vouchers', 'ver')
  async marcarRevisado(@Param('id') id: string, @Req() req: any) {
    const ip = extraerIp(req);
    return this.vouchersService.marcarRevisado(id, req.usuario, ip);
  }
}
