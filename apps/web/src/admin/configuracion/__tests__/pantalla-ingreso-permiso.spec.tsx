import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { ConfiguracionLocalView } from '../ConfiguracionLocalView';
import { pantallaIngresoApi } from '../pantallaIngresoApi';

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

describe('Pantalla de ingreso en Configuración: visible solo con configuracion/editar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({} as any);
    vi.spyOn(pantallaIngresoApi, 'obtenerAdmin').mockResolvedValue({
      imagenes: [{ tipo: 'defecto', valor: 'fantasma-cafe.webp' }],
      frase: 'Hola',
      fabrica: [],
    });
  });

  it('un usuario sin configuracion/editar no ve la pestaña', async () => {
    usarSesion('CAJERO', ['configuracion/ver']);
    render(
      <MemoryRouter initialEntries={['/admin/configuracion']}>
        <ConfiguracionLocalView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Pantalla de ingreso/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('tarjeta-pantalla-ingreso')).not.toBeInTheDocument();
  });

  it('un ADMIN ve la pestaña y la tarjeta al abrirla', async () => {
    usarSesion('ADMIN', ['configuracion/ver', 'configuracion/editar']);
    render(
      <MemoryRouter initialEntries={['/admin/configuracion?tab=ingreso']}>
        <ConfiguracionLocalView />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('tab', { name: /Pantalla de ingreso/i })).toBeInTheDocument();
    expect(await screen.findByTestId('tarjeta-pantalla-ingreso')).toBeInTheDocument();
  });
});
