import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService, FiltrosAuditoria } from './auditoria.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';

@Controller('admin/auditoria')
@UseGuards(AccesoGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Permiso('auditoria', 'ver')
  async listar(
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('partyId') partyId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('entidad') entidad?: string,
    @Query('categoria') categoria?: string,
    @Query('resultado') resultado?: string,
    @Query('busqueda') busqueda?: string,
    @Query('motivo') motivo?: string,
    @Query('pedido') pedido?: string,
    @Query('producto') producto?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    const filtros: FiltrosAuditoria = {
      modulo,
      accion,
      partyId,
      desde,
      hasta,
      entidad,
      categoria,
      resultado,
      busqueda,
      motivo,
      pedido,
      producto,
      pagina: pagina ? parseInt(pagina, 10) : undefined,
      limite: limite ? parseInt(limite, 10) : undefined,
    };
    return this.auditoriaService.listar(filtros);
  }

  @Get('opciones')
  @Permiso('auditoria', 'ver')
  async opciones() {
    return this.auditoriaService.opciones();
  }

  @Get('personas')
  @Permiso('auditoria', 'ver')
  async personas(@Query('q') q?: string) {
    return this.auditoriaService.personas(q ?? '');
  }

  @Get('verificar')
  @Permiso('auditoria', 'ver')
  async verificarCadena() {
    return this.auditoriaService.verificarCadena();
  }
}
