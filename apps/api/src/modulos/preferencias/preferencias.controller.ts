import { BadRequestException, Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PreferenciasUsuarioService } from './preferencias-usuario.service';

/** Solo estas claves se pueden leer/guardar por la API (lista cerrada: no es un cajón libre). */
export const CLAVES_PREFERENCIA_PERMITIDAS = ['caja.tabla.columnas', 'caja.vista', 'caja.lista.orden', 'caja.tabla.filas', 'cierre.ventas.columnas', 'cierre.ventas.vista', 'cierre.ventas.filas'] as const;
/** Tope del valor serializado (caracteres aprox.). */
export const MAX_BYTES_PREFERENCIA = 2000;

function validarClave(clave: string): void {
  if (!(CLAVES_PREFERENCIA_PERMITIDAS as readonly string[]).includes(clave)) {
    throw new BadRequestException({ codigo: 'CLAVE_NO_PERMITIDA', mensaje: 'Preferencia no permitida' });
  }
}

/** Preferencias personales: el party sale siempre del token, nadie lee ni cambia las de otro. */
@Controller('admin/preferencias')
@UseGuards(AccesoGuard)
export class PreferenciasController {
  constructor(private readonly preferencias: PreferenciasUsuarioService) {}

  @Get(':clave')
  async obtener(@Param('clave') clave: string, @Req() req: any) {
    validarClave(clave);
    const valor = await this.preferencias.obtener(req.usuario.partyId, clave);
    return { clave, valor: valor ?? null };
  }

  @Put(':clave')
  async guardar(@Param('clave') clave: string, @Body() body: { valor?: unknown }, @Req() req: any) {
    validarClave(clave);
    const valor = body?.valor;
    if (valor === undefined || valor === null) {
      await this.preferencias.borrar(req.usuario.partyId, clave);
      return { clave, valor: null };
    }
    if (JSON.stringify(valor).length > MAX_BYTES_PREFERENCIA) {
      throw new BadRequestException({ codigo: 'VALOR_MUY_GRANDE', mensaje: 'Valor demasiado grande' });
    }
    await this.preferencias.guardar(req.usuario.partyId, clave, valor as any);
    return { clave, valor };
  }
}
