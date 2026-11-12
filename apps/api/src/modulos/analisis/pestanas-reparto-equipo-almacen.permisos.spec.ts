jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }), registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { Reflector } from '@nestjs/core';
import { RepartoAnalisisController } from './reparto/reparto.controller';
import { EquipoController } from './equipo/equipo.controller';
import { AlmacenAnalisisController } from './almacen/almacen.controller';
import { CLAVE_PERMISO, type PermisoRequerido } from '../acceso/permiso.decorator';

const reflector = new Reflector();
const permiso = (c: { prototype: object }, m: string) => reflector.get<PermisoRequerido>(CLAVE_PERMISO, (c.prototype as Record<string, never>)[m]);

describe('Análisis: Reparto, Equipo y Almacén', () => {
  it.each([
    [RepartoAnalisisController, 'resumen'],
    [RepartoAnalisisController, 'porRendir'],
    [EquipoController, 'resumen'],
    [EquipoController, 'huecos'],
    [AlmacenAnalisisController, 'resumen'],
  ] as const)('%p.%s exige analisis/ver', (c, m) => {
    expect(permiso(c, m)).toEqual({ modulo: 'analisis', accion: 'ver' });
  });

  it('el detalle por persona depende del rol ADMIN de la sesión, no de un parámetro', () => {
    const servicio: any = { resumen: jest.fn(), porRendir: jest.fn(), huecos: jest.fn() };
    const rep = new RepartoAnalisisController(servicio);
    const eq = new EquipoController(servicio);
    rep.resumen({}, { user: { rol: 'SUPERVISOR', roles: ['SUPERVISOR'] } });
    expect(servicio.resumen).toHaveBeenLastCalledWith({}, false);
    rep.resumen({}, { user: { rol: 'ADMIN', roles: ['ADMIN'] } });
    expect(servicio.resumen).toHaveBeenLastCalledWith({}, true);
    rep.porRendir({ user: { rol: 'SUPERVISOR' } });
    expect(servicio.porRendir).toHaveBeenLastCalledWith(false);
    eq.resumen({ desde: '2026-11-01' }, { user: { rol: 'SUPERVISOR' } });
    expect(servicio.resumen).toHaveBeenLastCalledWith({ desde: '2026-11-01' }, false);
    eq.resumen({}, {});
    expect(servicio.resumen).toHaveBeenLastCalledWith({}, false);
  });
});
