import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

// Los casos de la lista parten de la pestaña Lista (la inicial es Salón)
beforeEach(() => {
  localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
});

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
        { id: '1', nombre: 'Café', cantidad: 2, tamano: 'Grande', opciones: ['Oreo', 'Crema'], nota: 'Sin azúcar', precioUnit: 5, subtotal: 10, lista: true },
        { id: '2', nombre: 'Torta', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 14.5, subtotal: 14.5, lista: false },
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
      lineas: [{ id: '3', nombre: 'Limonada', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 8, subtotal: 8, lista: false }],
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
    // La lista de productos se ve sin abrir la tarjeta
    const lista = screen.getByRole('list', { name: 'Productos del pedido CP-M012' });
    expect(within(lista).getByText('2×')).toBeInTheDocument();
    expect(within(lista).getByText('Torta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument();
    expect(salonApi.misPedidos).toHaveBeenCalledWith('hoy');
  });

  it('el filtro por estado deja solo los entregados o los en curso', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Entregados' }));
    expect(screen.getByRole('button', { name: 'Estado: Entregados' })).toBeInTheDocument();
    expect(screen.getByText('CP-M012')).toBeInTheDocument();
    expect(screen.queryByText('CP-M011')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Estado: Entregados' }));
    fireEvent.click(screen.getByRole('option', { name: 'En curso' }));
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

  it('la lista muestra tamaño, opciones, nota, subtotal y Listo sin abrir la tarjeta', async () => {
    render(<MisPedidosView />);
    const tarjeta = (await screen.findByText('CP-M012')).closest('li')!;
    const lista = within(tarjeta).getByRole('list', { name: 'Productos del pedido CP-M012' });
    const cafe = within(lista).getAllByRole('listitem')[0];

    expect(within(cafe).getByText('Café')).toBeInTheDocument();
    expect(within(cafe).getByText('Grande · Oreo, Crema')).toBeInTheDocument();
    expect(within(cafe).getByText('Nota: Sin azúcar')).toBeInTheDocument();
    expect(within(cafe).getByText('S/ 10.00')).toBeInTheDocument();
    expect(within(cafe).getByText('✓ Listo')).toBeInTheDocument();

    const torta = within(lista).getAllByRole('listitem')[1];
    expect(within(torta).queryByText('✓ Listo')).not.toBeInTheDocument();
    expect(within(torta).getByText('S/ 14.50')).toBeInTheDocument();
  });

  it('al abrir el detalle solo aparecen pago, progreso e historial; los productos no se repiten', async () => {
    render(<MisPedidosView />);
    const tarjeta = (await screen.findByText('CP-M012')).closest('li')!;
    const boton = within(tarjeta).getByRole('button', { name: 'Ver detalle' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(boton);

    expect(within(tarjeta).getByRole('button', { name: 'Ocultar detalle' })).toHaveAttribute('aria-expanded', 'true');
    const detalle = document.getElementById(boton.getAttribute('aria-controls')!)!;
    expect(within(detalle).getByText('Pagado')).toBeInTheDocument();
    expect(within(detalle).queryByRole('list')).not.toBeInTheDocument();
    expect(within(detalle).queryByText('Café')).not.toBeInTheDocument();
    // Los productos siguen en la lista de la tarjeta, una sola vez
    expect(within(tarjeta).getAllByRole('list', { name: 'Productos del pedido CP-M012' })).toHaveLength(1);
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

    fireEvent.click(screen.getByRole('button', { name: 'Periodo: Hoy' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ayer' }));

    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith('ayer'));
  });
});
