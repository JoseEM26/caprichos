import { Controller, Get, HttpException, HttpStatus, Param, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RedisService } from '../../comun/redis/redis.service';
import { RucService } from './ruc.service';
import { DniService } from './dni.service';

export const RUC_PUBLICO_MAX_POR_MINUTO = 10;
const PERMISOS_CONSULTA_DOC = [
  { modulo: 'comprobantes', accion: 'ver' },
  { modulo: 'pedidos', accion: 'crear' },
];

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

  // Caja/Admin (comprobantes.ver) y mozo (toma pedidos pero no ve comprobantes: pedidos.crear)
  @Get(':ruc')
  @Permiso(PERMISOS_CONSULTA_DOC)
  consultar(@Param('ruc') ruc: string) {
    return this.ruc.consultar(ruc);
  }
}

/**
 * DNI solo en el panel (autenticado): en la carta pública NO hay consulta por DNI porque
 * cualquiera podría enumerar nombres de personas por número (Ley 29733).
 */
@Controller('admin/dni')
@UseGuards(AccesoGuard)
export class DniAdminController {
  constructor(private readonly dni: DniService) {}

  @Get(':dni')
  @Permiso(PERMISOS_CONSULTA_DOC)
  consultar(@Param('dni') dni: string) {
    return this.dni.consultarDni(dni);
  }
}
