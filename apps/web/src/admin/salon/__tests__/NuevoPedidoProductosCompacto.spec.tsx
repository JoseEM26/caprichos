import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn() },
}));

const cartaMock = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        {
          id: 'prod-1',
          nombre: 'Café Americano',
          descripcion: 'Café tostado',
          fotoUrl: null,
          precio: 8.5,
          tamanos: [],
          grupos: [],
          sabores: [],
          noSumaBeneficios: false,
          disponible: true,
          agotadoHasta: null,
        },
      ],
    },
  ],
};

const pisos = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
    ],
  },
] as any;

describe('ModalNuevoPedidoMesa: paso productos compacto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('el cupón va plegado y se despliega al tocar «Cupón»', async () => {
    render(
      <ModalNuevoPedidoMesa
        abierto={true}
        alCerrar={vi.fn()}
        pisos={pisos}
        mesasPreseleccionadasIds={['m1']}
      />,
    );

    expect(screen.queryByPlaceholderText('Código de cupón (opcional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cupón' }));
    expect(screen.getByPlaceholderText('Código de cupón (opcional)')).toBeInTheDocument();
  });

  it('el botón «Continuar» muestra el total del pedido', async () => {
    render(
      <ModalNuevoPedidoMesa
        abierto={true}
        alCerrar={vi.fn()}
        pisos={pisos}
        mesasPreseleccionadasIds={['m1']}
      />,
    );

    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByText('Agregar al pedido'));

    expect(await screen.findByRole('button', { name: 'Continuar' })).toHaveTextContent(
      'S/ 8.50',
    );
  });
});
