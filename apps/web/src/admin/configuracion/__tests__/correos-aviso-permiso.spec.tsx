import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';

function usarSesion(rol: string, permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol },
    permisos,
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => permisos.includes(p) || (rol === 'ADMIN' && p === 'ADMIN'),
  } as any);
}

describe('Correos de aviso en Configuración: solo el administrador', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (url: string) =>
      url === '/admin/correos-aviso'
        ? ({ maximo: 20, correoConfigurado: true, tipos: [], correos: [], personasPorUsuario: [] } as any)
        : ({} as any),
    );
  });

  it('un supervisor con permiso de editar NO ve la pestaña ni el atajo', async () => {
    usarSesion('SUPERVISOR', ['configuracion/ver', 'configuracion/editar']);
    render(<MemoryRouter initialEntries={['/admin/configuracion?tab=operacion']}><ConfiguracionLocalView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Correos de aviso/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('atajo-correos-aviso')).not.toBeInTheDocument();
  });

  it('un ADMIN ve la pestaña y abre la sección desde el atajo de Operación', async () => {
    usarSesion('ADMIN', ['configuracion/ver', 'configuracion/editar']);
    render(<MemoryRouter initialEntries={['/admin/configuracion?tab=operacion']}><ConfiguracionLocalView /></MemoryRouter>);
    expect(await screen.findByRole('tab', { name: /Correos de aviso/i })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Ir a Correos de aviso' }));
    expect(await screen.findByRole('button', { name: 'Agregar correo' })).toBeInTheDocument();
  });
});
