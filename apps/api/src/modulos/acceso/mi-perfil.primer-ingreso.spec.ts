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

import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccesoGuard } from './acceso.guard';
import { MiPerfilController } from './mi-perfil.controller';

// Primer ingreso: debe_cambiar=true. Usa el Reflector real y los decoradores reales del controlador.
describe('Mi perfil con debe_cambiar=true (primer ingreso)', () => {
  let guard: AccesoGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let prisma: any;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue({ partyId: '1' }) };
    prisma = {
      userAccount: {
        findUnique: jest.fn().mockResolvedValue({
          party_id: 1n,
          rol: 'MOZO',
          activo: true,
          debe_cambiar: true,
        }),
      },
      rolPermiso: { findFirst: jest.fn() },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
    };
    guard = new AccesoGuard(
      new Reflector(),
      jwtService as any,
      { get: jest.fn().mockReturnValue('test-secret') } as any,
      prisma,
      { registrar: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  const activar = (metodo: (...args: any[]) => any) => {
    const req: any = { headers: { authorization: 'Bearer t' }, ip: '127.0.0.1' };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => metodo,
      getClass: () => MiPerfilController,
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  it.each([
    ['ver su perfil', MiPerfilController.prototype.obtener],
    ['subir su foto', MiPerfilController.prototype.cambiarFoto],
    ['quitar su foto', MiPerfilController.prototype.quitarFoto],
  ])('permite %s', async (_nombre, metodo) => {
    await expect(activar(metodo)).resolves.toBe(true);
  });

  it('sigue bloqueando la edición de datos hasta cambiar la clave', async () => {
    const error = await activar(MiPerfilController.prototype.actualizar).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getResponse()).toMatchObject({ codigo: 'DEBE_CAMBIAR_CLAVE' });
    expect(error.getStatus()).toBe(403);
  });

  it('sigue bloqueando cualquier ruta sin SoloCambioClave', async () => {
    const otraRuta = function otraRuta() {};
    await expect(activar(otraRuta)).rejects.toMatchObject({ status: 403 });
  });
});
