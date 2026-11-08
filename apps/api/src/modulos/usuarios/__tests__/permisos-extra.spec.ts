jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));

import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { UsuariosPermisosService } from '../usuarios-permisos.service';
import { permisosDeCuenta, permisosExtraVigentes } from '../../acceso/roles-usuario';
import { esSensible, CATALOGO_PERMISOS } from '../../acceso/permisos-extra';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';

const ADMIN = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const EN_UN_MES = () => new Date(Date.now() + 30 * 86400000).toISOString();

function montar(cuenta: any = {}, roles: Array<{ rol: string }> = [], previos: any[] = []) {
  const tx: any = { userAccountPermiso: { deleteMany: jest.fn().mockResolvedValue({}), upsert: jest.fn().mockResolvedValue({}) } };
  const prisma: any = {
    userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 30n, rol: 'CAJERO', activo: true, ...cuenta }) },
    userAccountRol: { findMany: jest.fn().mockResolvedValue(roles) },
    userAccountPermiso: { findMany: jest.fn().mockResolvedValue(previos) },
    rolPermiso: { findMany: jest.fn().mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { prisma, tx, auditoria, svc: new UsuariosPermisosService(prisma, auditoria) };
}

describe('permisos efectivos = roles ∪ extras vigentes', () => {
  it('une los permisos del rol con los extras y filtra los vencidos en la consulta', async () => {
    const { prisma } = montar();
    prisma.userAccountPermiso.findMany.mockResolvedValue([{ modulo: 'creditos', accion: 'ver' }]);
    expect(await permisosDeCuenta(prisma, 10n, ['CAJERO'])).toEqual(['caja/ver', 'creditos/ver']);
    const where = prisma.userAccountPermiso.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ vence_en: null }, { vence_en: { gt: expect.any(Date) } }]);
  });

  it('sin extras, igual que antes', async () => {
    const { prisma } = montar();
    expect(await permisosExtraVigentes(prisma, 10n)).toEqual([]);
    expect(await permisosDeCuenta(prisma, 10n, ['CAJERO'])).toEqual(['caja/ver']);
  });
});

