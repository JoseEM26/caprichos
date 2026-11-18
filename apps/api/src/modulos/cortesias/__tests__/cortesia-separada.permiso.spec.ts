jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import { readFileSync } from 'fs';
import { join } from 'path';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { MATRIZ, ROLES } from '../../acceso/permisos';
import { CortesiasController, CortesiaLineaController } from '../cortesias.controller';

const ROLES_CON_SEPARADA = ['ADMIN', 'CAJERO', 'MOZO'];

describe('cortesía por separado (cortesias/dar_separada): solo Caja, Mozo y ADMIN', () => {
  it('la matriz da el permiso a CAJERO, MOZO y ADMIN, y a nadie más', () => {
    for (const rol of ROLES.map((r) => r.codigo)) {
      expect(MATRIZ[rol].includes('cortesias/dar_separada')).toBe(ROLES_CON_SEPARADA.includes(rol));
    }
  });

  it('SUPERVISOR conserva cortesias/dar (cortesía dentro del pedido) pero no la separada', () => {
    expect(MATRIZ.SUPERVISOR).toContain('cortesias/dar');
    expect(MATRIZ.SUPERVISOR).not.toContain('cortesias/dar_separada');
  });

  it('la migración asigna el permiso a exactamente los mismos roles que la matriz', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../prisma/migrations/20270330100000_cortesia_separada_permiso/migration.sql'),
      'utf8',
    );
    const roles = /"codigo" IN \(([^)]*)\)/.exec(sql)![1].split(',').map((r) => r.trim().replace(/'/g, '')).sort();
    expect(roles).toEqual([...ROLES_CON_SEPARADA].sort());
  });

  describe('guard por ruta real', () => {
    const jwt: any = { verifyAsync: jest.fn(async () => ({ partyId: '7' })) };
    const config: any = { get: jest.fn(() => 'secreto-de-prueba') };
    let rolActual = 'ADMIN';
    const prisma: any = {
      userAccount: {
        findUnique: jest.fn(async () => ({ party_id: 7n, rol: rolActual, activo: true, debe_cambiar: false })),
      },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
      userAccountPermiso: { findMany: jest.fn().mockResolvedValue([]) },
      rolPermiso: {
        findFirst: jest.fn(async ({ where }: any) => {
          const claves = where.OR.map((c: any) => `${c.permiso.modulo}/${c.permiso.accion}`);
          const roles: string[] = where.rol.in;
          return claves.some((c: string) => roles.some((r) => MATRIZ[r]?.includes(c))) ? { rol: roles[0] } : null;
        }),
      },
    };
    const auditoria: any = { registrar: jest.fn(async () => ({})) };

    async function entra(rol: string, ctrl: any, metodo: string): Promise<boolean> {
      rolActual = rol;
      const guard = new AccesoGuard(new Reflector(), jwt, config, prisma, auditoria);
      const req: any = { headers: { authorization: 'Bearer t' }, ip: '10.0.0.1', body: {} };
      const ctx: any = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => ctrl.prototype[metodo],
        getClass: () => ctrl,
      };
      try {
        return await guard.canActivate(ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(403);
        return false;
      }
    }

    it.each(['SUPERVISOR', 'COCINA', 'ALMACEN', 'REPARTIDOR'])('POST /admin/cortesias responde 403 a %s', async (rol) => {
      expect(await entra(rol, CortesiasController, 'registrar')).toBe(false);
    });

    it.each(['CAJERO', 'MOZO', 'ADMIN'])('POST /admin/cortesias deja pasar a %s', async (rol) => {
      expect(await entra(rol, CortesiasController, 'registrar')).toBe(true);
    });

    it('la cortesía dentro de un pedido (línea) sigue igual: SUPERVISOR y MOZO entran', async () => {
      expect(await entra('SUPERVISOR', CortesiaLineaController, 'darEnLinea')).toBe(true);
      expect(await entra('MOZO', CortesiaLineaController, 'darEnLinea')).toBe(true);
    });
  });
});
