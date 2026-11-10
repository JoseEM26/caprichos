import { Controller, Get, HttpException, HttpStatus, Param, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RedisService } from '../../comun/redis/redis.service';
import { RucService } from './ruc.service';

export const RUC_PUBLICO_MAX_POR_MINUTO = 10;

/** Consulta pública desde la carta: límite por IP porque cada fallo de caché llama a un tercero. */
@Controller('carta/ruc')
export class RucPublicoController {
  constructor(private readonly ruc: RucService, private readonly redis: RedisService) {}

  @Get(':ruc')
  async consultar(@Param('ruc') ruc: string, @Req() req: any) {
    const ip = String(req.ip || req.headers?.['x-forwarded-for'] || 'sin-ip');
    try {
      const cliente = this.redis.obtenerCliente();
      const clave = `ruc:ip:${ip}`;
      const n = await cliente.incr(clave);
      if (n === 1) await cliente.expire(clave, 60);
      if (n > RUC_PUBLICO_MAX_POR_MINUTO) {
        throw new HttpException({ codigo: 'DEMASIADAS_CONSULTAS', mensaje: 'Demasiadas consultas, espera un minuto' }, HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (e) {
      if (e instanceof HttpException) throw e; // sin Redis no se limita
    }
    return this.ruc.consultar(ruc);
  }
}

@Controller('admin/ruc')
@UseGuards(AccesoGuard)
export class RucAdminController {
  constructor(private readonly ruc: RucService) {}

  @Get(':ruc')
  @Permiso('comprobantes', 'ver')
  consultar(@Param('ruc') ruc: string) {
    return this.ruc.consultar(ruc);
  }
}
