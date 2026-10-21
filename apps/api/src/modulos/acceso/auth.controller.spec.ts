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

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccesoGuard } from './acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let configService: any;

  beforeEach(async () => {
    authService = {
      ingresar: jest.fn(),
      renovar: jest.fn(),
      salir: jest.fn(),
      cambiarContrasena: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, def: any) => {
        if (key === 'NODE_ENV') return 'production';
        return def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('ingresar debe setear la cookie HttpOnly y retornar la respuesta', async () => {
    authService.ingresar.mockResolvedValue({
      respuesta: {
        accessToken: 'jwt-token-123',
        debeCambiar: false,
        usuario: { partyId: '10', nombres: 'Admin', rol: 'ADMIN' },
      },
      rawRefreshToken: 'raw-refresh-123',
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    });

    const mockReq: any = {
      headers: { 'user-agent': 'JestTest' },
      ip: '127.0.0.1',
    };
    const mockRes: any = {
      cookie: jest.fn(),
    };

    const res = await controller.ingresar(
      { dni: '12345678', contrasena: 'Clave123' },
      mockReq,
      mockRes,
    );

    expect(res).toEqual({
      accessToken: 'jwt-token-123',
      debeCambiar: false,
      usuario: { partyId: '10', nombres: 'Admin', rol: 'ADMIN' },
    });

    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'raw-refresh-123',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('renovar debe rotar la cookie y retornar nuevo token de acceso', async () => {
    authService.renovar.mockResolvedValue({
      respuesta: {
        accessToken: 'jwt-nuevo-456',
        debeCambiar: false,
        usuario: { partyId: '10', nombres: 'Admin', rol: 'ADMIN' },
      },
      rawRefreshToken: 'nuevo-refresh-456',
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    });

    const mockReq: any = {
      cookies: { refreshToken: 'old-refresh' },
      headers: {},
    };
    const mockRes: any = {
      cookie: jest.fn(),
    };

    const res = await controller.renovar(mockReq, mockRes);

    expect(res.accessToken).toBe('jwt-nuevo-456');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'nuevo-refresh-456',
      expect.any(Object),
    );
  });

  it('salir debe limpiar la cookie refreshToken y llamar a salir', async () => {
    authService.salir.mockResolvedValue({ ok: true });

    const mockReq: any = {
      cookies: { refreshToken: 'token-to-clear' },
      headers: {},
      usuario: { partyId: BigInt(10) },
    };
    const mockRes: any = {
      clearCookie: jest.fn(),
    };

    const res = await controller.salir(mockReq, mockRes);

    expect(res).toEqual({ ok: true });
    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      }),
    );
  });

  it('cambiarContrasena debe invocar a authService.cambiarContrasena con partyId autenticado', async () => {
    authService.cambiarContrasena.mockResolvedValue({
      ok: true,
      mensaje: 'Contraseña actualizada exitosamente',
    });

    const mockReq: any = {
      cookies: { refreshToken: 'token-sesion' },
      headers: {},
      usuario: { partyId: BigInt(10), rol: 'ADMIN', debeCambiar: true },
    };

    const res = await controller.cambiarContrasena(
      { contrasenaActual: 'Vieja123', contrasenaNueva: 'NuevaValida99' },
      mockReq,
    );

    expect(res.ok).toBe(true);
    expect(authService.cambiarContrasena).toHaveBeenCalledWith(
      BigInt(10),
      { contrasenaActual: 'Vieja123', contrasenaNueva: 'NuevaValida99' },
      'token-sesion',
      undefined,
      undefined,
    );
  });
});
