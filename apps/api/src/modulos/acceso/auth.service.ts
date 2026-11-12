import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { diaCalendarioLima, esCumpleanosHoy } from '../../comun/fechas-lima';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CambiarContrasenaDto, IngresarDto } from './auth.dto';
import { permisosDeCuenta, rolesDeCuenta, TIPOS_DOCUMENTO } from './roles-usuario';

export function enmascararDni(dni: string): string {
  if (!dni || dni.length < 4) {
    return '****';
  }
  return `${dni.slice(0, 2)}****${dni.slice(-2)}`;
}

export function hashSha256(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export interface RespuestaAutenticacion {
  accessToken: string;
  debeCambiar: boolean;
  usuario: {
    partyId: string;
    nombres: string;
    rol: string;
    roles: string[];
  };
}

export interface ResultadoIngreso {
  respuesta: RespuestaAutenticacion;
  rawRefreshToken: string;
  maxAgeMs: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Quién es el usuario de la sesión y qué puede hacer (el front arma su menú con esto). */
  async yo(partyId: bigint): Promise<{
    partyId: string;
    nombres: string;
    fotoUrl: string | null;
    rol: string;
    roles: string[];
    debeCambiar: boolean;
    permisos: string[];
    cumpleHoy: boolean;
  }> {
    const cuenta = await this.prisma.userAccount.findUnique({
      where: { party_id: partyId },
      include: { party: { include: { persona: true } } },
    });
    if (!cuenta) {
      throw new HttpException(
        { codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'La cuenta ya no existe' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const fotoId = cuenta.party.persona?.foto_archivo_id;
    const foto = fotoId ? await this.prisma.archivo.findUnique({ where: { id: fotoId } }) : null;
    const roles = await rolesDeCuenta(this.prisma, cuenta.id, cuenta.rol);
    return {
      partyId: cuenta.party_id.toString(),
      nombres: cuenta.party.persona?.nombres || '',
      fotoUrl: foto ? `/archivos/${foto.ruta}` : null,
      rol: cuenta.rol,
      roles,
      debeCambiar: cuenta.debe_cambiar,
      permisos: await permisosDeCuenta(this.prisma, cuenta.id, roles),
      // Solo "hoy es tu cumpleaños": la fecha nunca sale del servidor
      cumpleHoy: esCumpleanosHoy(cuenta.party.persona?.cumple_dia, cuenta.party.persona?.cumple_mes, diaCalendarioLima()),
    };
  }

  async ingresar(
    dto: IngresarDto,
    ip?: string,
    dispositivo?: string,
  ): Promise<ResultadoIngreso> {
    const redis = this.redisService.obtenerCliente();
    const claveIntentos = `auth:intentos:${dto.dni}`;

    // 1. Verificar bloqueo por intentos fallidos en Redis (5 fallos en 15 min)
    const intentosActuales = await redis.get(claveIntentos);
    if (intentosActuales && parseInt(intentosActuales, 10) >= 5) {
      throw new HttpException(
        {
          codigo: 'CUENTA_BLOQUEADA',
          mensaje: 'Cuenta bloqueada temporalmente tras 5 intentos fallidos. Intente en 15 minutos.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Buscar usuario por su documento (DNI, CE, cédula o pasaporte) sin revelar existencia.
    // El número es único entre tipos de documento del personal (lo cuida el alta de usuarios).
    const identificador = await this.prisma.partyIdentifier.findFirst({
      where: {
        numero: dto.dni,
        tipo: { in: [...TIPOS_DOCUMENTO] },
      },
      include: {
        party: {
          include: {
            usuario: true,
            persona: true,
          },
        },
      },
    });

    if (!identificador || !identificador.party.usuario) {
      const fallos = await redis.incr(claveIntentos);
      if (fallos === 1) {
        await redis.expire(claveIntentos, 15 * 60);
      }

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'acceso',
        accion: 'INGRESO_FALLIDO',
        resultado: 'RECHAZADO',
        motivo: 'CREDENCIALES_INVALIDAS',
        antes: { dni: enmascararDni(dto.dni) },
        ip,
        dispositivo,
      });

      throw new HttpException(
        { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales inválidas' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const usuario = identificador.party.usuario;

    // 3. Verificar contraseña con argon2
    let passwordValida = false;
    try {
      passwordValida = await argon2.verify(usuario.hash, dto.contrasena);
    } catch {
      passwordValida = false;
    }

    if (!passwordValida) {
      const fallos = await redis.incr(claveIntentos);
      if (fallos === 1) {
        await redis.expire(claveIntentos, 15 * 60);
      }

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'acceso',
        accion: 'INGRESO_FALLIDO',
        resultado: 'RECHAZADO',
        motivo: 'CREDENCIALES_INVALIDAS',
        antes: { dni: enmascararDni(dto.dni) },
        partyId: usuario.party_id,
        ip,
        dispositivo,
      });

      throw new HttpException(
        { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales inválidas' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 4. Verificar si usuario está activo
    if (!usuario.activo) {
      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'acceso',
        accion: 'INGRESO_FALLIDO',
        resultado: 'RECHAZADO',
        motivo: 'USUARIO_DESACTIVADO',
        antes: { dni: enmascararDni(dto.dni) },
        partyId: usuario.party_id,
        ip,
        dispositivo,
      });

      throw new HttpException(
        { codigo: 'USUARIO_DESACTIVADO', mensaje: 'El usuario se encuentra desactivado' },
        HttpStatus.FORBIDDEN,
      );
    }

    // 5. Credenciales correctas: limpiar intentos en Redis
    await redis.del(claveIntentos);

    // 6. Generar JWT y Refresh Token
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'secreto-dev-cambiar');
    const jwtExpiraMin = Number(this.configService.get<string | number>('JWT_EXPIRA_MIN', 15));
    const refreshDias = Number(this.configService.get<string | number>('REFRESH_DIAS', 7));

    const roles = await rolesDeCuenta(this.prisma, usuario.id, usuario.rol);
    const payload = {
      sub: usuario.party_id.toString(),
      partyId: usuario.party_id.toString(),
      rol: usuario.rol,
      roles,
      debeCambiar: usuario.debe_cambiar,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: `${jwtExpiraMin}m`,
      audience: 'admin',
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshHash = hashSha256(rawRefreshToken);
    const expiraEn = new Date(Date.now() + refreshDias * 24 * 60 * 60 * 1000);

    await this.prisma.sesion.create({
      data: {
        audiencia: 'ADMIN',
        party_id: usuario.party_id,
        refresh_hash: refreshHash,
        dispositivo,
        expira_en: expiraEn,
      },
    });

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'acceso',
      accion: 'INGRESO',
      resultado: 'OK',
      partyId: usuario.party_id,
      ip,
      dispositivo,
    });

    return {
      respuesta: {
        accessToken,
        debeCambiar: usuario.debe_cambiar,
        usuario: {
          partyId: usuario.party_id.toString(),
          nombres: identificador.party.persona?.nombres || '',
          rol: usuario.rol,
          roles,
        },
      },
      rawRefreshToken,
      maxAgeMs: refreshDias * 24 * 60 * 60 * 1000,
    };
  }

  async renovar(
    rawRefreshToken: string | undefined,
    ip?: string,
    dispositivo?: string,
  ): Promise<ResultadoIngreso> {
    if (!rawRefreshToken) {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Token de renovación no proporcionado' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const refreshHash = hashSha256(rawRefreshToken);
    const sesion = await this.prisma.sesion.findUnique({
      where: { refresh_hash: refreshHash },
      include: {
        party: {
          include: {
            usuario: true,
            persona: true,
          },
        },
      },
    });

    if (!sesion || sesion.audiencia !== 'ADMIN') {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Token de renovación inválido' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (sesion.revocada_en !== null || sesion.expira_en < new Date()) {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Token de renovación revocado o vencido' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const usuario = sesion.party.usuario;
    if (!usuario || !usuario.activo) {
      throw new HttpException(
        { codigo: 'USUARIO_DESACTIVADO', mensaje: 'El usuario se encuentra desactivado' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Rotar: revocar la sesión anterior
    await this.prisma.sesion.update({
      where: { id: sesion.id },
      data: { revocada_en: new Date() },
    });

    // Emitir nueva sesión y nuevo token de acceso
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'secreto-dev-cambiar');
    const jwtExpiraMin = Number(this.configService.get<string | number>('JWT_EXPIRA_MIN', 15));
    const refreshDias = Number(this.configService.get<string | number>('REFRESH_DIAS', 7));

    const roles = await rolesDeCuenta(this.prisma, usuario.id, usuario.rol);
    const payload = {
      sub: sesion.party_id.toString(),
      partyId: sesion.party_id.toString(),
      rol: usuario.rol,
      roles,
      debeCambiar: usuario.debe_cambiar,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: `${jwtExpiraMin}m`,
      audience: 'admin',
    });

    const nuevoRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const nuevoRefreshHash = hashSha256(nuevoRawRefreshToken);
    const nuevaExpiraEn = new Date(Date.now() + refreshDias * 24 * 60 * 60 * 1000);

    await this.prisma.sesion.create({
      data: {
        audiencia: 'ADMIN',
        party_id: sesion.party_id,
        refresh_hash: nuevoRefreshHash,
        dispositivo,
        expira_en: nuevaExpiraEn,
      },
    });

    return {
      respuesta: {
        accessToken,
        debeCambiar: usuario.debe_cambiar,
        usuario: {
          partyId: sesion.party_id.toString(),
          nombres: sesion.party.persona?.nombres || '',
          rol: usuario.rol,
          roles,
        },
      },
      rawRefreshToken: nuevoRawRefreshToken,
      maxAgeMs: refreshDias * 24 * 60 * 60 * 1000,
    };
  }

  async salir(
    rawRefreshToken: string | undefined,
    partyId?: bigint,
    ip?: string,
    dispositivo?: string,
  ): Promise<{ ok: boolean }> {
    let resolvedPartyId = partyId;

    if (rawRefreshToken) {
      const refreshHash = hashSha256(rawRefreshToken);
      const sesion = await this.prisma.sesion.findUnique({
        where: { refresh_hash: refreshHash },
      });

      if (sesion && !sesion.revocada_en) {
        await this.prisma.sesion.update({
          where: { id: sesion.id },
          data: { revocada_en: new Date() },
        });
        if (!resolvedPartyId) {
          resolvedPartyId = sesion.party_id;
        }
      }
    }

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'acceso',
      accion: 'SALIDA',
      resultado: 'OK',
      partyId: resolvedPartyId,
      ip,
      dispositivo,
    });

    return { ok: true };
  }

  /** Cierra TODAS las sesiones de la cuenta (todos los equipos): revoca los refresh y invalida los tokens ya emitidos. */
  async salirTodas(partyId: bigint, ip?: string, dispositivo?: string): Promise<{ ok: boolean; cerradas: number }> {
    const ahora = new Date();
    const [, revocadas] = await this.prisma.$transaction([
      this.prisma.userAccount.update({ where: { party_id: partyId }, data: { sesiones_cerradas_en: ahora } }),
      this.prisma.sesion.updateMany({ where: { party_id: partyId, revocada_en: null }, data: { revocada_en: ahora } }),
    ]);
    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'acceso',
      accion: 'SALIDA_TODAS',
      resultado: 'OK',
      partyId,
      despues: { sesionesCerradas: revocadas.count },
      ip,
      dispositivo,
    });
    return { ok: true, cerradas: revocadas.count };
  }

  async cambiarContrasena(
    partyId: bigint,
    dto: CambiarContrasenaDto,
    rawRefreshToken?: string,
    ip?: string,
    dispositivo?: string,
  ): Promise<{ ok: boolean; mensaje: string }> {
    // Validar contraseña nueva: mínimo 8 con letra y número y distinta de la actual
    const esValida =
      dto.contrasenaNueva.length >= 8 &&
      /[a-zA-Z]/.test(dto.contrasenaNueva) &&
      /[0-9]/.test(dto.contrasenaNueva) &&
      dto.contrasenaNueva !== dto.contrasenaActual;

    if (!esValida) {
      throw new HttpException(
        {
          codigo: 'CONTRASENA_INVALIDA',
          mensaje:
            'La nueva contraseña debe tener mínimo 8 caracteres, al menos una letra y un número, y ser distinta de la actual',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // La clave inicial es el número de documento: la clave nueva no puede serlo
    const documentos = await this.prisma.partyIdentifier.findMany({
      where: { party_id: partyId, tipo: { in: [...TIPOS_DOCUMENTO] } },
      select: { numero: true },
    });
    if (documentos.some((d) => d.numero.toUpperCase() === dto.contrasenaNueva.toUpperCase())) {
      throw new HttpException(
        {
          codigo: 'CONTRASENA_ES_DOCUMENTO',
          mensaje: 'La nueva contraseña no puede ser tu número de documento. Elige otra.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const userAccount = await this.prisma.userAccount.findUnique({
      where: { party_id: partyId },
    });

    if (!userAccount) {
      throw new HttpException(
        { codigo: 'TOKEN_INVALIDO', mensaje: 'Usuario no encontrado' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    let actualCoincide = false;
    try {
      actualCoincide = await argon2.verify(userAccount.hash, dto.contrasenaActual);
    } catch {
      actualCoincide = false;
    }

    if (!actualCoincide) {
      throw new HttpException(
        {
          codigo: 'CONTRASENA_ACTUAL_INCORRECTA',
          mensaje: 'La contraseña actual no es correcta',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const nuevoHash = await argon2.hash(dto.contrasenaNueva);

    // Actualizar usuario: debe_cambiar = false y nuevo hash
    await this.prisma.userAccount.update({
      where: { party_id: partyId },
      data: {
        hash: nuevoHash,
        debe_cambiar: false,
      },
    });

    // Revocar las otras sesiones
    const currentHash = rawRefreshToken ? hashSha256(rawRefreshToken) : null;
    await this.prisma.sesion.updateMany({
      where: {
        party_id: partyId,
        revocada_en: null,
        ...(currentHash ? { NOT: { refresh_hash: currentHash } } : {}),
      },
      data: {
        revocada_en: new Date(),
      },
    });

    await this.auditoria.registrar({
      categoria: 'ACCESO',
      modulo: 'acceso',
      accion: 'CAMBIO_CLAVE',
      resultado: 'OK',
      partyId,
      ip,
      dispositivo,
    });

    return { ok: true, mensaje: 'Contraseña actualizada exitosamente' };
  }
}
