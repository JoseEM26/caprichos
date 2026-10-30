import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ReclamosService } from './reclamos.service';
import { FiltrarReclamosDto, ResponderReclamoDto } from './dto';

@Controller('admin/reclamos')
@UseGuards(AccesoGuard)
export class ReclamosAdminController {
  constructor(private readonly reclamosService: ReclamosService) {}

  /**
   * Listado paginado de reclamos y quejas con filtros y cálculo de urgencia por fecha límite.
   * Documento y teléfono enmascarados para usuarios con rol no ADMIN (ADR-005, Ley 29733).
   */
  @Get()
  @Permiso('reclamos', 'ver')
  async listar(@Query() filtros: FiltrarReclamosDto, @Req() req: any) {
    return this.reclamosService.listarAdmin(filtros, req.usuario);
  }

  /**
   * Detalle completo de un reclamo en administración.
   * Registra auditoría de lectura sensible (acción VER_RECLAMO).
   */
  @Get(':id')
  @Permiso('reclamos', 'ver')
  async obtenerPorId(@Param('id') id: string, @Req() req: any) {
    const rawIp = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const ip = rawIp ? (rawIp.split(',')[0] || '').trim() : undefined;
    return this.reclamosService.obtenerPorIdAdmin(id, req.usuario, ip);
  }

  /**
   * Pasa un reclamo al estado EN_REVISION.
   */
  @Post(':id/en-revision')
  @Permiso('reclamos', 'responder')
  async marcarEnRevision(@Param('id') id: string, @Req() req: any) {
    const rawIp = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const ip = rawIp ? (rawIp.split(',')[0] || '').trim() : undefined;
    return this.reclamosService.marcarEnRevision(id, req.usuario, ip);
  }

  /**
   * Responde formalmente a un reclamo o queja.
   * Pasa a estado RESPONDIDO registrando quién y cuándo.
   * Si ya fue respondido, devuelve 409 YA_RESPONDIDO.
   */
  @Post(':id/responder')
  @Permiso('reclamos', 'responder')
  async responder(
    @Param('id') id: string,
    @Body() dto: ResponderReclamoDto,
    @Req() req: any,
  ) {
    const rawIp = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const ip = rawIp ? (rawIp.split(',')[0] || '').trim() : undefined;
    return this.reclamosService.responder(id, dto, req.usuario, ip);
  }
}
