jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { Reflector } from '@nestjs/core';
import { TiemposController } from './tiempos/tiempos.controller';
import { CLAVE_PERMISO, type PermisoRequerido } from '../acceso/permiso.decorator';
import { MATRIZ, ROLES, PERMISOS } from '../acceso/permisos';
import { CLAVES_NUMERICAS, RANGOS_NUMERICOS } from '../configuracion/configuracion.service';
import { CLAVES_METAS_TIEMPOS } from '@caprichos/compartido';

describe('Análisis: permisos por rol', () => {
  const reflector = new Reflector();
  const requerido = (metodo: keyof TiemposController) => reflector.get<PermisoRequerido>(CLAVE_PERMISO, TiemposController.prototype[metodo] as any);

  it('el permiso analisis/ver existe en el catálogo', () => {
    expect(PERMISOS.some((p) => p.modulo === 'analisis' && p.accion === 'ver')).toBe(true);
  });

  it.each(['resumen', 'atascados'] as const)('%s exige analisis/ver', (m) => {
    expect(requerido(m)).toEqual({ modulo: 'analisis', accion: 'ver' });
  });

  it.each(['ADMIN', 'SUPERVISOR'])('%s sí entra', (rol) => {
    expect(MATRIZ[rol]).toContain('analisis/ver');
  });

  it('ningún otro rol entra (cajero, mozo, cocina, almacén, repartidores, marketing…)', () => {
    for (const r of ROLES) {
      if (r.codigo === 'ADMIN' || r.codigo === 'SUPERVISOR') continue;
      expect(MATRIZ[r.codigo] ?? []).not.toContain('analisis/ver');
    }
  });

  it('las metas por etapa son parámetros de Configuración con rango validado de 1 a 1440', () => {
    for (const clave of CLAVES_METAS_TIEMPOS) {
      expect(CLAVES_NUMERICAS).toContain(clave);
      expect(RANGOS_NUMERICOS[clave].slice(0, 3)).toEqual([1, 1440, true]);
    }
  });
});
