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
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn(),
}));

const cartaConCafe = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café tostado', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};
const pisoConMesa = [
  {
    id: '1',
    nombre: 'Piso 1',
    activo: true,
    mesas: [
      { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
    ],
  },
];

/** Agrega un café al pedido de mesa (la mesa 1 viene preseleccionada) */
async function agregarCafe() {
  fireEvent.click(await screen.findByText('Café Americano'));
  // Las bebidas piden el nombre de quien la toma (ventana del producto), no el del cliente de la mesa
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Mario' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
}

const botonEnviar = () => screen.getByRole('button', { name: 'Enviar directo a cocina' }) as HTMLButtonElement;

describe('Pedido de mesa: nombre obligatorio y teléfono opcional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaConCafe as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('sin nombre el botón de enviar a cocina queda deshabilitado; con un nombre de 2+ letras se habilita', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();

    expect(botonEnviar().disabled).toBe(true);
    const nombre = screen.getByLabelText('Nombre del cliente *');
    fireEvent.change(nombre, { target: { value: 'L' } });
    expect(botonEnviar().disabled).toBe(true);
    fireEvent.change(nombre, { target: { value: 'Lucía' } });
    expect(botonEnviar().disabled).toBe(false);
  });

  it('envía el nombre sin teléfono cuando el teléfono está vacío (no se manda relleno)', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });
    expect(screen.getByText('Si lo escribes le enviamos una encuesta por WhatsApp al terminar')).toBeInTheDocument();

    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.cliente).toEqual({ nombre: 'Lucía', telefono: undefined });
  });

  it('un teléfono inválido bloquea el envío; uno de 9 dígitos que empieza en 9 se envía', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });

    const tel = screen.getByLabelText('Teléfono (opcional)');
    fireEvent.change(tel, { target: { value: '12345' } });
    expect(screen.getByText('El teléfono debe tener 9 dígitos y empezar con 9')).toBeInTheDocument();
    expect(botonEnviar().disabled).toBe(true);

    fireEvent.change(tel, { target: { value: '987654321' } });
    expect(botonEnviar().disabled).toBe(false);
    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.cliente).toEqual({ nombre: 'Lucía', telefono: '987654321' });
  });

  it('con cliente de cuenta no pide nombre ni teléfono: el nombre sale de la cuenta', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));

    // Sin cuenta elegida aún no se puede enviar
    expect(botonEnviar().disabled).toBe(true);

    vi.mocked(api.get).mockResolvedValue({ items: [{ id: 77, nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }] } as any);
    const input = screen.getByPlaceholderText('Nombre o celular del cliente');
    fireEvent.change(input, { target: { value: 'Ana' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));

    expect(screen.queryByLabelText('Nombre del cliente *')).toBeNull();
    expect(screen.queryByLabelText('Teléfono (opcional)')).toBeNull();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(botonEnviar().disabled).toBe(false);

    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.clientePartyId).toBe('77');
    expect(payload.cliente).toBeUndefined();
  });
});
