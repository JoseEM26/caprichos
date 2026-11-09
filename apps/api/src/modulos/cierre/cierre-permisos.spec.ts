import { MATRIZ } from '../acceso/permisos';

describe('cierre de caja: permisos por rol (el esperado se ve sin código)', () => {
  it('quien cierra la caja (CAJERO, SUPERVISOR, ADMIN) también ve el esperado: caja/cerrar y caja/ver', () => {
    for (const rol of ['CAJERO', 'SUPERVISOR', 'ADMIN']) {
      expect(MATRIZ[rol]).toEqual(expect.arrayContaining(['caja/cerrar', 'caja/ver']));
    }
  });

  it('los roles sin caja no cierran ni ven el cierre', () => {
    for (const rol of ['MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR']) {
      expect(MATRIZ[rol] ?? []).not.toContain('caja/cerrar');
    }
  });
});
