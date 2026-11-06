import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminShell } from '../AdminShell';
import { DispositivoForzado } from '../../carta/useEsMovil';

const sesion = vi.hoisted(() => ({ permisos: [] as string[] }));

vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    usuario: { id: 'u1', nombres: 'Luis Repartidor', rol: 'REPARTIDOR' },
    salir: vi.fn(),
    tiene: (p: string) => sesion.permisos.includes(p),
    cargando: false,
    autenticado: true,
  }),
}));

vi.mock('../useNotificaciones', () => ({
  useNotificaciones: () => ({
    notificaciones: [],
    conteos: {},
    cargado: true,
    refrescar: vi.fn(async () => {}),
    marcar: vi.fn(async () => true),
    ajustes: undefined,
  }),
}));
vi.mock('../notificaciones/notificacionesApi', () => ({
  marcarNotificacion: vi.fn(async () => ({ ok: true })),
  marcarTodasNotificacionesLeidas: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../ayuda/ayudaApi', () => ({
  obtenerContextoAyuda: vi.fn(async () => ({ activo: false, sugerencias: [], enlaces: [] })),
  enviarPreguntaAyuda: vi.fn(),
}));

function montar(ruta: string) {
  return render(
    <DispositivoForzado movil>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin" element={<AdminShell />}>
            <Route path="repartos" element={<p>PANTALLA REPARTOS</p>} />
            <Route path="mi-asistencia" element={<p>PANTALLA MI ASISTENCIA</p>} />
            <Route path="perfil" element={<p>PANTALLA PERFIL</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </DispositivoForzado>,
  );
}

describe('Repartidor en celular: acceso a Mi asistencia', () => {
  beforeEach(() => {
    sesion.permisos = ['asistencia/marcar'];
  });

  it('desde el modal Más abre Marcar asistencia y tiene volver a mis pedidos', async () => {
    // La barra inferior (con Más) no se muestra en /admin/repartos: el acceso de esa pantalla es el botón «Asistencia»
    montar('/admin/perfil');
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    fireEvent.click(screen.getByRole('button', { name: /Marcar asistencia/ }));
    expect(await screen.findByText('PANTALLA MI ASISTENCIA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Volver a mis pedidos/ }));
    expect(await screen.findByText('PANTALLA REPARTOS')).toBeInTheDocument();
  });

  it('en la pantalla de repartos hay un acceso pequeño «Asistencia»', async () => {
    montar('/admin/repartos');
    fireEvent.click(screen.getByRole('button', { name: 'Asistencia' }));
    expect(await screen.findByText('PANTALLA MI ASISTENCIA')).toBeInTheDocument();
  });

  it('sin el permiso asistencia/marcar no aparece ningún acceso', () => {
    sesion.permisos = [];
    montar('/admin/repartos');
    expect(screen.queryByRole('button', { name: 'Asistencia' })).toBeNull();
    cleanup();
    montar('/admin/perfil');
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.queryByRole('button', { name: /Marcar asistencia/ })).toBeNull();
  });
});