describe('UsuariosPermisosService.reemplazar', () => {
  const dto = (permisos: any[], confirmacionFuerte?: boolean) => ({ permisos, confirmacionFuerte });

  it('otorga, guarda y audita quién, a quién, qué, vencimiento y nota', async () => {
    const { svc, tx, auditoria } = montar();
    const venceEn = EN_UN_MES();
    const r = await svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver', venceEn, nota: ' apoyo ' }]), ADMIN as any, '1.1.1.1');
    expect(r.otorgados).toEqual(['creditos/ver']);
    expect(tx.userAccountPermiso.upsert).toHaveBeenCalledTimes(1);
    expect(tx.userAccountPermiso.upsert.mock.calls[0][0].create).toMatchObject({ modulo: 'creditos', accion: 'ver', otorgado_por: 1n, nota: 'apoyo' });
    const e = auditoria.registrar.mock.calls[0][0];
    expect(e).toMatchObject({ accion: 'PERMISO_EXTRA_OTORGADO', entidadId: 10n, partyId: 1n });
    expect(e.despues).toMatchObject({ permiso: 'creditos/ver', nota: 'apoyo' });
    expect(e.despues.venceEn).toBe(new Date(venceEn).toISOString());
  });

  it('revocar quita el permiso y lo audita', async () => {
    const previos = [{ user_account_id: 10n, modulo: 'creditos', accion: 'ver', vence_en: null, nota: null }];
    const { svc, tx, auditoria } = montar({}, [], previos);
    const r = await svc.reemplazar(10n, dto([]), ADMIN as any);
    expect(r.revocados).toEqual(['creditos/ver']);
    expect(tx.userAccountPermiso.deleteMany.mock.calls[0][0].where.OR).toContainEqual({ modulo: 'creditos', accion: 'ver' });
    expect(auditoria.registrar.mock.calls[0][0].accion).toBe('PERMISO_EXTRA_REVOCADO');
  });

  it('un extra vencido no cuenta como previo: se limpia sin auditarlo como revocado', async () => {
    const previos = [{ user_account_id: 10n, modulo: 'creditos', accion: 'ver', vence_en: new Date(Date.now() - 1000), nota: null }];
    const { svc, auditoria } = montar({}, [], previos);
    const r = await svc.reemplazar(10n, dto([]), ADMIN as any);
    expect(r.revocados).toEqual([]);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('solo ADMIN otorga (403 a los demás, aunque tengan usuarios/editar por un extra)', async () => {
    const { svc } = montar();
    await expect(svc.reemplazar(10n, dto([]), { ...ADMIN, rol: 'SUPERVISOR', roles: ['SUPERVISOR'], partyId: 2n } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('anti-escalada: nadie se da ni se quita permisos a sí mismo', async () => {
    const { svc } = montar({ party_id: 1n });
    await expect(svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver' }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'AUTO_PERMISO' } });
  });

  it('rechaza permisos fuera del catálogo, repetidos y fechas pasadas o de más de 1 año', async () => {
    const { svc } = montar();
    await expect(svc.reemplazar(10n, dto([{ modulo: 'x', accion: 'y' }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'PERMISO_INVALIDO' } });
    await expect(svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver' }, { modulo: 'creditos', accion: 'ver' }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'PERMISO_REPETIDO' } });
    await expect(svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver', venceEn: '2020-01-01T00:00:00Z' }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'FECHA_PASADA' } });
    const lejos = new Date(Date.now() + 400 * 86400000).toISOString();
    await expect(svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver', venceEn: lejos }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'VIGENCIA_EXCESIVA' } });
  });

  it('los permisos delicados exigen confirmación fuerte; con ella pasan', async () => {
    const { svc, tx } = montar();
    expect(esSensible('creditos/saldar')).toBe(true);
    await expect(svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'saldar' }]), ADMIN as any)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userAccountPermiso.upsert).not.toHaveBeenCalled();
    const r = await svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'saldar' }], true), ADMIN as any);
    expect(r.otorgados).toEqual(['creditos/saldar']);
  });

  it('la lista de sensibles solo nombra permisos del catálogo', () => {
    for (const c of ['usuarios/editar', 'configuracion/editar', 'pedidos/anular', 'comprobantes/emitir']) expect(CATALOGO_PERMISOS.has(c) && esSensible(c)).toBe(true);
  });

  it('REPARTIDOR (principal o extra) y ADMIN quedan bloqueados', async () => {
    await expect(montar({ rol: 'REPARTIDOR' }).svc.reemplazar(10n, dto([{ modulo: 'creditos', accion: 'ver' }]), ADMIN as any)).rejects.toMatchObject({ response: { codigo: 'PERMISOS_BLOQUEADOS' } });
    await expect(montar({ rol: 'ADMIN' }).svc.reemplazar(10n, dto([]), ADMIN as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('obtener devuelve roles, extras, efectivos y módulos en lenguaje llano marcando lo que viene del rol', async () => {
    const previos = [{ modulo: 'creditos', accion: 'ver', vence_en: null, nota: 'x', otorgado_en: new Date() }];
    const { svc } = montar({}, [], previos);
    const r = await svc.obtener(10n);
    expect(r.efectivos).toEqual(['caja/ver', 'creditos/ver']);
    const caja = r.modulos.find((m) => m.modulo === 'caja')!;
    expect(caja.nombre).toBe('Caja');
    expect(caja.acciones.find((a) => a.accion === 'ver')).toMatchObject({ porRol: true, extra: false });
    expect(r.modulos.find((m) => m.modulo === 'creditos')!.acciones.find((a) => a.accion === 'ver')).toMatchObject({ extra: true, porRol: false });
  });
});

describe('AccesoGuard con permisos extra', () => {
  function guard(extras: any[]) {
    const prisma: any = {
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 30n, rol: 'CAJERO', activo: true, debe_cambiar: false }) },
      userAccountRol: { findMany: jest.fn().mockResolvedValue([]) },
      userAccountPermiso: { findMany: jest.fn().mockResolvedValue(extras) },
      rolPermiso: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const reflector: any = { getAllAndOverride: jest.fn((k: any) => (k === CLAVE_PERMISO ? { modulo: 'creditos', accion: 'ver' } : undefined)) };
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ partyId: '30' }) };
    const config: any = { get: jest.fn().mockReturnValue('s') };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    const g = new AccesoGuard(reflector, jwt, config, prisma, auditoria);
    const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer t' } }) }), getHandler: () => 0, getClass: () => 0 };
    return { g, ctx };
  }

  it('permite la acción solo por el extra vigente', async () => {
    const { g, ctx } = guard([{ modulo: 'creditos', accion: 'ver' }]);
    await expect(g.canActivate(ctx)).resolves.toBe(true);
  });

  it('sin extra (revocado o vencido) vuelve a 403', async () => {
    const { g, ctx } = guard([]);
    await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
  });
});
