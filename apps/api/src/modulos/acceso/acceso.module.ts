import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AccesoGuard } from './acceso.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET', 'secreto-dev-cambiar');
        const expiraMin = Number(config.get<string | number>('JWT_EXPIRA_MIN', 15));
        return {
          secret,
          signOptions: {
            expiresIn: `${expiraMin}m`,
            audience: 'admin',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AccesoGuard,
    AuthService,
    PrismaService,
    RedisService,
    AuditoriaService,
  ],
  exports: [AccesoGuard, JwtModule, AuthService],
})
export class AccesoModule {}
