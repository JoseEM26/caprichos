import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import {
  EditarNombreContactoDto,
  ListarConversacionesDto,
  RechazarCambioDto,
  RechazarPagoDto,
  TextoDto,
  TomarDto,
} from './dto/mensajes.dto';
import { MensajesService } from './mensajes.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

@Controller('admin/mensajes')
@UseGuards(AccesoGuard)
export class MensajesController {
  constructor(private readonly mensajes: MensajesService) {}

  @Get('conversaciones')
  @Permiso('mensajes', 'ver')
  listar(@Query() f: ListarConversacionesDto) {
    return this.mensajes.listar(f.filtro, f.q);
  }

  @Get('respuestas-rapidas')
  @Permiso('mensajes', 'ver')
  respuestasRapidas() {
    return this.mensajes.respuestasRapidas();
  }

  @Get('conversaciones/:id')
  @Permiso('mensajes', 'ver')
  detalle(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.detalle(id, req.usuario);
  }

  @Post('conversaciones/:id/enviar')
  @Permiso('mensajes', 'enviar')
  enviar(@Param('id') id: string, @Body() dto: TextoDto, @Req() req: any) {
    return this.mensajes.enviar(id, dto.texto, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/reabrir-plantilla')
  @Permiso('mensajes', 'enviar')
  reabrirPlantilla(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.reabrirConPlantilla(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/mensajes/:mensajeId/reintentar')
  @Permiso('mensajes', 'enviar')
  reintentar(
    @Param('id') id: string,
    @Param('mensajeId') mensajeId: string,
    @Req() req: any,
  ) {
    return this.mensajes.reintentarMensaje(id, mensajeId, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/pulir')
  @Permiso('mensajes', 'enviar')
  async pulir(@Param('id') id: string, @Body() dto: TextoDto, @Req() req: any) {
    const d = await this.mensajes.detalle(id, req.usuario);
    return this.mensajes.pulir(id, dto.texto, d.nombre);
  }

  @Post('conversaciones/:id/tomar')
  @Permiso('mensajes', 'tomar')
  tomar(@Param('id') id: string, @Body() dto: TomarDto, @Req() req: any) {
    return this.mensajes.tomar(id, !!dto?.forzar, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/soltar')
  @Permiso('mensajes', 'tomar')
  soltar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.soltar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/pausar')
  @Permiso('mensajes', 'tomar')
  pausar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.pausar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/reanudar')
  @Permiso('mensajes', 'tomar')
  reanudar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.reanudar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/atendido')
  @Permiso('mensajes', 'cerrar')
  atendido(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.marcarAtendido(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/aprobar-pago')
  @Permiso('mensajes', 'enviar')
  aprobarPago(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.aprobarPago(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/rechazar-pago')
  @Permiso('mensajes', 'enviar')
  rechazarPago(
    @Param('id') id: string,
    @Body() dto: RechazarPagoDto,
    @Req() req: any,
  ) {
    return this.mensajes.rechazarPago(id, dto?.motivo, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/aplicar-cambio')
  @Permiso('mensajes', 'enviar')
  aplicarCambio(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.aplicarCambio(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/rechazar-cambio')
  @Permiso('mensajes', 'enviar')
  rechazarCambio(
    @Param('id') id: string,
    @Body() dto: RechazarCambioDto,
    @Req() req: any,
  ) {
    return this.mensajes.rechazarCambio(id, dto?.motivo, req.usuario, ipDe(req));
  }

  @Patch('conversaciones/:id/nombre')
  @Permiso('mensajes', 'tomar')
  editarNombre(
    @Param('id') id: string,
    @Body() dto: EditarNombreContactoDto,
    @Req() req: any,
  ) {
    return this.mensajes.editarNombre(id, dto, req.usuario, ipDe(req));
  }
}
