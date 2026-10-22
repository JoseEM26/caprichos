import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ReclamosService } from './reclamos.service';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';

@Controller()
export class ReclamosPublicoController {
  constructor(private readonly reclamosService: ReclamosService) {}

  /**
   * Registro público de reclamos o quejas en el Libro de Reclamaciones virtual.
   * Límite de 5 solicitudes/hora por IP vía Redis.
   */
  @Post('reclamos')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() dto: CrearReclamoDto, @Req() req: any) {
    const rawIp = (req.ip || req.headers?.['x-forwarded-for'] || '127.0.0.1') as string;
    const ip = (rawIp.split(',')[0] || '').trim();
    return this.reclamosService.crear(dto, ip);
  }

  /**
   * Consulta pública de constancia de reclamo por número y documento.
   * Si el documento no coincide o no existe, responde 404 genérico sin revelar su existencia.
   */
  @Get('reclamos/constancia/:numero')
  async obtenerConstancia(
    @Param('numero') numero: string,
    @Query('documento') documento?: string,
  ) {
    return this.reclamosService.obtenerConstanciaPublica(numero, documento);
  }

  /**
   * Consulta pública de términos, privacidad y plazo legal de atención (GET /carta/legal).
   */
  @Get('carta/legal')
  async obtenerCartaLegal() {
    return this.reclamosService.obtenerCartaLegal();
  }
}
