import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { listarPersonalActivo } from '../../creditos/creditosApi';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), obtenerMesas: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn(),
}));

const carta = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};

/** Dos mesas de 2 asientos cada una: 4 en total. */
const pisos = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 2, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
      { id: 'm2', pisoId: '1', tipo: 'MESA', numero: 2, nombre: 'Mesa 2', asientos: 2, x: 6, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
    ],
  },
];

/** Pedido en la mesa 1 con personas (y, si hace falta, confirmar la capacidad) y un café. */
async function pedirEnMesa1(personas: string) {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisos as any} canal="MOZO" />);
  fireEvent.change(screen.getByLabelText('Personas'), { target: { value: personas } });
  fireEvent.click(screen.getByTestId('elemento-plano-m1'));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Mario' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });
  fireEvent.change(screen.getByLabelText('Celular del cliente *'), { target: { value: '987654321' } });
  const boleta = screen.queryByTestId('comprobante-BOLETA');
  if (boleta && boleta.getAttribute('aria-pressed') !== 'true') fireEvent.click(boleta);
  fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
}

describe('Nuevo pedido en el local: personas y capacidad de las mesas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('con más personas que asientos avisa; si el local confirma, manda personas y confirmarCapacidad', async () => {
    await pedirEnMesa1('5');

    expect(await screen.findByText('¿Enviar con menos asientos que personas?')).toBeInTheDocument();
    expect(screen.getByText(/suman 2 asientos y son 5 personas: faltan 3/)).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar igual' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload).toMatchObject({ mesas: ['m1'], personas: 5, confirmarCapacidad: true });
  });

  it('si los asientos alcanzan, no avisa y manda personas sin confirmarCapacidad', async () => {
    await pedirEnMesa1('2');

    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.personas).toBe(2);
    expect(payload).not.toHaveProperty('confirmarCapacidad');
  });
});
