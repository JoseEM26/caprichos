import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { LocalService } from './local.service';
import {
  ActualizarHorarioDiaDto,
  ActualizarHorarioSemanaDto,
} from './dto/actualizar-horario.dto';
import { CrearFechaEspecialDto } from './dto/crear-fecha-especial.dto';
import { ActualizarFechaEspecialDto } from './dto/actualizar-fecha-especial.dto';
import { ActualizarDatosLocalDto } from './dto/actualizar-datos-local.dto';
import { ActualizarPagosDto } from './dto/actualizar-pagos.dto';
import { SubirFotoLocalDto } from './dto/foto-local.dto';

@Controller('admin/local')
@UseGuards(AccesoGuard)
export class LocalController {
  constructor(private readonly localService: LocalService) {}

  // ================= HORARIO =================

  @Get('horario')
  @Permiso('local', 'ver')
  async obtenerHorario() {
    return this.localService.obtenerHorarioAdmin();
  }

  @Put('horario')
  @Permiso('local', 'editar')
  async actualizarHorario(
    @Body() body: ActualizarHorarioDiaDto[] | ActualizarHorarioSemanaDto,
    @Req() req: any,
  ) {
    const dias = Array.isArray(body) ? body : body.dias;
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.actualizarHorarioAdmin(dias, req.usuario, ip);
  }

  // ================= FECHAS ESPECIALES =================

  @Get('fechas-especiales')
  @Permiso('local', 'ver')
  async listarFechasEspeciales() {
    return this.localService.listarFechasEspeciales();
  }

  @Post('fechas-especiales')
  @Permiso('local', 'editar')
  async crearFechaEspecial(
    @Body() dto: CrearFechaEspecialDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.crearFechaEspecial(dto, req.usuario, ip);
  }

  @Put('fechas-especiales/:fecha')
  @Permiso('local', 'editar')
  async actualizarFechaEspecial(
    @Param('fecha') fecha: string,
    @Body() dto: ActualizarFechaEspecialDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.actualizarFechaEspecial(fecha, dto, req.usuario, ip);
  }

  @Delete('fechas-especiales/:fecha')
  @Permiso('local', 'editar')
  async eliminarFechaEspecial(
    @Param('fecha') fecha: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.eliminarFechaEspecial(fecha, new Date(), req.usuario, ip);
  }

  // ================= DATOS DEL LOCAL =================

  @Get('datos')
  @Permiso('local', 'ver')
  async obtenerDatos() {
    return this.localService.obtenerDatosLocal();
  }

  @Put('datos')
  @Permiso('local', 'editar')
  async actualizarDatos(
    @Body() dto: ActualizarDatosLocalDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.actualizarDatosLocal(dto, req.usuario, ip);
  }

  // ================= FOTOS DEL LOCAL =================

  @Get('fotos')
  @Permiso('local', 'ver')
  async listarFotos() {
    return this.localService.listarFotosLocal();
  }

  @Put('fotos/:slot')
  @Permiso('local', 'editar')
  async subirFoto(
    @Param('slot') slot: string,
    @Body() dto: SubirFotoLocalDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.subirFotoLocal(slot, dto, req.usuario, ip);
  }

  @Delete('fotos/:slot')
  @Permiso('local', 'editar')
  async desactivarFoto(@Param('slot') slot: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.desactivarFotoLocal(slot, req.usuario, ip);
  }

  // ================= MEDIOS DE PAGO =================

  @Get('pagos')
  @Permiso('local', 'ver')
  async obtenerPagos() {
    return this.localService.obtenerPagosLocal();
  }

  @Put('pagos')
  @Permiso('local', 'editar')
  async actualizarPagos(
    @Body() dto: ActualizarPagosDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.localService.actualizarPagosLocal(dto, req.usuario, ip);
  }
}
