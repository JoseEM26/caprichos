import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { api } from '../../../comun/api';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn(async () => []),
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

const pedidoCreado = { id: 'ped-9', codigo: 'CP-W009', estado: 'COLA', total: 8.5 };

const cuentaAna = {
  encontrado: true,
  party: '100',
  nombre: 'Ana Pérez',
  telefono: '987654321',
  puntos: 12.5,
  direcciones: [
    {
      id: '7',
      direccion: 'Av. Las Palmeras 123',
      referencia: 'Portón azul',
      lat: -12.046374,
      lng: -77.042793,
      alias: null,
      usos: 3,
      ultimoUsoEn: '2026-10-20T15:04:00.000Z',
      origen: 'CARTA',
    },
    {
      id: '8',
      direccion: 'Jr. Lima 500',
      referencia: null,
      lat: null,
      lng: null,
      alias: null,
      usos: 1,
      ultimoUsoEn: '2026-09-02T10:00:00.000Z',
      origen: 'MOZO',
    },
  ],
};

/** Respuesta de GET /admin/clientes/por-telefono/:telefono que devolverá el mock en cada prueba */
let respuestaCuenta: any = { encontrado: false };

/** Abre el alta, elige modalidad y deja el paso de datos del cliente listo */
function abrirPaso(modalidad: 'Para llevar' | 'Delivery') {
  render(
    <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />,
  );
  fireEvent.click(screen.getByRole('button', { name: new RegExp(modalidad) }));
}

/** Escribe el celular y espera la respuesta de la consulta */
async function escribirCelular(cel: string) {
  fireEvent.change(screen.getByLabelText(/Celular del cliente/), { target: { value: cel } });
}

