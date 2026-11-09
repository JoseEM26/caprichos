import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificacionesView } from '../NotificacionesView';
import { CampanaNotificaciones } from '../CampanaNotificaciones';
import * as api from '../notificacionesApi';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const fila = (n: number, leida = false) => ({
  id: String(n),
  tipoCodigo: 'STOCK_BAJO',
  tipo: 'Stock bajo',
  titulo: `Aviso ${n}`,
  mensaje: `Mensaje ${n}`,
  enlace: null,
  leida,
  leidaEn: null,
  creadoEn: new Date(2026, 9, 15, 20, 59 - n).toISOString(),
  fecha: '15/10/2026',
  hora: '20:00',
  iso: '2026-10-15',
  color: '#C99A2E',
  modulo: null,
  accion: null,
});

const pagina = (desde: number, cuantas: number, total: number) => ({
  metricas: { pendientesAhora: 0, urgentesAhora: 0, sinLeerHistorial: total, delDiaDeHoy: 0, totalHistorial: total, rolNombre: 'admin' },
  pendientes: [],
  conteosPorTipo: { Todos: total },
  conteosPorEstado: { todas: total, nuevas: total, leidas: 0 },
  items: Array.from({ length: cuantas }, (_, i) => fila(desde + i)),
  total,
  hayMas: desde + cuantas - 1 < total,
  siguienteCursor: String(desde + cuantas - 1),
});

let disparar: (visible: boolean) => void = () => {};
class FakeIO {
  constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {
    disparar = (v) => this.cb([{ isIntersecting: v }]);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('Notificaciones: paginación al bajar y marcar todas', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIO);
    vi.spyOn(api, 'marcarTodasNotificacionesLeidas').mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carga 10 y, al llegar al final, pide las siguientes 10 sin repetir y termina con «No hay más»', async () => {
    const lista = vi.spyOn(api, 'listarHistorialNotificaciones').mockImplementation(async (f) => {
      if (!f?.cursor) return pagina(1, 10, 15);
      return pagina(11, 5, 15);
    });
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Mensaje 10')).toBeInTheDocument());
    expect(screen.queryByText('Mensaje 11')).toBeNull();
    expect(lista).toHaveBeenCalledWith(expect.objectContaining({ limite: 10 }));

    // el centinela dispara dos veces seguidas: solo sale un pedido
    act(() => {
      disparar(true);
      disparar(true);
    });
    await waitFor(() => expect(screen.getByText('Mensaje 15')).toBeInTheDocument());
    expect(lista.mock.calls.filter(([f]) => f?.cursor === '10')).toHaveLength(1);
    expect(screen.getAllByText(/^Mensaje \d+$/)).toHaveLength(15);
    expect(screen.getByText('No hay más notificaciones')).toBeInTheDocument();
  });

  it('si falla la siguiente tanda ofrece Reintentar', async () => {
    let falla = true;
    vi.spyOn(api, 'listarHistorialNotificaciones').mockImplementation(async (f) => {
      if (!f?.cursor) return pagina(1, 10, 12);
      if (falla) throw new Error('red');
      return pagina(11, 2, 12);
    });
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Mensaje 10')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    falla = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Mensaje 12')).toBeInTheDocument());
  });

  it('Marcar todas leídas pone el contador de sin leer en 0', async () => {
    vi.spyOn(api, 'listarHistorialNotificaciones')
      .mockResolvedValueOnce(pagina(1, 10, 15))
      .mockResolvedValue({
        ...pagina(1, 10, 15),
        items: pagina(1, 10, 15).items.map((i) => ({ ...i, leida: true })),
        metricas: { ...pagina(1, 10, 15).metricas, sinLeerHistorial: 0 },
      });
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Mensaje 10')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, marcar todas' }));
    await waitFor(() => expect(api.marcarTodasNotificacionesLeidas).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryAllByText('Nueva')).toHaveLength(0));
    expect(screen.getByText('Sin leer en el historial').nextElementSibling).toHaveTextContent('0');
  });

  it('la campanita pinta 10 y suma otros 10 al llegar al final de la lista', () => {
    const avisos = Array.from({ length: 25 }, (_, i) => ({
      id: `a${i}`,
      clave: `n:${i}`,
      titulo: `Pedido ${i}`,
      detalle: '',
      prioridad: 'MEDIA' as const,
      desde: null,
      modulo: 'caja',
      accion: 'Ir a Caja',
      leida: false,
      leidaEn: null,
    }));
    render(
      <MemoryRouter>
        <CampanaNotificaciones
          notificaciones={avisos}
          sonidoSoportado={false}
          sonidoBloqueado={false}
          onMarcar={async () => true}
          onMarcarTodas={async () => {}}
          onActivarSonido={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Notificaciones: 25 sin leer/ }));
    expect(screen.getAllByText(/^Pedido \d+$/)).toHaveLength(10);
    act(() => disparar(true));
    expect(screen.getAllByText(/^Pedido \d+$/)).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(screen.getAllByText(/^Pedido \d+$/)).toHaveLength(25);
    expect(screen.getByText('No hay más notificaciones')).toBeInTheDocument();
  });
});
