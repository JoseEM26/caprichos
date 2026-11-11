import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CocinaAdminView } from '../CocinaAdminView';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import type { Comanda } from '../cocinaTipos';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const comanda: Comanda = {
  id: '301-1',
  pedidoId: '301',
  areaId: '1',
  areaNombre: 'Barra',
  ticket: 'CP-301',
  codigo: 'CP-301',
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [{ id: 'l1', nombre: 'Americano', cantidad: 1, opciones: [], personas: [], nota: null }],
  despejada: false,
};

describe('Cocina no anula pedidos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // ADMIN con todos los permisos, incluido pedidos/anular
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: () => true,
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Barra', comandasPendientes: 1 }]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([comanda]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
  });

  it('la vista normal muestra la comanda pero no «Anular pedido»', async () => {
    render(<CocinaAdminView />);
    expect(await screen.findAllByText(/Americano/)).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Anular/i })).toBeNull();
  });

  it('la pantalla completa muestra la comanda pero no «Anular pedido»', async () => {
    render(<CocinaAdminView />);
    fireEvent.click(await screen.findByRole('button', { name: /Pantalla completa/i }));
    const fs = await screen.findByTestId('pantalla-completa-cocina');
    expect(await within(fs).findAllByText(/Americano/)).not.toHaveLength(0);
    expect(within(fs).queryByRole('button', { name: /Anular/i })).toBeNull();
  });
});
