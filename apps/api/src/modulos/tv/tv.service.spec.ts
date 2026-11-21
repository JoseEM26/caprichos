import { UnauthorizedException } from '@nestjs/common';
import { TvGuard } from './tv.guard';
import { hashLlave, TvService } from './tv.service';

describe('TvService / TvGuard', () => {
  let prisma: any;
  let service: TvService;

  beforeEach(() => {
    prisma = {
      deviceKey: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new TvService(prisma);
  });

  it('crea un código de 6 caracteres sin O/0/I/1, vence en 10 min, guarda solo el hash de la llave y limpia vencidos', async () => {
    const r = await service.crearCodigo('SALON_VIVO');
    expect(r.codigo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const vence = new Date(r.expiraEn).getTime() - Date.now();
    expect(vence).toBeGreaterThan(9 * 60_000);
    expect(vence).toBeLessThanOrEqual(10 * 60_000);
    const data = prisma.deviceKey.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tipo: 'TV', activo: false, vista: 'SALON_VIVO', nombre: 'TV Salón en vivo', codigo_vinculo: r.codigo });
    expect(data.llave_hash).toBe(hashLlave(r.llave));
    expect(data.llave_hash).not.toBe(r.llave);
    expect(prisma.deviceKey.deleteMany).toHaveBeenCalled();
  });

  it('rota: cada pedido da código y llave distintos; reintenta si el código choca', async () => {
    prisma.deviceKey.create.mockRejectedValueOnce({ code: 'P2002' });
    const a = await service.crearCodigo('COCINA');
    const b = await service.crearCodigo('COCINA');
    expect(prisma.deviceKey.create).toHaveBeenCalledTimes(3);
    expect(a.llave).not.toBe(b.llave);
    expect(prisma.deviceKey.create.mock.calls[2][0].data.nombre).toBe('TV Cocina');
  });

  it('rechaza una vista desconocida', async () => {
    await expect(service.crearCodigo('OTRA')).rejects.toMatchObject({ response: { codigo: 'VISTA_INVALIDA' } });
  });

  it('estado: pendiente no vinculada; vinculada activa; desactivada vinculada pero no activa; llave desconocida 401', async () => {
    prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, codigo_vinculo: 'ABC234', activo: false, vista: 'COCINA', area_id: null, nombre: 'TV Cocina' });
    expect(await service.estado('llave')).toMatchObject({ vinculada: false, activa: false });
    prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, codigo_vinculo: null, activo: true, vista: 'COCINA', area_id: 2n, nombre: 'TV' });
    expect(await service.estado('llave')).toMatchObject({ vinculada: true, activa: true, areaId: '2' });
    prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, codigo_vinculo: null, activo: false, vista: 'COCINA', area_id: null, nombre: 'TV' });
    expect(await service.estado('llave')).toMatchObject({ vinculada: true, activa: false });
    prisma.deviceKey.findFirst.mockResolvedValueOnce(null);
    await expect(service.estado('mala')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.estado(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('TvGuard', () => {
    const ctx = (authorization?: string) => {
      const req: any = { headers: authorization ? { authorization } : {} };
      return { req, c: { switchToHttp: () => ({ getRequest: () => req }) } as any };
    };
    const guard = () => new TvGuard(prisma);

    it('sin llave 401; llave inválida 401; desactivada 401 PANTALLA_DESACTIVADA; activa pasa', async () => {
      await expect(guard().canActivate(ctx().c)).rejects.toMatchObject({ response: { codigo: 'NO_AUTENTICADO' } });
      prisma.deviceKey.findFirst.mockResolvedValueOnce(null);
      await expect(guard().canActivate(ctx('Bearer x').c)).rejects.toMatchObject({ response: { codigo: 'LLAVE_INVALIDA' } });
      prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, activo: false, codigo_vinculo: null });
      await expect(guard().canActivate(ctx('Bearer x').c)).rejects.toMatchObject({ response: { codigo: 'PANTALLA_DESACTIVADA' } });
      prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, activo: false, codigo_vinculo: 'ABC234' });
      await expect(guard().canActivate(ctx('Bearer x').c)).rejects.toMatchObject({ response: { codigo: 'PANTALLA_DESACTIVADA' } });
      prisma.deviceKey.findFirst.mockResolvedValueOnce({ id: 1n, activo: true, codigo_vinculo: null, ultima_conexion: new Date() });
      const { req, c } = ctx('Bearer x');
      expect(await guard().canActivate(c)).toBe(true);
      expect(req.tv.id).toBe(1n);
      expect(prisma.deviceKey.findFirst).toHaveBeenLastCalledWith({ where: { llave_hash: hashLlave('x'), tipo: 'TV' } });
    });
  });
});
