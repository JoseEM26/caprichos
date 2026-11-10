import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CLAVE_PERMISO, CLAVE_SOLO_CAMBIO_CLAVE } from './permiso.decorator';
import { UsuarioAutenticado } from './acceso.tipos';
import { permisosExtraVigentes, rolesDeCuenta } from './roles-usuario';

@Injectable()
export class AccesoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    let token: string | undefined;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      throw new HttpException(
        { codigo: 'NO_AUTENTICADO', mensaje: 'Token de autorización no proporcionado' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'secreto-dev-cambiar');
    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
        audience: 'admin',
      });
    } catch {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Token inválido o expirado' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rawPartyId = payload.partyId ?? payload.sub;
    if (!rawPartyId) {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Identificador de usuario no presente en token' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const partyId = BigInt(rawPartyId);
    const userAccount = await this.prisma.userAccount.findUnique({
      where: { party_id: partyId },
    });

    if (!userAccount) {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Usuario no encontrado' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!userAccount.activo) {
      throw new HttpException(
        { codigo: 'USUARIO_DESACTIVADO', mensaje: 'El usuario se encuentra desactivado' },
        HttpStatus.FORBIDDEN,
      );
    }

    // «Cerrar todas las sesiones»: un token emitido antes del cierre ya no vale, aunque no haya vencido
    const cierre = userAccount.sesiones_cerradas_en;
    if (cierre && typeof payload.iat === 'number' && payload.iat < Math.floor(cierre.getTime() / 1000)) {
      throw new HttpException(
        { codigo: 'SESION_CERRADA', mensaje: 'Tu sesión fue cerrada. Ingresa de nuevo.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const roles = await rolesDeCuenta(this.prisma, userAccount.id, userAccount.rol);
    const usuario: UsuarioAutenticado = {
      partyId: userAccount.party_id,
      rol: userAccount.rol,
      debeCambiar: userAccount.debe_cambiar,
      roles,
    };

    req.usuario = usuario;

    const soloCambioClave = this.reflector.getAllAndOverride<boolean>(
      CLAVE_SOLO_CAMBIO_CLAVE,
      [context.getHandler(), context.getClass()],
    );

    if (userAccount.debe_cambiar && !soloCambioClave) {
      throw new HttpException(
        { codigo: 'DEBE_CAMBIAR_CLAVE', mensaje: 'Debe cambiar su contraseña antes de continuar' },
        HttpStatus.FORBIDDEN,
      );
    }

    const permisoRequerido = this.reflector.getAllAndOverride<any>(
      CLAVE_PERMISO,
      [context.getHandler(), context.getClass()],
    );

    if (permisoRequerido) {
      const lista: Array<{ modulo: string; accion: string }> = Array.isArray(permisoRequerido)
        ? permisoRequerido
        : [permisoRequerido];

      // Unión de permisos: basta que cualquiera de los roles de la cuenta lo tenga
      const rolPermiso = await this.prisma.rolPermiso.findFirst({
        where: {
          rol: { in: roles },
          OR: lista.map((p) => ({
            permiso: {
              modulo: p.modulo,
              accion: p.accion,
            },
          })),
        },
      });

      // Permiso extra por persona (aditivo, con vencimiento): solo se consulta si los roles no alcanzan
      let porExtra = false;
      if (!rolPermiso) {
        const extras = await permisosExtraVigentes(this.prisma, userAccount.id);
        porExtra = lista.some((p) => extras.includes(`${p.modulo}/${p.accion}`));
      }

      if (!rolPermiso && !porExtra) {
        const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
        const dispositivo = req.headers['user-agent'] as string | undefined;

        await this.auditoria.registrar({
          categoria: 'ACCESO',
          modulo: lista[0].modulo,
          accion: lista[0].accion,
          resultado: 'RECHAZADO',
          motivo: 'SIN_PERMISO',
          partyId: userAccount.party_id,
          ip,
          dispositivo,
        });

        throw new HttpException(
          { codigo: 'SIN_PERMISO', mensaje: 'No tiene permiso para realizar esta acción' },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return true;
  }
}
