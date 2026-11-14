import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { continuarYEnviar } from './continuarYEnviar';
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

const cartaVacia = { categorias: [] };

/** Abre el modal en «Para llevar» y abre el panel «¿Quién pide?» desde el carrito. */
async function abrirQuienPide() {
  render(
    <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
}

/** Llamadas de búsqueda de clientes (el modal hace otras llamadas a api.get) */
function llamadasClientes() {
  return vi.mocked(api.get).mock.calls.filter((c) => String(c[0]).startsWith('/admin/clientes') && !String(c[0]).includes('/por-telefono/'));
}

/** Deja correr las promesas pendientes dentro de act */
async function vaciarPromesas() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('¿Quién pide?: buscador de cliente y de personal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaVacia as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cliente con cuenta', () => {
    it('escribir dispara la búsqueda con debounce de 300 ms desde 2 caracteres y muestra resultados', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.mocked(api.get).mockResolvedValue({
        items: [{ nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }],
      } as any);

      vi.useFakeTimers();
      const input = screen.getByPlaceholderText('Nombre o celular del cliente');
      expect(document.activeElement).toBe(input);

      fireEvent.change(input, { target: { value: '4' } });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(llamadasClientes()).toHaveLength(0);

      fireEvent.change(input, { target: { value: '45' } });
      await act(async () => {
        vi.advanceTimersByTime(299);
      });
      expect(llamadasClientes()).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      await vaciarPromesas();
      expect(llamadasClientes()).toHaveLength(1);
      expect(api.get).toHaveBeenCalledWith('/admin/clientes?q=45');
      expect(screen.getByRole('button', { name: /Ana Pérez/ })).toBeInTheDocument();
      expect(screen.getByText('987654321 · 12 pts')).toBeInTheDocument();
    });

    it('Enter fuerza la búsqueda sin esperar el debounce', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.useFakeTimers();

      const input = screen.getByPlaceholderText('Nombre o celular del cliente');
      fireEvent.change(input, { target: { value: 'Ana' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await act(async () => {
        vi.advanceTimersByTime(0);
      });
      await vaciarPromesas();
      expect(api.get).toHaveBeenCalledWith('/admin/clientes?q=Ana');
    });

    it('solo vale la última respuesta: una respuesta vieja que llega tarde no pisa la nueva', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.useFakeTimers();

      let resolverViejo: (v: any) => void = () => {};
      vi.mocked(api.get)
        .mockImplementationOnce(() => new Promise((r) => (resolverViejo = r)) as any)
        .mockResolvedValueOnce({ items: [{ nombre: 'Luis Quispe', telefono: '912345678', puntos: 3 }] } as any);

      const input = screen.getByPlaceholderText('Nombre o celular del cliente');
      fireEvent.change(input, { target: { value: 'ana' } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      fireEvent.change(input, { target: { value: 'luis' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await act(async () => {
        vi.advanceTimersByTime(0);
      });
      await vaciarPromesas();
      expect(screen.getByRole('button', { name: /Luis Quispe/ })).toBeInTheDocument();

      // Llega la respuesta vieja: no debe aparecer
      await act(async () => {
        resolverViejo({ items: [{ nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }] });
      });
      await vaciarPromesas();
      expect(screen.queryByRole('button', { name: /Ana Pérez/ })).toBeNull();
      expect(screen.getByRole('button', { name: /Luis Quispe/ })).toBeInTheDocument();
    });

    it('elegir un resultado fija el cliente en el resumen y cierra el panel', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.mocked(api.get).mockResolvedValue({
        items: [{ nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }],
      } as any);

      fireEvent.change(screen.getByPlaceholderText('Nombre o celular del cliente'), {
        target: { value: 'Ana' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('Nombre o celular del cliente'), { key: 'Enter' });
      fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));

      expect(screen.getByText('Cliente: Ana Pérez (12 pts)')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Nombre o celular del cliente')).toBeNull();
    });

    it('sin resultados muestra el mensaje y no deja elegir nada', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.mocked(api.get).mockResolvedValue({ items: [] } as any);

      fireEvent.change(screen.getByPlaceholderText('Nombre o celular del cliente'), {
        target: { value: '99999999' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

      expect(await screen.findByText('No hay cuenta con ese nombre o celular.')).toBeInTheDocument();
    });

    it('si la búsqueda falla muestra un error discreto', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
      vi.mocked(api.get).mockRejectedValue(new Error('red'));

      fireEvent.change(screen.getByPlaceholderText('Nombre o celular del cliente'), {
        target: { value: 'Ana' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

      expect(await screen.findByText('No se pudo buscar. Intenta de nuevo.')).toBeInTheDocument();
      expect(screen.queryByText('No hay cuenta con ese nombre o celular.')).toBeNull();
    });
  });

  describe('Personal', () => {
    beforeEach(() => {
      vi.mocked(listarPersonalActivo).mockResolvedValue([
        { partyId: '1', nombre: 'Luis Quispe', rol: 'COCINA', descuentoPct: 25 },
        { partyId: '2', nombre: 'María Soto', rol: 'MOZO', descuentoPct: 25 },
      ]);
    });

    it('enfoca el buscador al abrir Personal y muestra el contador', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

      const input = screen.getByPlaceholderText('Buscar por usuario o nombre');
      expect(document.activeElement).toBe(input);
      expect(await screen.findByText('2 resultados')).toBeInTheDocument();
    });

    it('filtra, resalta la coincidencia y muestra «Sin resultados» cuando no hay', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
      await screen.findByText('2 resultados');

      const input = screen.getByPlaceholderText('Buscar por usuario o nombre');
      fireEvent.change(input, { target: { value: 'quis' } });
      expect(screen.getByText('1 resultado')).toBeInTheDocument();
      expect(screen.getByText('Quis').tagName).toBe('MARK');
      expect(screen.queryByText('Sin resultados')).toBeNull();

      fireEvent.change(input, { target: { value: 'zzz' } });
      expect(screen.getByText('0 resultados')).toBeInTheDocument();
      expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    });

    it('elegir una persona con un toque la fija en el resumen', async () => {
      await abrirQuienPide();
      fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
      fireEvent.click(await screen.findByRole('button', { name: /María Soto/ }));

      expect(
        screen.getByText('María Soto (personal · con descuento)'),
      ).toBeInTheDocument();
    });
  });
});

describe('¿Quién pide? con cliente de cuenta en el pedido enviado', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaConCafe as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
  });

  it('pedido de mesa con el cliente elegido en ¿Quién pide? envía clientePartyId con el id de su cuenta', async () => {
    render(
      <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />,
    );
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cliente con cuenta (celular)' }));
    vi.mocked(api.get).mockResolvedValue({
      items: [{ id: 77, nombre: 'Ana Pérez', telefono: '987654321', puntos: 12 }],
    } as any);
    const input = screen.getByPlaceholderText('Nombre o celular del cliente');
    fireEvent.change(input, { target: { value: 'Ana' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
    expect(screen.getByText('Cliente: Ana Pérez (12 pts)')).toBeInTheDocument();

    elegirBoleta();

    continuarYEnviar();
    expect(screen.getByText(/Pide Ana Pérez: el pedido suma sus puntos al cobrar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.clientePartyId).toBe('77');
  });

  it('pedido de mesa sin cliente elegido no envía clientePartyId', async () => {
    render(
      <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisoConMesa} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />,
    );
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía Pérez' } });
    fireEvent.change(screen.getByLabelText('Celular del cliente (opcional)'), { target: { value: '987654321' } });
    elegirBoleta();
    continuarYEnviar();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1));
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.clientePartyId).toBeUndefined();
  });
});

