jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({ signAsync: jest.fn(), verifyAsync: jest.fn() })),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { CLAVE_PERMISO } from '../../acceso/permiso.decorator';
import { ResenasAdminController } from '../resenas-admin.controller';
import { ResenasCartaController } from '../resenas-carta.controller';

describe('ResenasAdminController (permisos)', () => {
  const servicio: any = {
    listarAdmin: jest.fn().mockResolvedValue({}),
    buscarNegocio: jest.fn().mockResolvedValue({ ok: true, candidatos: [] }),
    guardarNegocio: jest.fn().mockResolvedValue({}),
    cargaInicial: jest.fn().mockResolvedValue({ ok: true }),
    actualizar: jest.fn().mockResolvedValue({ ok: true }),
    cambiarVisible: jest.fn().mockResolvedValue({}),
  };
  const ctrl = new ResenasAdminController(servicio);
  const noAdmin = { usuario: { partyId: 2n, rol: 'CAJERO' }, ip: '1.1.1.1' } as any;
  const admin = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '1.1.1.1' } as any;

  it('todas las rutas van detrás de AccesoGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ResenasAdminController)).toContain(AccesoGuard);
  });

  it('los permisos del decorador son configuracion ver/editar', () => {
    const permiso = (m: keyof ResenasAdminController) => Reflect.getMetadata(CLAVE_PERMISO, (ResenasAdminController.prototype as any)[m]);
    expect(permiso('listar')).toEqual({ modulo: 'configuracion', accion: 'ver' });
    for (const m of ['buscarNegocio', 'guardarNegocio', 'cargaInicial', 'actualizar', 'cambiarVisible'] as const) {
      expect(permiso(m)).toEqual({ modulo: 'configuracion', accion: 'editar' });
    }
    expect(Reflect.getMetadata(METHOD_METADATA, ResenasAdminController.prototype.cargaInicial)).toBeDefined();
  });

  it('quien no es ADMIN recibe 403 y el servicio no se llama', async () => {
    await expect(ctrl.listar(noAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.cargaInicial({}, noAdmin, '1.1.1.1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.actualizar(noAdmin, '1.1.1.1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.cambiarVisible('1', { visible: false }, noAdmin, '1.1.1.1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(servicio.cargaInicial).not.toHaveBeenCalled();
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });

  it('ADMIN llega al servicio; carga inicial sin repetir por defecto', async () => {
    await ctrl.cargaInicial({}, admin, '1.1.1.1');
    expect(servicio.cargaInicial).toHaveBeenCalledWith({ repetir: false, usuario: admin.usuario, ip: '1.1.1.1' });
    await ctrl.actualizar(admin, '1.1.1.1');
    expect(servicio.actualizar).toHaveBeenCalledWith({ manual: true, usuario: admin.usuario, ip: '1.1.1.1' });
  });
});

describe('ResenasCartaController', () => {
  it('GET /carta/resenas es publico con cache de 1 hora', () => {
    const headers = Reflect.getMetadata('__headers__', ResenasCartaController.prototype.listar) ?? [];
    expect(JSON.stringify(headers)).toContain('public, max-age=3600');
    expect(Reflect.getMetadata(GUARDS_METADATA, ResenasCartaController)).toBeUndefined();
  });
});
