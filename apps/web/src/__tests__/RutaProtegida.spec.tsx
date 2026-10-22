import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RutaProtegida } from '../comun/RutaProtegida';
import * as sesionModulo from '../comun/sesion';

describe('RutaProtegida', () => {
  it('redirige a /admin/ingresar si no hay usuario autenticado', () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: null,
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: false,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(false),
    });

    render(
      <MemoryRouter initialEntries={['/admin/pedidos']}>
        <Routes>
          <Route
            path="/admin/pedidos"
            element={
              <RutaProtegida>
                <div>Contenido Protegido</div>
              </RutaProtegida>
            }
          />
          <Route path="/admin/ingresar" element={<div>Pantalla Ingresar</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Contenido Protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Pantalla Ingresar')).toBeInTheDocument();
  });

  it('redirige a /admin/cambiar-clave si debeCambiar es true y la ruta actual es distinta', () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Mozo Uno', rol: 'MOZO' },
      permisos: [],
      debeCambiar: true,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    render(
      <MemoryRouter initialEntries={['/admin/pedidos']}>
        <Routes>
          <Route
            path="/admin/pedidos"
            element={
              <RutaProtegida>
                <div>Contenido Protegido</div>
              </RutaProtegida>
            }
          />
          <Route path="/admin/cambiar-clave" element={<div>Pantalla Cambiar Clave</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Contenido Protegido')).not.toBeInTheDocument();
    expect(screen.getByText('Pantalla Cambiar Clave')).toBeInTheDocument();
  });

  it('muestra la pantalla «No tienes permiso» si el usuario no tiene el permiso solicitado', () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Mozo Dos', rol: 'MOZO' },
      permisos: ['pedidos/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((p: string) => p === 'pedidos/ver'),
    });

    render(
      <MemoryRouter initialEntries={['/admin/usuarios']}>
        <Routes>
          <Route
            path="/admin/usuarios"
            element={
              <RutaProtegida permiso="usuarios/ver">
                <div>Administración de Usuarios</div>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Administración de Usuarios')).not.toBeInTheDocument();
    expect(screen.getByText('No tienes permiso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al escritorio/i })).toBeInTheDocument();
  });

  it('renderiza el contenido protegido si el usuario tiene sesión y permiso', () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '3', nombres: 'Admin Caprichos', rol: 'ADMIN' },
      permisos: ['usuarios/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    render(
      <MemoryRouter initialEntries={['/admin/usuarios']}>
        <Routes>
          <Route
            path="/admin/usuarios"
            element={
              <RutaProtegida permiso="usuarios/ver">
                <div>Administración de Usuarios</div>
              </RutaProtegida>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Administración de Usuarios')).toBeInTheDocument();
  });
});
