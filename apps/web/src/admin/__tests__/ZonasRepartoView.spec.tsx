import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { api } from '../../comun/api';
import * as sesionModulo from '../../comun/sesion';
import { ZonasRepartoView } from '../configuracion/ZonasRepartoView';

const sesionConZonas = () =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
    permisos: ['zonas/ver', 'zonas/editar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: (p: string) => p.startsWith('zonas/'),
  } as any);

describe('ZonasRepartoView con una respuesta que no es lista', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el estado vacío y no se cae cuando api.get entrega {} (respuesta no JSON)', async () => {
    sesionConZonas();
    vi.spyOn(api, 'get').mockResolvedValueOnce({} as any);

    render(<ZonasRepartoView />);

    await waitFor(() => {
      expect(screen.getByText('No hay zonas registradas')).toBeInTheDocument();
    });
    expect(screen.queryByText(/o\.map is not a function|map is not a function/)).toBeNull();
  });

  it('acepta una respuesta con forma { items: [...] } sin caerse', async () => {
    sesionConZonas();
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      items: [{ id: '1', codigo: 'Z2', tarifa: 2, activa: true, puntos: 0, poligono: [] }],
    } as any);

    render(<ZonasRepartoView />);

    await waitFor(() => {
      expect(screen.getByText('Zona Z2')).toBeInTheDocument();
    });
  });
});