/** Lleva el pedido desde los datos del cliente hasta registrarlo (un café) */
async function registrarCafe() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), {
    target: { value: 'Ana' },
  });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  // En delivery con efectivo «con cuánto paga» es obligatorio (el repartidor sale con el vuelto)
  const pagaCon = await screen.findByPlaceholderText(/Mínimo S\/|Obligatorio/).catch(() => null);
  if (pagaCon) fireEvent.change(pagaCon, { target: { value: '50' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Registrar pedido' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
  await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
  return vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any;
}

describe('ModalNuevoPedidoMesa: cliente con cuenta por celular en delivery y para llevar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    respuestaCuenta = { encontrado: false };
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue(pedidoCreado as any);
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/admin/clientes/por-telefono/')) {
        if (respuestaCuenta instanceof Error) throw respuestaCuenta;
        return respuestaCuenta;
      }
      if (ruta.startsWith('/carta/envio')) {
        return { cubierto: true, zona: 'Zona 1', tarifa: 5, gratisDesde: 70 };
      }
      return { items: [] };
    });
  });

  it('Celular encontrado rellena nombre y teléfono desde la cuenta y oculta esos campos', async () => {
    respuestaCuenta = cuentaAna;
    abrirPaso('Para llevar');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');

    const tarjeta = await screen.findByRole('status');
    expect(within(tarjeta).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(tarjeta).queryByText(/DNI/)).toBeNull();
    expect(within(tarjeta).getByText('Celular: 987654321')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Puntos: 12.50')).toBeInTheDocument();

    expect(screen.queryByPlaceholderText('Ej.: María López')).toBeNull();
    expect(screen.queryByPlaceholderText('9 dígitos')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar a productos →' })).toBeEnabled();
    expect(api.get).toHaveBeenCalledWith('/admin/clientes/por-telefono/987654321');
  });

  it('Celular sin cuenta muestra el aviso y ofrece seguir como invitado', async () => {
    respuestaCuenta = { encontrado: false };
    abrirPaso('Para llevar');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('955512345');

    expect(await screen.findByText('No hay cuenta con ese celular.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar a productos →' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Seguir como invitado' }));

    expect(screen.getByPlaceholderText('Ej.: María López')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('9 dígitos')).toBeInTheDocument();
  });

  it('error 429 muestra un mensaje claro de demasiadas búsquedas', async () => {
    respuestaCuenta = Object.assign(new Error('x'), { statusCode: 429, codigo: 'DEMASIADAS_BUSQUEDAS' });
    abrirPaso('Para llevar');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiadas búsquedas seguidas');
  });

  it('delivery con cuenta muestra las direcciones anteriores y elegir una rellena la dirección', async () => {
    respuestaCuenta = cuentaAna;
    abrirPaso('Delivery');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');
    await screen.findByRole('status');

    expect(
      screen.getByText('¿Usar una ubicación anterior?'),
    ).toBeInTheDocument();
    // El formulario de dirección nueva no aparece mientras elige una anterior
    expect(screen.queryByPlaceholderText('Jr. / Av. / Calle y número')).toBeNull();
    expect(screen.getByRole('button', { name: /Dirección nueva/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Av\. Las Palmeras 123/ }));

    expect(screen.getByRole('button', { name: /Av\. Las Palmeras 123/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Continuar a productos →' })).toBeEnabled();
    // Mini mapa en la lista y, al elegir, el pin queda en el mapa del pedido sin mostrar coordenadas
    expect(screen.getAllByTestId('mini-mapa-direccion').length).toBeGreaterThan(0);
    expect(document.querySelector('.leaflet-marker-icon')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/-12\.046|-77\.042/);

    const pedido = await registrarCafe();
    expect(pedido.modalidad).toBe('DELIVERY');
    expect(pedido.entrega).toEqual(
      expect.objectContaining({
        direccion: 'Av. Las Palmeras 123',
        referencia: 'Portón azul',
        lat: -12.046374,
        lng: -77.042793,
      }),
    );
  });

  it('delivery con cuenta sin direcciones guardadas va directo a la dirección nueva', async () => {
    respuestaCuenta = { ...cuentaAna, direcciones: [] };
    abrirPaso('Delivery');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');
    await screen.findByRole('status');

    expect(
      screen.queryByText('¿Usar una ubicación anterior?'),
    ).toBeNull();
    expect(screen.getByPlaceholderText('Jr. / Av. / Calle y número')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar a productos →' })).toBeDisabled();
  });

  it('invitado no envía clienteTelefono y pide nombre y teléfono', async () => {
    abrirPaso('Para llevar');

    fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });

    const pedido = await registrarCafe();
    expect(pedido.clienteTelefono).toBeUndefined();
    expect(pedido.cliente).toEqual({ nombre: 'Ana', telefono: '987654321' });
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/admin/clientes/por-telefono/'));
  });

  it('con cuenta envía clienteTelefono y los datos de la cuenta', async () => {
    respuestaCuenta = cuentaAna;
    abrirPaso('Para llevar');

    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');
    await screen.findByRole('status');

    const pedido = await registrarCafe();
    expect(pedido.clienteTelefono).toBe('987654321');
    expect(pedido.cliente).toEqual({ nombre: 'Ana Pérez', telefono: '987654321' });
    expect(pedido.modalidad).toBe('RECOGER');
  });

  it('con cuenta por celular en el paso de datos no se pisa con el cliente de ¿Quién pide?', async () => {
    respuestaCuenta = cuentaAna;
    abrirPaso('Para llevar');
    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    await escribirCelular('987654321');
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));

    vi.mocked(api.get).mockResolvedValue({ items: [{ id: 55, nombre: 'Luis Quispe', telefono: '912345678', puntos: 3 }] } as any);
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    const input = screen.getByPlaceholderText('Nombre o celular del cliente');
    fireEvent.change(input, { target: { value: 'Luis' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Luis Quispe/ }));

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    const pedido = vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any;
    expect(pedido.clienteTelefono).toBe('987654321');
    expect(pedido.clientePartyId).toBeUndefined();
  });
});
