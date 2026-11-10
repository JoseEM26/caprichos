import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MODULOS_ROL } from '@caprichos/compartido';
import { RolesModulosEditor } from '../RolesModulosEditor';
import { api } from '../../../comun/api';
import { MODULOS as MODULOS_REALES } from '../../modulos';

vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, ErrorApi: class extends Error {} }));
vi.mock('../../modulos', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    GRUPOS_MODULOS: ['Operación', 'Compras y stock'],
    MODULOS: [
      { clave: 'caja', nombre: 'Caja', grupo: 'Operación', permisoMinimo: 'caja/ver' },
      { clave: 'cierre', nombre: 'Cierre', grupo: 'Operación', permisoMinimo: 'caja/ver' },
      { clave: 'stock', nombre: 'Stock', grupo: 'Compras y stock', permisoMinimo: 'stock/ver' },
      { clave: 'notificaciones', nombre: 'Notificaciones', grupo: 'Operación', permisoMinimo: 'notificaciones/ver' },
    ],
    __reales: real.MODULOS,
  };
});

const st = (ve: boolean, base = ve) => ({ ve, base, ajustado: ve !== base });
const RESP = {
  catalogo: [
    { clave: 'caja', minimo: 'caja/ver', bloqueado: false },
    { clave: 'cierre', minimo: 'caja/ver', bloqueado: false },
    { clave: 'stock', minimo: 'stock/ver', bloqueado: false },
    { clave: 'notificaciones', minimo: 'notificaciones/ver', bloqueado: true },
  ],
  roles: [
    { rol: 'ADMIN', nombre: 'Administrador', editable: false, ajustes: 0, modulos: { caja: st(true), cierre: st(true), stock: st(true), notificaciones: st(true) } },
    { rol: 'MOZO', nombre: 'Mozo', editable: true, ajustes: 1, modulos: { caja: st(false), cierre: st(false), stock: st(true, false), notificaciones: st(true) } },
  ],
};

describe('catálogo compartido vs módulos de la web', () => {
  it('cada módulo del catálogo existe en el admin con el mismo permiso mínimo', async () => {
    const reales: any[] = (await import('../../modulos') as any).__reales ?? MODULOS_REALES;
    for (const c of MODULOS_ROL) {
      const m = reales.find((x) => x.clave === c.clave);
      expect(m, c.clave).toBeTruthy();
      expect(m.permisoMinimo).toBe(c.minimo);
    }
    // todo módulo con permiso mínimo está en el catálogo (si no, no se puede editar)
    for (const m of reales.filter((x) => x.permisoMinimo)) expect(MODULOS_ROL.some((c) => c.clave === m.clave), m.clave).toBe(true);
  });
});

describe('RolesModulosEditor', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockResolvedValue(RESP);
    vi.mocked(api.put).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(api.post).mockReset().mockResolvedValue({ ok: true });
  });

  it('ADMIN y módulos obligatorios bloqueados; marca lo modificado respecto al sistema', async () => {
    render(<RolesModulosEditor />);
    const admin = await screen.findByLabelText('Administrador: Caja');
    expect((admin as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Mozo: Notificaciones') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByLabelText('modificado respecto al sistema')).toHaveLength(1); // Mozo: Stock
  });

  it('marcar Caja marca también Cierre (mismo permiso), pide Sí/No con el resumen y guarda', async () => {
    render(<RolesModulosEditor />);
    const caja = await screen.findByLabelText('Mozo: Caja');
    expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(caja);
    expect((screen.getByLabelText('Mozo: Cierre') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/ve ahora: Caja, Cierre/)).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/usuarios/roles-modulos/MOZO', { modulos: expect.arrayContaining(['caja', 'cierre', 'stock', 'notificaciones']) }));
    expect(await screen.findByText(/Cambios guardados/)).toBeTruthy();
  });

  it('No cancela sin guardar', async () => {
    render(<RolesModulosEditor />);
    fireEvent.click(await screen.findByLabelText('Mozo: Stock'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('Restablecer rol pide confirmación y llama al servidor', async () => {
    render(<RolesModulosEditor />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer rol' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, restablecer' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/usuarios/roles-modulos/MOZO/restablecer'));
  });

  it('error al cargar', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('x'));
    render(<RolesModulosEditor />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
