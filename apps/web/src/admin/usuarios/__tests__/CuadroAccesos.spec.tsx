import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CuadroAccesos } from '../CuadroAccesos';
import { celdaModulo, contarModulo, type AccesoUsuario } from '../accesosModulos';
import { moduloVisible, tienePermiso } from '../../../comun/permisosPuro';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({ api: { get: vi.fn() }, ErrorApi: class extends Error {} }));
vi.mock('../../modulos', () => ({
  GRUPOS_MODULOS: ['Operación', 'Configuración'],
  MODULOS: [
    { clave: 'caja', nombre: 'Caja', grupo: 'Operación', permisoMinimo: 'caja/ver' },
    { clave: 'escritorio', nombre: 'Escritorio', grupo: 'Operación' },
    { clave: 'usuarios', nombre: 'Usuarios', grupo: 'Configuración', permisoMinimo: 'usuarios/ver' },
  ],
}));

const u = (o: Partial<AccesoUsuario>): AccesoUsuario => ({ id: '1', nombre: 'X', activo: true, todos: false, roles: [{ rol: 'MOZO', vence_en: null }], permisos: [], permisosExtra: [], ...o });

describe('regla pura de permisos (la misma del menú)', () => {
  it('ADMIN todo; permiso exacto; módulo suelto; sin permisoMinimo siempre visible', () => {
    expect(tienePermiso([], 'caja/ver', true)).toBe(true);
    expect(tienePermiso(['caja/ver'], 'caja/ver')).toBe(true);
    expect(tienePermiso(['caja/ver'], 'caja')).toBe(true);
    expect(tienePermiso(['caja/ver'], 'usuarios/ver')).toBe(false);
    expect(moduloVisible({}, () => false)).toBe(true);
    expect(moduloVisible({ permisoMinimo: 'x/ver' }, () => false)).toBe(false);
  });
  it('celdaModulo distingue rol, extra y no; ADMIN ve todo', () => {
    const m = { permisoMinimo: 'caja/ver' };
    expect(celdaModulo(u({ permisos: ['caja/ver'] }), m)).toBe('rol');
    expect(celdaModulo(u({ permisos: ['caja/ver'], permisosExtra: [{ permiso: 'caja/ver', vence_en: null }] }), m)).toBe('extra');
    expect(celdaModulo(u({}), m)).toBe('no');
    expect(celdaModulo(u({ todos: true }), m)).toBe('rol');
    expect(contarModulo([u({ permisos: ['caja/ver'] }), u({})], m)).toBe(1);
  });
});

describe('CuadroAccesos', () => {
  it('muestra Sí/No con texto alternativo, roles con vencimiento, contador y filtro de excepciones', async () => {
    (api.get as any).mockResolvedValue({
      usuarios: [
        u({ id: '1', nombre: 'Ana Admin', todos: true, roles: [{ rol: 'ADMIN', vence_en: null }] }),
        u({ id: '2', nombre: 'Beto Mozo', roles: [{ rol: 'MOZO', vence_en: null }, { rol: 'CAJERO', vence_en: '2026-12-01T12:00:00Z' }], permisos: ['caja/ver'] }),
        u({ id: '3', nombre: 'Carla Extra', permisos: ['caja/ver'], permisosExtra: [{ permiso: 'caja/ver', vence_en: null }] }),
      ],
    });
    render(<CuadroAccesos />);
    await screen.findByText('Ana Admin');
    expect(screen.getByText(/vence /)).toBeTruthy();
    expect(screen.getAllByText('3 de 3').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Sí, por permiso extra')).toHaveLength(1);
    expect(screen.getAllByLabelText('No').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText(/Solo diferencias/));
    await waitFor(() => expect(screen.queryByText('Beto Mozo')).toBeNull());
    expect(screen.getByText('Carla Extra')).toBeTruthy();
  });
});
