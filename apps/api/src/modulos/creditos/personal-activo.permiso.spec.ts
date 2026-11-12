jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { Reflector } from '@nestjs/core';
import { CreditosController } from './creditos.controller';
import { CreditosService } from './creditos.service';
import { CLAVE_PERMISO, PermisoRequerido } from '../acceso/permiso.decorator';
import { MATRIZ, ROLES } from '../acceso/permisos';

describe('GET /admin/creditos/personal-activo: quién puede listar candidatos', () => {
  const req = new Reflector().get<PermisoRequerido[]>(
    CLAVE_PERMISO,
    CreditosController.prototype.listarPersonalActivo,
  );
  const alcanza = (rol: string) => req.some((p) => MATRIZ[rol]?.includes(`${p.modulo}/${p.accion}`));

  it.each(['ADMIN', 'CAJERO', 'MOZO', 'SUPERVISOR'])('%s puede listar', (rol) => {
    expect(alcanza(rol)).toBe(true);
  });

  it('todo rol con pedidos/crear puede listar', () => {
    for (const r of ROLES) {
      if (MATRIZ[r.codigo]?.includes('pedidos/crear')) expect(alcanza(r.codigo)).toBe(true);
    }
  });

  it('un rol sin pedidos/crear ni creditos/ver no puede', () => {
    expect(alcanza('COCINA')).toBe(false);
    expect(alcanza('REPARTIDOR')).toBe(false);
  });

  it('el servicio solo devuelve partyId, nombre, rol y descuentoPct', async () => {
    const prisma: any = {
      userAccount: {
        findMany: jest.fn().mockResolvedValue([
          { party_id: BigInt(1), rol: 'MOZO', party: { persona: { nombres: 'A', apellidos: 'B', numero_documento: '000', sueldo: 1 } } },
        ]),
      },
      partyRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const lista = await new (CreditosService as any)(prisma).listarPersonalActivo();
    expect(lista.length).toBe(1);
    for (const it of lista) expect(Object.keys(it).sort()).toEqual(['descuentoPct', 'nombre', 'partyId', 'rol']);
  });
});
