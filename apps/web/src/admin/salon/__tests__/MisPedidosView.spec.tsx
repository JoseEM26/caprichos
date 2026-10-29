import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: () => true }) }));
vi.mock('../api', () => ({
  salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() },
}));
vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({
  ModalNuevoPedidoMesa: (props: { abierto: boolean }) => (props.abierto ? 'Modal de nuevo pedido' : null),
}));

const respuesta = {
  pedidos: [
    {
      id: '12',
      codigo: 'CP-M012',
      estado: 'ENTREGADO',
      modalidad: 'MESA',
      mesaNombre: 'Mesa 3',
      total: 24.5,
      pagoEstado: 'PAGADO',
      creadoEn: '2026-10-29T15:10:00Z',
      lineas: [
        { nombre: 'Café', cantidad: 2 },
        { nombre: 'Torta', cantidad: 1 },
      ],
    },
    {
      id: '11',
      codigo: 'CP-M011',
      estado: 'PREPARANDO',
      modalidad: 'LLEVAR',
      mesaNombre: null,
      total: 8,
      pagoEstado: 'PENDIENTE',
      creadoEn: '2026-10-29T15:00:00Z',
      lineas: [{ nombre: 'Limonada', cantidad: 1 }],
    },
  ],
  resumen: { cantidad: 2, total: 32.5, enCurso: 1, entregados: 1 },
};

describe('MisPedidosView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('muestra el resumen, las tarjetas y el botón Nuevo pedido', async () => {
    render(<MisPedidosView />);

    expect(await screen.findByText('CP-M012')).toBeInTheDocument();
    const resumen = screen.getByLabelText('Resumen del rango elegido');
    expect(within(resumen).getByText('S/ 32.50')).toBeInTheDocument();
    expect(within(resumen).getByText('Total vendido')).toBeInTheDocument();
    expect(screen.getByText('CP-M011')).toBeInTheDocument();
    expect(screen.getByText('2 x Café, 1 x Torta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument();
    expect(salonApi.misPedidos).toHaveBeenCalledWith('hoy');
  });

  it('el filtro por estado deja solo los entregados o los en curso', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    fireEvent.click(screen.getByRole('button', { name: 'Entregados' }));
    expect(screen.getByText('CP-M012')).toBeInTheDocument();
    expect(screen.queryByText('CP-M011')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'En curso' }));
    expect(screen.getByText('CP-M011')).toBeInTheDocument();
    expect(screen.queryByText('CP-M012')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay pedidos en el rango', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [],
      resumen: { cantidad: 0, total: 0, enCurso: 0, entregados: 0 },
    });
    render(<MisPedidosView />);

    expect(await screen.findByText('Aún no tomaste pedidos en este rango')).toBeInTheDocument();
  });

  it('al tocar una tarjeta se expande el detalle de solo lectura', async () => {
    render(<MisPedidosView />);
    const tarjeta = (await screen.findByText('CP-M012')).closest('button')!;
    expect(tarjeta).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(tarjeta);

    expect(tarjeta).toHaveAttribute('aria-expanded', 'true');
    const detalle = document.getElementById(tarjeta.getAttribute('aria-controls')!)!;
    expect(within(detalle).getByText('2 x Café')).toBeInTheDocument();
    expect(within(detalle).getByText('1 x Torta')).toBeInTheDocument();
    expect(within(detalle).getByText('Pagado')).toBeInTheDocument();
  });

  it('error con Reintentar que vuelve a pedir los datos', async () => {
    vi.mocked(salonApi.misPedidos).mockRejectedValueOnce(new Error('sin red')).mockResolvedValue(respuesta as any);
    render(<MisPedidosView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus pedidos');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('CP-M012')).toBeInTheDocument();
    expect(salonApi.misPedidos).toHaveBeenCalledTimes(2);
  });

  it('cambiar el rango pide ese rango a la API', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));

    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith('ayer'));
  });
});
