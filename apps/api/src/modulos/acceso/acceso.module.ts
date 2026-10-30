import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccesoGuard } from './acceso.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SincronizadorPermisosService } from './sincronizador-permisos.service';
import { ArchivosModule } from '../archivos/archivos.module';
import { MiPerfilController } from './mi-perfil.controller';
import { MiPerfilService } from './mi-perfil.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    ArchivosModule,
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
  controllers: [AuthController, MiPerfilController],
  providers: [
    AccesoGuard,
    AuthService,
    SincronizadorPermisosService,
    MiPerfilService,
  ],
  exports: [AccesoGuard, JwtModule, AuthService],
})
export class AccesoModule {}
