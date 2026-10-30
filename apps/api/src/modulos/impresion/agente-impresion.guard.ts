import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';

@Injectable()
export class AgenteImpresionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    let llave: string | undefined;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      llave = authHeader.slice(7).trim();
    }

    if (!llave) {
      throw new UnauthorizedException({
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Llave de autorización requerida',
      });
    }

    const hash = crypto.createHash('sha256').update(llave).digest('hex');

    const dispositivo = await this.prisma.deviceKey.findFirst({
      where: {
        llave_hash: hash,
        tipo: 'AGENTE',
        activo: true,
      },
    });

    if (!dispositivo) {
      throw new UnauthorizedException({
        codigo: 'LLAVE_INVALIDA',
        mensaje: 'Llave de dispositivo inválida o inactiva',
      });
    }

    req.deviceKey = dispositivo;
    return true;
  }
}
