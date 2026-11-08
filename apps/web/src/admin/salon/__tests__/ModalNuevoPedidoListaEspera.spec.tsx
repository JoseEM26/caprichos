import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

/** Dos mesas, las dos ocupadas: no queda dónde sentar al cliente. */
const pisos = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 2, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA' as const },
      { id: 'm2', pisoId: '1', tipo: 'MESA', numero: 2, nombre: 'Mesa 2', asientos: 2, x: 6, y: 5, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA' as const },
    ],
  },
];


async function pedirEnEspera() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisos as any} canal="MOZO" />);
  fireEvent.change(screen.getByLabelText('Personas'), { target: { value: '3' } });
  fireEvent.click(screen.getByTestId('np-lista-espera'));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Mario' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
}

describe('Nuevo pedido en el local: lista de espera de mesa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos } as any);
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('«Dejar en lista de espera» está siempre visible, también con mesas libres', () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisos as any} canal="MOZO" />);
    expect(screen.getByRole('button', { name: 'Dejar en lista de espera' })).toHaveTextContent('No queda mesa libre');
    cleanup();
    const libres = [{ ...pisos[0], mesas: [{ ...pisos[0].mesas[0], estado: 'LIBRE' }, pisos[0].mesas[1]] }];
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={libres as any} canal="MOZO" />);
    expect(screen.getByRole('button', { name: 'Dejar en lista de espera' })).toHaveTextContent('Dejar en lista de espera (sin mesa todavía)');
  });

  it('desde Caja, «¿Qué vas a hacer?» ofrece Elegir mesa ahora y Lista de espera, sin importar las mesas', async () => {
    const libres = [{ ...pisos[0], mesas: [{ ...pisos[0].mesas[0], estado: 'LIBRE' }, pisos[0].mesas[1]] }];
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={libres as any} canal="CAJA" pasoInicial="modal" />);
    expect(screen.getByText('Elegir mesa ahora')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('np-eleccion-lista-espera'));
    expect(await screen.findByText('Café Americano')).toBeInTheDocument();
  });

  it('sin celular no envía y avisa que el celular es obligatorio', async () => {
    await pedirEnEspera();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
    expect(await screen.findByText(/Escribe el celular del cliente/)).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();
  });

  it('con nombre y celular manda enEsperaMesa sin mesas', async () => {
    await pedirEnEspera();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });
    fireEvent.change(screen.getByLabelText('Celular del cliente *'), { target: { value: '987654321' } });
    const boleta = screen.queryByTestId('comprobante-BOLETA');
    if (boleta && boleta.getAttribute('aria-pressed') !== 'true') fireEvent.click(boleta);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar comanda' }));
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalled());
    const payload = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0][0] as any;
    expect(payload.enEsperaMesa).toBe(true);
    expect(payload.mesas).toEqual([]);
    expect(payload.personas).toBe(3);
    expect(payload.cliente).toEqual({ nombre: 'Lucía', telefono: '987654321' });
  });
});
