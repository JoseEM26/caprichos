import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MODULOS } from '../modulos';
import { ETIQUETAS_ROLES, ROLES_ASIGNABLES, ROLES_EXCLUSIVOS, VISTA_PREVIA_ROL, errorCombinacionRoles } from '../usuarios/roles';
import { esSoloMarketing } from '../../comun/rolesUsuario';
import { tienePermiso } from '../../comun/permisosPuro';
import * as sesionModulo from '../../comun/sesion';
import { InicioAdmin } from '../../rutas';

// Permisos de MARKETING tal como los devuelve la API (MATRIZ.MARKETING en permisos.ts + asistencia/marcar)
const PERMISOS_MARKETING = [
  'carta_diseno/ver', 'carta_diseno/editar', 'carta_diseno/publicar',
  'novedades/ver', 'novedades/crear', 'novedades/editar',
  'conocenos/ver', 'conocenos/editar', 'conocenos/publicar',
  'destacadas/ver', 'destacadas/crear', 'destacadas/editar', 'destacadas/archivar', 'destacadas/eliminar',
  'resenas/ver', 'resenas/editar',
  'paleta/ver', 'paleta/editar', 'paleta/publicar',
  'archivos/subir', 'notificaciones/ver', 'notificaciones/marcar', 'asistencia/marcar',
];
const tiene = (p: string) => tienePermiso(PERMISOS_MARKETING, p);
const visibles = () => MODULOS.filter((m) => !m.permisoMinimo || tiene(m.permisoMinimo)).map((m) => m.clave);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('menú del rol MARKETING', () => {
  it('ve los seis módulos de contenido, Mi asistencia y Notificaciones (Escritorio no exige permiso; el shell lo oculta)', () => {
    expect(visibles().filter((c) => c !== 'escritorio').sort()).toEqual(
      ['conocenos', 'destacadas', 'disenador', 'mi-asistencia', 'notificaciones', 'novedades', 'paleta', 'resenas'].sort(),
    );
  });

  it('no ve ningún módulo de otras áreas', () => {
    const ve = visibles();
    for (const c of ['caja', 'cierre', 'mensajes', 'cocina', 'repartos', 'clientes', 'productos', 'listas', 'ofertas', 'compras', 'almacen',
      'stock', 'informes', 'indicadores', 'mapa', 'mirest', 'zonas', 'usuarios', 'historial', 'asistencia', 'pantallas', 'mascota', 'comprobantes', 'reclamos', 'creditos', 'iniciativas']) {
      expect(ve, `no debe ver ${c}`).not.toContain(c);
    }
  });

  it('Diseño, Conócenos, Reseñas y Paleta se miran con su propio permiso (no con local/ver, novedades/ver ni configuracion/ver)', () => {
    const minimo = (c: string) => MODULOS.find((m) => m.clave === c)?.permisoMinimo;
    expect(minimo('disenador')).toBe('carta_diseno/ver');
    expect(minimo('conocenos')).toBe('conocenos/ver');
    expect(minimo('resenas')).toBe('resenas/ver');
    expect(minimo('paleta')).toBe('paleta/ver');
  });
});

describe('inicio del rol MARKETING', () => {
  const sesion = (rol: string, roles?: string[]) =>
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol, roles }, tiene } as any);

  const montar = () =>
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<InicioAdmin />} />
          <Route path="/admin/disenador" element={<div>Pantalla del Diseñador</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it('al entrar va a su primer módulo permitido (el Diseñador), no a un escritorio sin permiso', () => {
    sesion('MARKETING');
    montar();
    expect(screen.getByText('Pantalla del Diseñador')).toBeInTheDocument();
  });

  it('esSoloMarketing: solo si MARKETING es su único rol', () => {
    expect(esSoloMarketing({ rol: 'MARKETING' })).toBe(true);
    expect(esSoloMarketing({ rol: 'MARKETING', roles: ['MARKETING'] })).toBe(true);
    expect(esSoloMarketing({ rol: 'CAJERO', roles: ['CAJERO', 'MARKETING'] })).toBe(false);
    expect(esSoloMarketing({ rol: 'MARKETING', roles: ['MARKETING', 'MOZO'] })).toBe(false);
    expect(esSoloMarketing(null)).toBe(false);
  });
});

describe('rol MARKETING en el alta y edición de usuarios', () => {
  it('se puede elegir como rol, tiene etiqueta y descripción', () => {
    expect(ROLES_ASIGNABLES).toContain('MARKETING');
    expect(ETIQUETAS_ROLES.MARKETING).toBe('Marketing y diseño (Carta, novedades, reseñas y paleta)');
    expect(VISTA_PREVIA_ROL.MARKETING.length).toBeGreaterThan(0);
  });

  it('se combina con otros roles, salvo con los exclusivos', () => {
    expect(ROLES_EXCLUSIVOS).not.toContain('MARKETING');
    expect(errorCombinacionRoles('CAJERO', ['MARKETING'])).toBeNull();
    expect(errorCombinacionRoles('MARKETING', ['ADMIN'])).not.toBeNull();
  });
});
