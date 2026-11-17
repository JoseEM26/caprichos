import { describe, it, expect, vi, beforeEach } from 'vitest';
import { abrirTodas } from './abrirTodas';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: () => true }) }));
vi.mock('../api', () => ({ salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() } }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({ ModalNuevoPedidoMesa: () => null }));

const linea = { id: '1', nombre: 'Café', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 5, subtotal: 5, lista: false };
const ped = (id: string, estado: string, espera: number) => ({
  id, codigo: `CP-${id}`, estado, modalidad: 'MESA', mesaNombre: 'Mesa 1', total: 5, pagoEstado: 'PENDIENTE',
  creadoEn: '2026-10-29T15:10:00Z', lineas: [linea], mozoNombre: 'Rosa', mozoPartyId: '7', esperaMinutos: espera,
});
const base = {
  pedidos: [ped('A', 'PREPARANDO', 4), ped('B', 'COLA', 25), ped('C', 'LISTO', 12)],
  resumen: { cantidad: 3, total: 15, enCurso: 3, entregados: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
  vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
});

const elegir = (combo: RegExp | string, opcion: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name: combo }));
  fireEvent.click(screen.getByRole('option', { name: opcion }));
};

describe('Mis pedidos: filtros', () => {
  it('sin lista de mozos (rol mozo) no hay selector «Mozo»', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    expect(screen.queryByRole('button', { name: /^Mozo:/ })).toBeNull();
  });

  it('admin/supervisor: selector Mozo con contadores; elegir uno lo manda a la API y a la URL', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({ ...base, mozos: [{ partyId: '7', nombre: 'Rosa', pedidos: 2 }, { partyId: '8', nombre: 'Luis', pedidos: 1 }] } as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    fireEvent.click(screen.getByRole('button', { name: 'Mozo: Todos' }));
    expect(screen.getByRole('option', { name: /Rosa/ })).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('option', { name: /Luis/ }));
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: 'hoy', mozo: '8' }));
    expect(window.location.search).toContain('mozo=8');
  });

  it('periodo (chip), estado (panel avanzado) y orden viajan a la API', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: '7dias' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filtros avanzados' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Preparando' }));
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: '7dias', estado: 'PREPARANDO' }));
    elegir(/^Orden:/, 'Más tiempo en espera');
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: '7dias', estado: 'PREPARANDO', orden: 'mas_espera' }));
    // La URL guarda el nombre del chip (semana); la API recibe 7dias
    expect(window.location.search).toMatch(/rango=semana/);
    expect(window.location.search).toMatch(/estado=PREPARANDO/);
  });

  it('el chip «Este mes» pide desde el día 1 hasta hoy, en Lima', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy }));
  });

  it('rango Desde/hasta pide por fechas', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    fireEvent.click(screen.getByRole('button', { name: 'Rango' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-10-15' }));
  });

  it('rango de más de 92 días: avisa y no pide nada', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    fireEvent.click(screen.getByRole('button', { name: 'Rango' }));
    const llamadas = vi.mocked(salonApi.misPedidos).mock.calls.length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('El rango no puede pasar de 92 días.');
    expect(vi.mocked(salonApi.misPedidos).mock.calls.length).toBe(llamadas);
  });

  it('«Más tiempo en espera» ordena de mayor a menor y muestra los minutos con su nivel', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-A');
    elegir(/^Orden:/, 'Más tiempo en espera');
    await waitFor(() => {
      const minutos = screen.getAllByTestId('espera-minutos').map((e) => e.textContent);
      expect(minutos).toEqual(['⏱ 25 min', '⏱ 12 min', '⏱ 4 min']);
    });
    const [alta, media, baja] = screen.getAllByTestId('espera-minutos');
    expect(alta).toHaveClass('mp-espera--alta');
    expect(media).toHaveClass('mp-espera--media');
    expect(baja).toHaveClass('mp-espera--baja');
  });

  it('los filtros de la URL se aplican al abrir', async () => {
    window.history.replaceState(null, '', '/admin/mis-pedidos?rango=ayer&estado=LISTO&mozo=8');
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenCalledWith({ rango: 'ayer', mozo: '8', estado: 'LISTO' }));
    // El chip de la URL queda marcado y el panel avanzado cuenta el estado de la URL
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Filtros avanzados (1)' })).toBeInTheDocument();
  });
});
