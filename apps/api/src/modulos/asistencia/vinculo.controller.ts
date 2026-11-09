import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AnularAjusteDto, VacacionMovimientoDto, VinculoDto } from './dto/planilla.dto';
import { VacacionesService } from './vacaciones.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Vínculo (planilla o contrato temporal), contrato PDF y vacaciones: solo ADMIN (planilla/ver y planilla/administrar). */
@Controller('admin/planilla')
@UseGuards(AccesoGuard)
export class VinculoController {
  constructor(private readonly vac: VacacionesService) {}

  @Get('vinculo/:partyId')
  @Permiso('planilla', 'ver')
  ver(@Param('partyId') partyId: string) {
    return this.vac.obtener(Number(partyId));
  }

  @Put('vinculo/:partyId')
  @Permiso('planilla', 'administrar')
  guardar(@Param('partyId') partyId: string, @Body() dto: VinculoDto, @Req() req: any) {
    return this.vac.guardarVinculo(Number(partyId), dto, req.usuario, ipDe(req));
  }

  @Post('vinculo/:partyId/contrato')
  @Permiso('planilla', 'administrar')
  @UseInterceptors(FileInterceptor('archivo'))
  subir(@Param('partyId') partyId: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.vac.subirContrato(Number(partyId), file, req.usuario, ipDe(req));
  }

  /** Descarga del contrato con permiso de planilla; la lectura queda auditada. */
  @Get('vinculo/:partyId/contrato')
  @Permiso('planilla', 'ver')
  async contrato(@Param('partyId') partyId: string, @Query('vinculo') vinculo: string | undefined, @Req() req: any, @Res() res: any) {
    const { rutaAbsoluta, tipoMime, bytes } = await this.vac.contrato(Number(partyId), req.usuario, ipDe(req), req.headers?.['user-agent'], vinculo ? Number(vinculo) : undefined);
    res.setHeader('Content-Type', tipoMime);
    res.setHeader('Content-Length', bytes);
    res.setHeader('Content-Disposition', 'inline; filename="contrato.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    fs.createReadStream(rutaAbsoluta).pipe(res);
  }

  @Post('vacaciones')
  @Permiso('planilla', 'administrar')
  registrar(@Body() dto: VacacionMovimientoDto, @Req() req: any) {
    return this.vac.registrar(dto, req.usuario, ipDe(req));
  }

  @Post('vacaciones/:id/anular')
  @Permiso('planilla', 'administrar')
  anular(@Param('id') id: string, @Body() dto: AnularAjusteDto, @Req() req: any) {
    return this.vac.anular(Number(id), dto.motivo, req.usuario, ipDe(req));
  }
}
