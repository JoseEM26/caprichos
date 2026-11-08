jest.mock('@nestjs/jwt', () => {
  return {
    JwtService: jest.fn().mockImplementation(() => ({
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    })),
    JwtModule: {
      registerAsync: jest.fn().mockReturnValue({
        module: class MockJwtModule {},
      }),
    },
  };
});

import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccesoGuard } from './acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CLAVE_PERMISO, CLAVE_SOLO_CAMBIO_CLAVE } from './permiso.decorator';

describe('AccesoGuard', () => {
  let guard: AccesoGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: any;
  let configService: any;
  let prisma: any;
  let auditoriaService: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    jwtService = {
      verifyAsync: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    prisma = {
      userAccount: {
        findUnique: jest.fn(),
      },
      rolPermiso: {
        findFirst: jest.fn(),
      },
      userAccountRol: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAccountPermiso: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditoriaService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    guard = new AccesoGuard(
      reflector,
      jwtService,
      configService,
      prisma,
      auditoriaService,
    );
  });

  const crearContexto = (
    headers: Record<string, string> = {},
    query: Record<string, any> = {},
  ) => {
    const req: any = {
      headers,
      query,
      ip: '127.0.0.1',
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  it('debe lanzar 401 NO_AUTENTICADO si falta la cabecera Authorization o no es Bearer', async () => {
    const { context } = crearContexto({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatus.UNAUTHORIZED,
        response: {
          codigo: 'NO_AUTENTICADO',
          mensaje: 'Token de autorización no proporcionado',
        },
      }),
    );
  });

  it('debe lanzar 401 TOKEN_INVALIDO si JwtService.verifyAsync falla', async () => {
    const { context } = crearContexto({
      authorization: 'Bearer token-invalido',
    });

    jwtService.verifyAsync.mockRejectedValue(new Error('Token expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatus.UNAUTHORIZED,
        response: {
          codigo: 'TOKEN_INVALIDO',
          mensaje: 'Token inválido o expirado',
        },
      }),
    );
  });

  it('debe lanzar 403 USUARIO_DESACTIVADO si user_account.activo es false', async () => {
    const { context } = crearContexto({
      authorization: 'Bearer token-valido',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '10',
      partyId: '10',
      rol: 'CAJERO',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(10),
      rol: 'CAJERO',
      activo: false, // Inactivo
      debe_cambiar: false,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatus.FORBIDDEN,
        response: {
          codigo: 'USUARIO_DESACTIVADO',
          mensaje: 'El usuario se encuentra desactivado',
        },
      }),
    );
  });

  it('debe lanzar 403 DEBE_CAMBIAR_CLAVE si debe_cambiar=true y ruta NO tiene @SoloCambioClave', async () => {
    const { context } = crearContexto({
      authorization: 'Bearer token-valido',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '10',
      partyId: '10',
      rol: 'ADMIN',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(10),
      rol: 'ADMIN',
      activo: true,
      debe_cambiar: true, // Debe cambiar
    });

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === CLAVE_SOLO_CAMBIO_CLAVE) return false;
      return null;
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatus.FORBIDDEN,
        response: {
          codigo: 'DEBE_CAMBIAR_CLAVE',
          mensaje: 'Debe cambiar su contraseña antes de continuar',
        },
      }),
    );
  });

  it('debe permitir acceso si debe_cambiar=true y ruta TIENE @SoloCambioClave', async () => {
    const { context, req } = crearContexto({
      authorization: 'Bearer token-valido',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '10',
      partyId: '10',
      rol: 'ADMIN',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(10),
      rol: 'ADMIN',
      activo: true,
      debe_cambiar: true,
    });

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === CLAVE_SOLO_CAMBIO_CLAVE) return true;
      if (key === CLAVE_PERMISO) return null;
      return null;
    });

    const resultado = await guard.canActivate(context);

    expect(resultado).toBe(true);
    expect(req.usuario).toEqual({
      partyId: BigInt(10),
      rol: 'ADMIN',
      debeCambiar: true,
      roles: ['ADMIN'],
    });
  });

  it('debe lanzar 403 SIN_PERMISO y registrar auditoría si rol NO tiene el permiso requerido', async () => {
    const { context, req } = crearContexto({
      authorization: 'Bearer token-valido',
      'user-agent': 'Chrome/120',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '20',
      partyId: '20',
      rol: 'MOZO',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(20),
      rol: 'MOZO',
      activo: true,
      debe_cambiar: false,
    });

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === CLAVE_SOLO_CAMBIO_CLAVE) return false;
      if (key === CLAVE_PERMISO) return { modulo: 'usuarios', accion: 'crear' };
      return null;
    });

    prisma.rolPermiso.findFirst.mockResolvedValue(null); // No tiene el permiso

    await expect(guard.canActivate(context)).rejects.toThrow(
      expect.objectContaining({
        status: HttpStatus.FORBIDDEN,
        response: {
          codigo: 'SIN_PERMISO',
          mensaje: 'No tiene permiso para realizar esta acción',
        },
      }),
    );

    expect(auditoriaService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: 'ACCESO',
        modulo: 'usuarios',
        accion: 'crear',
        resultado: 'RECHAZADO',
        motivo: 'SIN_PERMISO',
        partyId: BigInt(20),
        dispositivo: 'Chrome/120',
      }),
    );
  });

  it('debe permitir acceso cuando el rol SÍ tiene el permiso requerido', async () => {
    const { context, req } = crearContexto({
      authorization: 'Bearer token-valido',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '30',
      partyId: '30',
      rol: 'ADMIN',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(30),
      rol: 'ADMIN',
      activo: true,
      debe_cambiar: false,
    });

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === CLAVE_SOLO_CAMBIO_CLAVE) return false;
      if (key === CLAVE_PERMISO) return { modulo: 'usuarios', accion: 'crear' };
      return null;
    });

    prisma.rolPermiso.findFirst.mockResolvedValue({
      rol: 'ADMIN',
      permiso_id: BigInt(1),
    });

    const resultado = await guard.canActivate(context);

    expect(resultado).toBe(true);
    expect(req.usuario).toEqual({
      partyId: BigInt(30),
      rol: 'ADMIN',
      debeCambiar: false,
      roles: ['ADMIN'],
    });
  });

  it('debe permitir acceso cuando se pasa una lista de permisos alternativos y el usuario tiene uno de ellos', async () => {
    const { context } = crearContexto({
      authorization: 'Bearer token-valido',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: '50',
      partyId: '50',
      rol: 'MOZO',
    });

    prisma.userAccount.findUnique.mockResolvedValue({
      party_id: BigInt(50),
      rol: 'MOZO',
      activo: true,
      debe_cambiar: false,
    });

    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === CLAVE_SOLO_CAMBIO_CLAVE) return false;
      if (key === CLAVE_PERMISO)
        return [
          { modulo: 'archivos', accion: 'ver' },
          { modulo: 'iniciativas', accion: 'ver' },
        ];
      return null;
    });

    prisma.rolPermiso.findFirst.mockResolvedValue({
      rol: 'MOZO',
      permiso_id: BigInt(99),
    });

    const resultado = await guard.canActivate(context);

    expect(resultado).toBe(true);
    expect(prisma.rolPermiso.findFirst).toHaveBeenCalledWith({
      where: {
        rol: { in: ['MOZO'] },
        OR: [
          { permiso: { modulo: 'archivos', accion: 'ver' } },
          { permiso: { modulo: 'iniciativas', accion: 'ver' } },
        ],
      },
    });
  });
});
