import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CocinaAdminView } from '../CocinaAdminView';
import type { Comanda } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

const base: Comanda = {
  id: '7-1',
  pedidoId: '7',
  areaId: '1',
  areaNombre: 'Bebidas',
  ticket: 'CP-0007',
  codigo: 'CP-0007',
  canal: 'WEB',
  modalidad: 'LLEVAR',
  mesa: null,
  minutos: 3,
  color: 'VERDE',
  creado_en: new Date(Date.now() - 3 * 60000).toISOString(),
  lineas: [{ id: '1', nombre: 'Latte', cantidad: 1, opciones: [] }],
};

const NOMBRE_CASILLA = /Preguntar antes de despejar/;

describe('Cocina: «Preguntar antes de despejar» (preferencia personal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Cocinero', rol: 'COCINA' },
      permisos: ['cocina/ver', 'cocina/despejar'],
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
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Bebidas', comandasPendientes: 1 }]);
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([base]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
  });

  const renderVista = () =>
    render(
      <BrowserRouter>
        <CocinaAdminView />
      </BrowserRouter>,
    );

  it('la casilla refleja el valor efectivo: marcada si pide confirmación', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true, confirmarDespejarGeneral: true, personalizado: false });
    renderVista();
    const casilla = await screen.findByRole('checkbox', { name: NOMBRE_CASILLA });
    expect(casilla).toBeChecked();
    expect(casilla).toHaveAccessibleDescription(/Solo para ti\. Si la apagas, Despejar quita la comanda directo/);
    expect(screen.queryByRole('button', { name: 'Usar la del local' })).toBeNull();
  });

  it('desmarcarla guarda al instante con PUT y Despejar deja de pedir confirmación', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true, confirmarDespejarGeneral: true, personalizado: false });
    const guardar = vi.spyOn(cocinaApi, 'guardarMisAjustesCocina').mockResolvedValue({
      confirmarDespejar: false,
      confirmarDespejarGeneral: true,
      personalizado: true,
    });
    const despejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });
    renderVista();

    fireEvent.click(await screen.findByRole('checkbox', { name: NOMBRE_CASILLA }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(false));

    fireEvent.click(await screen.findByRole('button', { name: 'Listo' }));
    await waitFor(() => expect(despejar).toHaveBeenCalledWith('7', '1'));
    expect(screen.queryByText(/¿Marcar como listo/)).toBeNull();
  });

  it('si el guardado falla, la casilla vuelve a su valor y avisa', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true, confirmarDespejarGeneral: true, personalizado: false });
    vi.spyOn(cocinaApi, 'guardarMisAjustesCocina').mockRejectedValue(new Error('red caída'));
    const despejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });
    renderVista();

    const casilla = await screen.findByRole('checkbox', { name: NOMBRE_CASILLA });
    fireEvent.click(casilla);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: NOMBRE_CASILLA })).toBeChecked());

    // Sigue pidiendo confirmación porque el cambio no se guardó
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(await screen.findByText(/¿Marcar como listo\?/)).toBeInTheDocument();
    expect(despejar).not.toHaveBeenCalled();
  });

  it('con preferencia personal distinta del general, «Usar la del local» envía null', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: false, confirmarDespejarGeneral: true, personalizado: true });
    const guardar = vi.spyOn(cocinaApi, 'guardarMisAjustesCocina').mockResolvedValue({
      confirmarDespejar: true,
      confirmarDespejarGeneral: true,
      personalizado: false,
    });
    renderVista();

    expect(await screen.findByRole('checkbox', { name: NOMBRE_CASILLA })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Usar la del local' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(null));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: NOMBRE_CASILLA })).toBeChecked());
    expect(screen.queryByRole('button', { name: 'Usar la del local' })).toBeNull();
  });

  it('sin preferencia personal no aparece «Usar la del local» y no se guarda nada al cargar', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: false, confirmarDespejarGeneral: false, personalizado: false });
    const guardar = vi.spyOn(cocinaApi, 'guardarMisAjustesCocina');
    renderVista();

    expect(await screen.findByRole('checkbox', { name: NOMBRE_CASILLA })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Usar la del local' })).toBeNull();
    expect(guardar).not.toHaveBeenCalled();
  });
});
