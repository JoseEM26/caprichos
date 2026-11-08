import {
  Body,
  Controller,
  Get,
  Optional,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { OfertasService } from '../../ofertas/ofertas.service';
import { lineasPromosVigentes } from '../conversacion/bienvenida.util';
import { ChatbotConfiguracionService } from './chatbot-configuracion.service';
import {
  ActualizarAntiSpamDto,
  ActualizarFuncionesBotDto,
  ActualizarRetencionDto,
  ActualizarTextosBotDto,
  BajaClienteDto,
  ExportarClienteQueryDto,
  RestablecerTextoBotDto,
} from './dto/chatbot-configuracion.dto';

@Controller('admin/chatbot/configuracion')
@UseGuards(AccesoGuard)
export class ChatbotConfiguracionController {
  constructor(
    private readonly configuracionService: ChatbotConfiguracionService,
    @Optional() private readonly ofertasService?: OfertasService,
  ) {}

  /** Promociones vigentes ahora para la carta, tal como saldrían en la bienvenida (para la vista previa). */
  @Get('promos-vigentes')
  @Permiso('configuracion', 'ver')
  async promosVigentes() {
    const ofertas = (await this.ofertasService?.listarOfertas(undefined, true, 'CARTA', true)) ?? [];
    return { lineas: lineasPromosVigentes(ofertas, 5) };
  }

  /**
   * Obtiene la configuración consolidada del chatbot.
   */
  @Get()
  @Permiso('configuracion', 'ver')
  async obtenerConfiguracion() {
    return this.configuracionService.obtenerConfiguracion();
  }

  /**
   * Actualiza los textos editables del bot respetando el límite de WhatsApp (1024 caracteres).
   */
  @Put('textos')
  @Permiso('configuracion', 'editar')
  async actualizarTextos(
    @Body() dto: ActualizarTextosBotDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizarTextos(dto, req.usuario, ip);
  }

  /**
   * Restablece un texto del bot a su valor por defecto del mockup.
   */
  @Post('textos/restablecer')
  @Permiso('configuracion', 'editar')
  async restablecerTexto(
    @Body() dto: RestablecerTextoBotDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.restablecerTexto(dto.clave, req.usuario, ip);
  }

  /**
   * Actualiza los interruptores de función del bot (pedido, pago, reservas, cambios, IA, promociones).
   */
  @Put('funciones')
  @Permiso('configuracion', 'editar')
  async actualizarFunciones(
    @Body() dto: ActualizarFuncionesBotDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizarFunciones(dto, req.usuario, ip);
  }

  /**
   * Actualiza los parámetros del límite de frecuencia anti-spam en Redis.
   */
  @Put('anti-spam')
  @Permiso('configuracion', 'editar')
  async actualizarAntiSpam(
    @Body() dto: ActualizarAntiSpamDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizarAntiSpam(dto, req.usuario, ip);
  }

  /**
   * Actualiza el plazo de retención de mensajes en días.
   */
  @Put('retencion')
  @Permiso('configuracion', 'editar')
  async actualizarRetencion(
    @Body() dto: ActualizarRetencionDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizarRetencion(dto, req.usuario, ip);
  }

  /**
   * Ejecuta la anonimización de mensajes antiguos según la política de retención Ley 29733.
   */
  @Post('retencion/ejecutar')
  @Permiso('configuracion', 'editar')
  async ejecutarAnonimizacionRetencion(@Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.ejecutarAnonimizacionRetencion(req.usuario, ip);
  }

  /**
   * Exporta todos los datos personales asociados a un cliente sin exponer teléfonos completos.
   */
  @Get('privacidad/exportar')
  @Permiso('configuracion', 'ver')
  async exportarDatosCliente(
    @Query() query: ExportarClienteQueryDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.exportarDatosCliente(
      query.identificador,
      req.usuario,
      ip,
    );
  }

  /**
   * Da de baja a un cliente y anonimiza sus mensajes y nombre por solicitud de un administrador.
   */
  @Post('privacidad/baja')
  @Permiso('configuracion', 'editar')
  async darDeBajaCliente(
    @Body() dto: BajaClienteDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.darDeBajaCliente(
      dto.identificador,
      dto.motivo,
      req.usuario,
      ip,
    );
  }
}
