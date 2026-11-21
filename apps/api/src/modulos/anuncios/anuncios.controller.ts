import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AnunciosService } from './anuncios.service';
import { ActivoAnuncioDto, EventoAnuncioDto, GuardarAnuncioDto } from './dto/anuncio.dto';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Público: anuncios vigentes de la carta (sin datos personales) y registro ligero de vista, cierre y clic. */
@Controller('carta/anuncios')
export class CartaAnunciosController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  vigentes() {
    return this.anuncios.vigentesCarta();
  }

  @Post(':id/evento')
  evento(@Param('id') id: string, @Body() dto: EventoAnuncioDto, @Req() req: any) {
    return this.anuncios.eventoCarta(id, dto.tipo, ipDe(req));
  }
}

/** Personal: lo que le toca ver a la persona que ingresó al panel. Basta estar autenticado (sin permiso de módulo). */
@Controller('admin/anuncios/mios')
@UseGuards(AccesoGuard)
export class PersonalAnunciosController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  vigentes(@Req() req: any) {
    return this.anuncios.vigentesPersonal(req.usuario);
  }

  @Post(':id/evento')
  evento(@Param('id') id: string, @Body() dto: EventoAnuncioDto, @Req() req: any) {
    return this.anuncios.eventoPersonal(id, dto.tipo, req.usuario);
  }
}

@Controller('admin/anuncios')
@UseGuards(AccesoGuard)
export class AnunciosAdminController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  @Permiso('anuncios', 'ver')
  listar(@Query('estado') estado?: string, @Query('publico') publico?: string) {
    return this.anuncios.listar({ estado, publico });
  }

  @Get(':id')
  @Permiso('anuncios', 'ver')
  obtener(@Param('id') id: string) {
    return this.anuncios.obtener(id);
  }

  @Get(':id/vista-previa')
  @Permiso('anuncios', 'ver')
  vistaPrevia(@Param('id') id: string) {
    return this.anuncios.vistaPrevia(id);
  }

  @Post()
  @Permiso('anuncios', 'crear')
  crear(@Body() dto: GuardarAnuncioDto, @Req() req: any) {
    return this.anuncios.crear(dto, req.usuario, ipDe(req));
  }

  @Put(':id')
  @Permiso('anuncios', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: GuardarAnuncioDto, @Req() req: any) {
    return this.anuncios.actualizar(id, dto, req.usuario, ipDe(req));
  }

  @Post(':id/activo')
  @Permiso('anuncios', 'editar')
  activar(@Param('id') id: string, @Body() dto: ActivoAnuncioDto, @Req() req: any) {
    return this.anuncios.activar(id, dto.activo, req.usuario, ipDe(req));
  }

  @Post(':id/duplicar')
  @Permiso('anuncios', 'crear')
  duplicar(@Param('id') id: string, @Req() req: any) {
    return this.anuncios.duplicar(id, req.usuario, ipDe(req));
  }

  @Delete(':id')
  @Permiso('anuncios', 'eliminar')
  eliminar(@Param('id') id: string, @Req() req: any) {
    return this.anuncios.eliminar(id, req.usuario, ipDe(req));
  }
}
