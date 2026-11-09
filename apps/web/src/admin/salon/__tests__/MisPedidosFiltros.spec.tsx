import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    await screen.findByText('CP-A');
    expect(screen.queryByRole('button', { name: /^Mozo:/ })).toBeNull();
  });

  it('admin/supervisor: selector Mozo con contadores; elegir uno lo manda a la API y a la URL', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({ ...base, mozos: [{ partyId: '7', nombre: 'Rosa', pedidos: 2 }, { partyId: '8', nombre: 'Luis', pedidos: 1 }] } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-A');
    fireEvent.click(screen.getByRole('button', { name: 'Mozo: Todos' }));
    expect(screen.getByRole('option', { name: /Rosa/ })).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('option', { name: /Luis/ }));
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: 'hoy', mozo: '8' }));
    expect(window.location.search).toContain('mozo=8');
  });

  it('estado, periodo y orden viajan a la API', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-A');
    elegir('Estado: Todos', 'Preparando');
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: 'hoy', estado: 'PREPARANDO' }));
    elegir('Periodo: Hoy', 'Últimos 30 días');
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: '30dias', estado: 'PREPARANDO' }));
    elegir(/^Orden:/, 'Más tiempo en espera');
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: '30dias', estado: 'PREPARANDO', orden: 'mas_espera' }));
    expect(window.location.search).toMatch(/rango=30dias/);
  });

  it('rango Desde/hasta pide por fechas', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-A');
    elegir('Periodo: Hoy', 'Desde / hasta');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-10-15' }));
  });

  it('«Más tiempo en espera» ordena de mayor a menor y muestra los minutos con su nivel', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue(base as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-A');
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
    expect(screen.getByRole('button', { name: 'Estado: Listo' })).toBeInTheDocument();
  });
});
