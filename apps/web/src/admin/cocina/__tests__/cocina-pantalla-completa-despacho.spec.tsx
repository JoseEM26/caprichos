import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CocinaAdminView } from '../CocinaAdminView';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const sesion = (tiene: (p: string) => boolean) =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Cocinero', rol: 'COCINERO' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene,
  } as any);

describe('Cocina en pantalla completa: Despacho', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Barra', comandasPendientes: 0 }]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue({
      ahoraServidor: new Date().toISOString(),
      umbrales: { naranjaMin: 35, rojoMin: 50 },
      pedidos: [],
    } as any);
  });

  it('con permiso cocina/despacho, la ventana completa muestra el botón Despacho y la vista de despacho', async () => {
    sesion(() => true);
    render(<CocinaAdminView />);
    fireEvent.click(await screen.findByRole('button', { name: /Pantalla completa/i }));
    const fs = await screen.findByTestId('pantalla-completa-cocina');
    fireEvent.click(within(fs).getByTestId('pantalla-completa-despacho'));
    expect(await within(fs).findByTestId('despacho-vacio')).toBeInTheDocument();
    // volver a un área sale del despacho
    fireEvent.click(within(fs).getByRole('button', { name: 'Todas' }));
    expect(within(fs).queryByTestId('despacho-vacio')).toBeNull();
  });

  it('sin permiso cocina/despacho no hay botón Despacho en ventana completa', async () => {
    sesion((p) => p !== 'cocina/despacho');
    render(<CocinaAdminView />);
    fireEvent.click(await screen.findByRole('button', { name: /Pantalla completa/i }));
    const fs = await screen.findByTestId('pantalla-completa-cocina');
    expect(within(fs).queryByTestId('pantalla-completa-despacho')).toBeNull();
  });
});
