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
    expect(salonApi.misPedidos).toHaveBeenCalledWith({ rango: 'hoy' });
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

  it('«Ver detalle» abre el modal por pasos con los productos y el pago', async () => {
    render(<MisPedidosView />);
    const tarjeta = (await screen.findByText('CP-M012')).closest('li')!;
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Ver detalle' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Pedido CP-M012' });
    expect(within(dialogo).getByRole('list', { name: 'Productos de CP-M012' })).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('tab', { name: /Cliente y pago/ }));
    expect(within(dialogo).getByText(/Pagado/)).toBeInTheDocument();
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pedido CP-M012' })).toBeNull());
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

    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith({ rango: 'ayer' }));
  });

  describe('lista de productos recortada', () => {
    const pedidoCon = (lineas: number) => ({
      ...respuesta.pedidos[0],
      id: '30',
      codigo: 'CP-M030',
      lineas: Array.from({ length: lineas }, (_, i) => ({
        id: `l${i}`,
        nombre: `Producto ${i + 1}`,
        cantidad: 1,
        tamano: null,
        opciones: [],
        nota: null,
        precioUnit: 1,
        subtotal: 1,
        lista: false,
      })),
    });

    it('con 7 productos muestra 5 y «Ver 2 más» expande y colapsa dentro de la tarjeta', async () => {
      vi.mocked(salonApi.misPedidos).mockResolvedValue({ pedidos: [pedidoCon(7)], resumen: respuesta.resumen } as any);
      render(<MisPedidosView />);
      const tarjeta = (await screen.findByText('CP-M030')).closest('li')!;
      const lista = within(tarjeta).getByRole('list', { name: 'Productos del pedido CP-M030' });
      expect(within(lista).getAllByRole('listitem')).toHaveLength(5);

      const boton = within(tarjeta).getByRole('button', { name: 'Ver 2 más' });
      expect(boton).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(boton);

      expect(within(lista).getAllByRole('listitem')).toHaveLength(7);
      expect(within(tarjeta).getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(within(tarjeta).getByRole('button', { name: 'Ver menos' }));
      expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
      expect(within(tarjeta).getByRole('button', { name: 'Ver 2 más' })).toBeInTheDocument();
    });

    it('con 6 productos o menos se ven todos y no aparece el botón', async () => {
      vi.mocked(salonApi.misPedidos).mockResolvedValue({ pedidos: [pedidoCon(6)], resumen: respuesta.resumen } as any);
      render(<MisPedidosView />);
      const tarjeta = (await screen.findByText('CP-M030')).closest('li')!;
      expect(within(tarjeta).getAllByRole('listitem')).toHaveLength(6);
      expect(within(tarjeta).queryByRole('button', { name: /Ver \d+ más|Ver menos/ })).not.toBeInTheDocument();
    });
  });
});
