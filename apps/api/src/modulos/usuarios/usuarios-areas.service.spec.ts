import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuariosAreasService } from './usuarios-areas.service';

describe('UsuariosAreasService', () => {
  let prisma: any;
  let auditoria: any;
  let service: UsuariosAreasService;

  beforeEach(() => {
    prisma = {
      userAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 7n, rol: 'COCINA', rolesExtra: [], areasCocina: [{ area_id: 1n }] }),
      },
      areaCocina: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          const todas = [{ id: 1n, nombre: 'Bebidas' }, { id: 2n, nombre: 'Salados' }, { id: 3n, nombre: 'Postres' }];
          if (where?.id?.in) return todas.filter((a) => where.id.in.includes(a.id));
          return todas;
        }),
      },
      userAccountArea: {
        deleteMany: jest.fn().mockReturnValue('del'),
        createMany: jest.fn().mockReturnValue('cre'),
      },
      $transaction: jest.fn(async (ops: any[]) => ops),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new UsuariosAreasService(prisma, auditoria);
  });

  it('leer devuelve las áreas marcadas, las disponibles y la regla de «sin marcar»', async () => {
    const r = await service.leer('7');
    expect(r.areaIds).toEqual(['1']);
    expect(r.esCocina).toBe(true);
    expect(r.disponibles).toEqual([{ id: '1', nombre: 'Bebidas' }, { id: '2', nombre: 'Salados' }, { id: '3', nombre: 'Postres' }]);
    expect(r.nota).toMatch(/ve todas las áreas/);
  });

  it('leer de un usuario inexistente da 404', async () => {
    prisma.userAccount.findUnique.mockResolvedValue(null);
    await expect(service.leer('99')).rejects.toThrow(NotFoundException);
  });

  it('guardar reemplaza la lista completa, valida y audita', async () => {
    await service.guardar('7', ['2', '3', '2'], { partyId: 1n, rol: 'ADMIN' } as any, '10.0.0.1');
    expect(prisma.userAccountArea.deleteMany).toHaveBeenCalledWith({ where: { user_account_id: 7n } });
    expect(prisma.userAccountArea.createMany).toHaveBeenCalledWith({
      data: [{ user_account_id: 7n, area_id: 2n }, { user_account_id: 7n, area_id: 3n }],
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'CAMBIAR_AREAS_COCINA',
      modulo: 'usuarios',
      antes: { areaIds: ['1'] },
      despues: { areaIds: ['2', '3'] },
    }));
  });

  it('una lista vacía deja al usuario viendo todas las áreas', async () => {
    const r = await service.guardar('7', [], undefined);
    expect(r.mensaje).toMatch(/ve todas/);
    expect(prisma.userAccountArea.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it('rechaza áreas inexistentes o inactivas, y ids no numéricos', async () => {
    await expect(service.guardar('7', ['2', '99'], undefined)).rejects.toThrow(BadRequestException);
    await expect(service.guardar('7', ['abc'], undefined)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('solo se asignan áreas a usuarios con rol COCINA (principal o extra)', async () => {
    prisma.userAccount.findUnique.mockResolvedValue({ id: 8n, rol: 'MOZO', rolesExtra: [{ rol: 'CAJERO' }], areasCocina: [] });
    await expect(service.guardar('8', ['1'], undefined)).rejects.toThrow(BadRequestException);
    prisma.userAccount.findUnique.mockResolvedValue({ id: 8n, rol: 'MOZO', rolesExtra: [{ rol: 'COCINA' }], areasCocina: [] });
    await expect(service.guardar('8', ['1'], undefined)).resolves.toMatchObject({ ok: true });
  });
});
