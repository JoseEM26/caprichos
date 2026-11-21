import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { llaveDe } from './tv.limite';

/** Deja pasar solo a una TV vinculada (llave Bearer, tipo TV) y activa. Desactivada: 401 PANTALLA_DESACTIVADA. */
@Injectable()
export class TvGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const llave = llaveDe(req);
    if (!llave) {
      throw new UnauthorizedException({ codigo: 'NO_AUTENTICADO', mensaje: 'Llave de la pantalla requerida' });
    }
    const hash = crypto.createHash('sha256').update(llave).digest('hex');
    const tv = await this.prisma.deviceKey.findFirst({ where: { llave_hash: hash, tipo: 'TV' } });
    if (!tv) {
      throw new UnauthorizedException({ codigo: 'LLAVE_INVALIDA', mensaje: 'Llave de la pantalla inválida' });
    }
    if (!tv.activo || tv.codigo_vinculo) {
      throw new UnauthorizedException({ codigo: 'PANTALLA_DESACTIVADA', mensaje: 'Esta pantalla no está vinculada o fue desactivada' });
    }
    // Marca de conexión como mucho una vez por minuto
    if (!tv.ultima_conexion || Date.now() - tv.ultima_conexion.getTime() > 60_000) {
      await this.prisma.deviceKey.update({ where: { id: tv.id }, data: { ultima_conexion: new Date() } }).catch(() => undefined);
    }
    req.tv = tv;
    return true;
  }
}
