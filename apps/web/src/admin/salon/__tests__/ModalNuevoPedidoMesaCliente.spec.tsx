import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { listarPersonalActivo } from '../../creditos/creditosApi';

/** Elige boleta en el selector obligatorio (si el paso lo muestra y aún no hay elección). */
const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

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

const botonContinuar = () => screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;

/** Paso 1 → paso 2 y envío: elige boleta, «Enviar a cocina» y confirma la comanda. */
const enviarDesdePago = () => {
  fireEvent.click(botonContinuar());
  elegirBoleta();
  fireEvent.click(screen.getByRole('button', { name: /^Enviar a cocina/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));
};

describe('Pedido de mesa: nombre obligatorio y teléfono opcional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaConCafe as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('sin nombre, «Continuar» queda deshabilitado y dice qué falta; se habilita al completar nombre y celular', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();

    expect(botonContinuar().disabled).toBe(true);
    expect(screen.getByText('Escribe el nombre del cliente (mínimo 2 letras)')).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();

    const nombre = screen.getByLabelText('Nombre del cliente *');
    fireEvent.change(nombre, { target: { value: 'L' } });
    expect(screen.getByText('Escribe el nombre del cliente (mínimo 2 letras)')).toBeInTheDocument();
    fireEvent.change(nombre, { target: { value: 'Lucía' } });
    expect(screen.queryByText('Escribe el nombre del cliente (mínimo 2 letras)')).toBeNull();
    // Falta el celular
    expect(botonContinuar().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Celular del cliente *'), { target: { value: '987654321' } });
    expect(botonContinuar().disabled).toBe(false);

    enviarDesdePago();
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.cliente).toEqual({ nombre: 'Lucía', telefono: '987654321' });
  });

  it('sin celular no deja continuar con aviso claro, y 999999999 tampoco vale', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });

    expect(botonContinuar().disabled).toBe(true);
    expect(screen.getByText('Escribe el celular del cliente: 9 dígitos que empiecen con 9')).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Celular del cliente *'), { target: { value: '999999999' } });
    expect(botonContinuar().disabled).toBe(true);
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();
  });

  it('un teléfono inválido bloquea «Continuar»; uno de 9 dígitos que empieza en 9 se envía', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía' } });

    const tel = screen.getByLabelText('Celular del cliente *');
    fireEvent.change(tel, { target: { value: '12345' } });
    expect(screen.getAllByText('El teléfono debe tener 9 dígitos, empezar con 9 y ser un número real').length).toBeGreaterThan(0);
    expect(botonContinuar().disabled).toBe(true);

    fireEvent.change(tel, { target: { value: '987654321' } });
    expect(screen.queryByText('El teléfono debe tener 9 dígitos, empezar con 9 y ser un número real')).toBeNull();
    enviarDesdePago();

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.cliente).toEqual({ nombre: 'Lucía', telefono: '987654321' });
  });

  it('con cliente de cuenta no pide nombre ni teléfono: el nombre sale de la cuenta', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));

    // Sin cuenta elegida aún no se puede continuar
    expect(botonContinuar().disabled).toBe(true);
    expect(screen.getByText('Busca y elige la cuenta del cliente')).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();

    vi.mocked(api.get).mockResolvedValue({ items: [{ id: 77, nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }] } as any);
    const input = screen.getByPlaceholderText('Nombre o celular del cliente');
    fireEvent.change(input, { target: { value: 'Ana' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));

    expect(screen.queryByLabelText('Nombre del cliente *')).toBeNull();
    expect(screen.queryByLabelText('Celular del cliente *')).toBeNull();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(botonContinuar().disabled).toBe(false);

    enviarDesdePago();
    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.clientePartyId).toBe('77');
    expect(payload.cliente).toBeUndefined();
  });
});

describe('Pedido de mesa: celular primero con autocompletado del nombre', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaConCafe as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockImplementation(async (ruta: string) =>
      ruta.startsWith('/admin/clientes/por-telefono/')
        ? ({ encontrado: true, party: '1', nombre: 'Ana Pérez', telefono: '987654321', puntos: 0, direcciones: [] } as any)
        : ({ items: [] } as any),
    );
  });

  it('el celular va antes del nombre y al escribir 9 dígitos rellena el nombre (editable), con una sola búsqueda', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />);
    await agregarCafe();
    const tel = await screen.findByLabelText('Celular del cliente *');
    const nombre = screen.getByLabelText('Nombre del cliente *') as HTMLInputElement;
    expect(tel.compareDocumentPosition(nombre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(tel, { target: { value: '987654321' } });
    expect(await screen.findByText('Cliente registrado: Ana Pérez')).toBeInTheDocument();
    expect(nombre.value).toBe('Ana Pérez');
    fireEvent.change(nombre, { target: { value: 'Ana P.' } });
    expect(nombre.value).toBe('Ana P.');
    expect(vi.mocked(api.get).mock.calls.filter((c) => String(c[0]).includes('por-telefono'))).toHaveLength(1);
  });
});
