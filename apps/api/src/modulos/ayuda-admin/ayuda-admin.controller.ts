import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { AyudaAdminService } from './ayuda-admin.service';
import { AyudaGrafoService } from './ayuda-grafo.service';
import { PreguntarAyudaDto } from './dto/preguntar-ayuda.dto';
import { ContextoAyudaRespuesta, PreguntarAyudaRespuesta } from './ayuda-admin.tipos';
import { ResumenGrafoRespuesta } from './ayuda-grafo.tipos';

@Controller('admin/ayuda')
@UseGuards(AccesoGuard)
export class AyudaAdminController {
  constructor(
    private readonly ayudaAdminService: AyudaAdminService,
    private readonly ayudaGrafoService: AyudaGrafoService,
  ) {}

  @Get('contexto')
  async obtenerContexto(
    @Req() req: any,
    @Query('ruta') ruta?: string,
  ): Promise<ContextoAyudaRespuesta> {
    return this.ayudaAdminService.obtenerContexto(req.usuario, ruta);
  }

  @Post('preguntar')
  async preguntar(
    @Req() req: any,
    @Body() dto: PreguntarAyudaDto,
  ): Promise<PreguntarAyudaRespuesta> {
    return this.ayudaAdminService.preguntar(req.usuario, dto);
  }

  @Get('grafo')
  async obtenerGrafo(@Req() req: any): Promise<ResumenGrafoRespuesta> {
    const rol = (req.usuario?.rol || '').toUpperCase();
    if (rol !== 'ADMIN') {
      throw new ForbiddenException('Solo el rol ADMIN puede consultar el grafo de ayuda');
    }
    return this.ayudaGrafoService.obtenerResumenGrafo();
  }
}
