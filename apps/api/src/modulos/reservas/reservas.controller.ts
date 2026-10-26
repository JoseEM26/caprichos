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
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ActualizarReservaDto } from './dto/actualizar-reserva.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';

@Controller('admin/reservas')
@UseGuards(AccesoGuard)
export class ReservasController {
  constructor(private readonly reservasService: ReservasService) {}

  /**
   * 1) POST /admin/reservas (reservas/crear)
   * Registra una reserva en un solo formulario.
   */
  @Post()
  @Permiso('reservas', 'crear')
  async crear(@Body() dto: CrearReservaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.crear(dto, req.usuario, ip);
  }

  /**
   * 2) GET /admin/reservas (reservas/ver)
   * Lista reservas según filtros opcionales.
   */
  @Get()
  @Permiso('reservas', 'ver')
  async listar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('estado') estado?: string,
  ) {
    return this.reservasService.listar({ desde, hasta, estado });
  }

  /**
   * 2) GET /admin/reservas/calendario?mes=YYYY-MM (reservas/ver)
   * Cantidad de reservas ACTIVAS por día del mes.
   */
  @Get('calendario')
  @Permiso('reservas', 'ver')
  async calendario(@Query('mes') mes: string) {
    return this.reservasService.calendario(mes);
  }

  /**
   * 2) GET /admin/reservas/agenda?fecha=YYYY-MM-DD (reservas/ver)
   * Agenda del día por hora.
   */
  @Get('agenda')
  @Permiso('reservas', 'ver')
  async agenda(@Query('fecha') fecha: string) {
    return this.reservasService.agenda(fecha);
  }

  /**
   * 2) GET /admin/reservas/mesa/:mesaId/hoy (reservas/ver)
   * Reservas activas de hoy de una mesa (para la marca del plano).
   */
  @Get('mesa/:mesaId/hoy')
  @Permiso('reservas', 'ver')
  async reservasMesaHoy(@Param('mesaId') mesaId: string) {
    return this.reservasService.reservasMesaHoy(mesaId);
  }

  /**
   * 3) PATCH /admin/reservas/:id (reservas/editar)
   * Edita datos de la reserva solo si está ACTIVA.
   */
  @Patch(':id')
  @Permiso('reservas', 'editar')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarReservaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.actualizar(id, dto, req.usuario, ip);
  }

  /**
   * 3) POST /admin/reservas/:id/cancelar (reservas/editar)
   * Pasa a CANCELADA con motivo obligatorio (5 o más caracteres).
   */
  @Post(':id/cancelar')
  @Permiso('reservas', 'editar')
  async cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarReservaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.cancelar(id, dto, req.usuario, ip);
  }

  /**
   * 3) POST /admin/reservas/:id/sentar (reservas/editar)
   * Marca SENTADA y devuelve { mesas: [ids], personas, nombre }.
   */
  @Post(':id/sentar')
  @Permiso('reservas', 'editar')
  async sentar(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.sentar(id, req.usuario, ip);
  }

  /**
   * 4) GET /admin/reservas/disponibilidad (reservas/ver)
   * Consulta franjas horarias disponibles para una fecha y cantidad de personas.
   */
  @Get('disponibilidad')
  @Permiso('reservas', 'ver')
  async disponibilidad(
    @Query('fecha') fecha: string,
    @Query('personas') personas: string,
  ) {
    const p = parseInt(personas, 10) || 2;
    return this.reservasService.obtenerFranjasDisponibles(fecha, p);
  }

  /**
   * 5) GET /admin/reservas/solicitudes (reservas/ver)
   * Lista solicitudes de reserva generadas desde WhatsApp.
   */
  @Get('solicitudes')
  @Permiso('reservas', 'ver')
  async listarSolicitudes(@Query('estado') estado?: string) {
    return this.reservasService.listarSolicitudes({ estado });
  }

  /**
   * 6) POST /admin/reservas/solicitudes/:id/aprobar (reservas/editar)
   * Aprueba la solicitud asignando mesas y notifica al cliente por WhatsApp.
   */
  @Post('solicitudes/:id/aprobar')
  @Permiso('reservas', 'editar')
  async aprobarSolicitud(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.aprobarSolicitud(id, body, req.usuario, ip);
  }

  /**
   * 7) POST /admin/reservas/solicitudes/:id/rechazar (reservas/editar)
   * Rechaza la solicitud con motivo obligatorio y notifica al cliente por WhatsApp.
   */
  @Post('solicitudes/:id/rechazar')
  @Permiso('reservas', 'editar')
  async rechazarSolicitud(
    @Param('id') id: string,
    @Body() body: { motivo: string; alternativas?: string },
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasService.rechazarSolicitud(id, body, req.usuario, ip);
  }
}
