import { Injectable } from '@nestjs/common';
import { PrismaService } from '../comun/prisma/prisma.service';
import { RedisService } from '../comun/redis/redis.service';
import { RespuestaSalud } from '@caprichos/compartido';

@Injectable()
export class SaludService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async verificarSalud(): Promise<RespuestaSalud> {
    const [base, redis] = await Promise.all([
      this.prismaService.verificarConexion(),
      this.redisService.verificarConexion(),
    ]);

    const todoOk = base.conectado && redis.conectado;

    return {
      estado: todoOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      detalles: {
        base: {
          estado: base.conectado ? 'conectado' : 'desconectado',
          ...(base.mensaje ? { mensaje: base.mensaje } : {}),
        },
        redis: {
          estado: redis.conectado ? 'conectado' : 'desconectado',
          ...(redis.mensaje ? { mensaje: redis.mensaje } : {}),
        },
      },
    };
  }
}
