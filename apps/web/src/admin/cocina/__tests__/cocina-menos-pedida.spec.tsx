import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ComandaTarjeta } from '../ComandaTarjeta';
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
  lineas: [
    {
      id: '1',
      nombre: 'Latte',
      cantidad: 1,
      opciones: [
        { id: '201', nombre: 'Entera', grupo: 'Leche', pocoPedida: false },
        { id: '203', nombre: 'Almendra', grupo: 'Leche', pocoPedida: true },
      ],
    },
  ],
};

describe('Ficha de cocina: opción menos pedida', () => {
  it('resalta la opción marcada y deja las demás normales, con texto accesible «poco pedida»', () => {
    render(<ComandaTarjeta comanda={base} soloLectura />);
    const destacada = screen.getByTestId('opcion-poco-pedida');
    expect(destacada).toHaveTextContent('Almendra');
    expect(destacada).toHaveTextContent('(poco pedida)');
    expect(destacada.style.fontWeight).toBe('800');
    // La opción normal no lleva la marca
    expect(screen.getByText('Entera').closest('[data-testid="opcion-poco-pedida"]')).toBeNull();
    expect(screen.getAllByTestId('opcion-poco-pedida')).toHaveLength(1);
  });
});

describe('Ficha de cocina: nombre del cliente y código', () => {
  it('con nombre, el nombre va grande y oscuro y el código chico', () => {
    render(<ComandaTarjeta comanda={{ ...base, cliente: 'Ana Quispe' }} soloLectura />);
    const nombre = screen.getByTestId('comanda-cliente');
    expect(nombre).toHaveTextContent('Ana Quispe');
    expect(nombre.style.fontSize).toBe('20px');
    expect(nombre.style.color).toBe('var(--cp-navy)');
    const codigo = screen.getByTestId('comanda-codigo');
    expect(codigo).toHaveTextContent('CP-0007');
    expect(codigo.style.fontSize).toBe('11px');
  });

  it('sin nombre, el código va grande como antes', () => {
    render(<ComandaTarjeta comanda={base} soloLectura />);
    expect(screen.queryByTestId('comanda-cliente')).toBeNull();
    const codigo = screen.getByTestId('comanda-codigo');
    expect(codigo).toHaveTextContent('CP-0007');
    expect(codigo.style.fontSize).toBe('16px');
  });
});

describe('Pantalla de cocina: despejar según Confirmar al despejar', () => {
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

  it('con la confirmación encendida, Despejar pide Sí o No antes de despejar', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: true });
    const despejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });
    renderVista();

    fireEvent.click(await screen.findByRole('button', { name: 'Despejar' }));
    expect(await screen.findByText(/¿Despejar comanda CP-0007\?/)).toBeInTheDocument();
    expect(despejar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, despejar' }));
    await waitFor(() => expect(despejar).toHaveBeenCalledWith('7', '1'));
  });

  it('con la confirmación apagada, un toque despeja directo sin Sí o No', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockResolvedValue({ confirmarDespejar: false });
    const despejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });
    renderVista();

    fireEvent.click(await screen.findByRole('button', { name: 'Despejar' }));
    await waitFor(() => expect(despejar).toHaveBeenCalledWith('7', '1'));
    expect(screen.queryByText(/¿Despejar comanda/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sí, despejar' })).toBeNull();
  });

  it('si no se pueden leer los ajustes, queda la confirmación encendida', async () => {
    vi.spyOn(cocinaApi, 'obtenerAjustesCocina').mockRejectedValue(new Error('red caída'));
    const despejar = vi.spyOn(cocinaApi, 'despejarComanda').mockResolvedValue({ ok: true });
    renderVista();

    fireEvent.click(await screen.findByRole('button', { name: 'Despejar' }));
    expect(await screen.findByText(/¿Despejar comanda CP-0007\?/)).toBeInTheDocument();
    expect(despejar).not.toHaveBeenCalled();
  });
});
