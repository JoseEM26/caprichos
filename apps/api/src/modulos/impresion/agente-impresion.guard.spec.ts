import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AgenteImpresionGuard } from './agente-impresion.guard';

describe('AgenteImpresionGuard', () => {
  let guard: AgenteImpresionGuard;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      deviceKey: {
        findFirst: jest.fn(),
      },
    };
    guard = new AgenteImpresionGuard(prismaMock);
  });

  const crearContexto = (headers: Record<string, string>): { ctx: ExecutionContext; req: any } => {
    const req: any = { headers };
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };
    return { ctx, req };
  };

  it('lanza UnauthorizedException si no hay cabecera Authorization', async () => {
    const { ctx } = crearContexto({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el formato no es Bearer', async () => {
    const { ctx } = crearContexto({ authorization: 'Basic 12345' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException con LLAVE_INVALIDA si el hash no coincide con ningún AGENTE activo', async () => {
    const { ctx } = crearContexto({ authorization: 'Bearer clave_invalida' });
    prismaMock.deviceKey.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    const hash = crypto.createHash('sha256').update('clave_invalida').digest('hex');
    expect(prismaMock.deviceKey.findFirst).toHaveBeenCalledWith({
      where: {
        llave_hash: hash,
        tipo: 'AGENTE',
        activo: true,
      },
    });
  });

  it('permite acceso y asigna req.deviceKey si la llave es válida y activa', async () => {
    const claveValida = 'agk_clave_secreta_123';
    const { ctx, req } = crearContexto({ authorization: `Bearer ${claveValida}` });
    const deviceMock = {
      id: 5n,
      nombre: 'Agente Caja 1',
      tipo: 'AGENTE',
      activo: true,
    };
    prismaMock.deviceKey.findFirst.mockResolvedValue(deviceMock);

    const resultado = await guard.canActivate(ctx);
    expect(resultado).toBe(true);
    expect(req.deviceKey).toBe(deviceMock);
  });
});
