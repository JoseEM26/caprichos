import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { CabeceraCarta } from '../carta/CabeceraCarta';
import { FormularioCheckout } from '../carta/FormularioCheckout';
import { PantallaConfirmacion } from '../carta/PantallaConfirmacion';
import { MisPedidos } from '../carta/MisPedidos';
import { EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import { guardarPedido, leerPedidosGuardados, PedidoGuardado, EstadoSeguimiento } from '../carta/seguimiento';
import { api, ErrorApi } from '../comun/api';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';

const estadoAbierto: EstadoLocalCarta = {
  abierta: true,
  motivo: 'OK',
  texto: 'Abierto',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: 25,
  altaDemandaMin: 0,
};

const datosLocal: DatosLocalCarta = {
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
} as unknown as DatosLocalCarta;

const pedidoGuardado = (codigo: string, extra: Partial<PedidoGuardado> = {}): PedidoGuardado => ({
  codigo,
  token: `tok-${codigo}`,
  modalidad: 'DELIVERY',
  nombre: 'Carlos',
  creadoEn: new Date().toISOString(),
  ...extra,
});

const estadoApi = (extra: Partial<EstadoSeguimiento> = {}): EstadoSeguimiento => ({
  codigo: 'PED-001',
  estado: 'EN_CAMINO',
  estadoEtiqueta: 'En camino',
  modalidad: 'DELIVERY',
  total: 29.5,
  terminado: false,
  anulado: false,
  pasos: [
    { clave: 'RECIBIDO', etiqueta: 'Pedido recibido', hecho: true, actual: false, hora: '2026-10-23T18:00:00Z' },
    { clave: 'COCINA', etiqueta: 'En preparación en cocina', hecho: true, actual: false, hora: null },
    { clave: 'CAMINO', etiqueta: 'En camino', hecho: false, actual: true, hora: null },
    { clave: 'ENTREGADO', etiqueta: 'Entregado', hecho: false, actual: false, hora: null },
  ],
  ...extra,
});

function renderCabecera() {
  return (
    <CarritoProvider>
      <CabeceraCarta
        busqueda=""
        onCambioBusqueda={() => {}}
        estadoLocal={estadoAbierto}
        datosLocal={datosLocal}
        pagina="carta"
        onPagina={() => {}}
        categorias={[]}
        categoriaActivaId="todo"
        onCategoria={() => {}}
      />
      <PantallaConfirmacion />
      <MisPedidos />
    </CarritoProvider>
  );
}

// Abre «Mi pedido» / «Mis pedidos» y después el detalle de uno de la lista
async function abrirPedido(codigo: string) {
  fireEvent.click(screen.getByRole('button', { name: /^Mis? pedidos?$/ }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^#${codigo}(?!\\d)`) }));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
    cliente: null,
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
    ingresar: vi.fn(),
    registrar: vi.fn(),
    salir: vi.fn(),
    refrescar: vi.fn(),
  } as unknown as ReturnType<typeof cuentaModulo.useCuenta>);
  // Por defecto, cada pedido consultado en lote responde con el estado de la API de prueba
  vi.spyOn(api, 'post').mockImplementation(async (_ruta: string, cuerpo: any) => ({
    resultados: cuerpo.pedidos.map((p: { codigo: string }) => estadoApi({ codigo: p.codigo })),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('seguimiento del pedido en la carta', () => {
  it('guarda el pedido con su token al confirmarlo', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      id: '123',
      codigo: 'PED-777',
      estado: 'PENDIENTE',
      subtotal: 14.5,
      envio: null,
      total: 14.5,
      mensaje: 'Un asesor te escribirá para coordinar el pago',
      seguimientoToken: 'token-secreto-777',
    });

    function Wrapper() {
      const { agregarLinea, abrirCheckout } = useCarrito();
      return (
        <div>
          <button
            onClick={() => {
              agregarLinea({
                productoId: 'prod-1',
                nombre: 'Frappé Clásico',
                precioBase: 14.5,
                cantidad: 1,
                opciones: [],
                precioUnitario: 14.5,
                subtotal: 14.5,
              });
              abrirCheckout();
            }}
          >
            Preparar pedido
          </button>
          <FormularioCheckout estadoLocal={estadoAbierto} datosLocal={datosLocal} />
        </div>
      );
    }

    render(
      <CarritoProvider>
        <Wrapper />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Preparar pedido'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Carlos Mendoza' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '987654321' } });
    fireEvent.click(screen.getByText('Recoger en el local'));
    // Avanzar de paso 1 a 2
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    // Avanzar de paso 2 a 3
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));

    await waitFor(() => {
      expect(leerPedidosGuardados()).toEqual([
        expect.objectContaining({
          codigo: 'PED-777',
          token: 'token-secreto-777',
          modalidad: 'RECOGER',
          nombre: 'Carlos Mendoza',
        }),
      ]);
    });
  });

  it('recupera los pedidos guardados al recargar y abre su detalle desde «Mi pedido»', async () => {
    guardarPedido(pedidoGuardado('PED-001'));
    vi.spyOn(api, 'get').mockResolvedValue(estadoApi());

    render(renderCabecera());

    await abrirPedido('PED-001');

    expect(await screen.findByText('Pedido #PED-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mis pedidos/ })).toBeInTheDocument();
  });

  it('quita el pedido de la lista cuando la API responde 404', async () => {
    guardarPedido(pedidoGuardado('PED-404'));
    vi.spyOn(api, 'get').mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'no', 404));

    render(renderCabecera());
    await abrirPedido('PED-404');

    expect(await screen.findByText(/No encontramos este pedido/)).toBeInTheDocument();
    expect(leerPedidosGuardados()).toEqual([]);
  });

  it('el botón «Mi pedido» aparece solo si hay pedidos guardados', () => {
    render(renderCabecera());
    expect(screen.queryByRole('button', { name: /Mi pedido/i })).not.toBeInTheDocument();

    act(() => guardarPedido(pedidoGuardado('PED-010')));
    expect(screen.getByRole('button', { name: /Mi pedido/i })).toBeInTheDocument();

    // Otra pestaña borra los pedidos: el navegador avisa con el evento storage
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new Event('storage'));
    });
    expect(screen.queryByRole('button', { name: /Mi pedido/i })).not.toBeInTheDocument();
  });

  it('la pantalla muestra los pasos reales de la API con su hora', async () => {
    guardarPedido(pedidoGuardado('PED-001'));
    vi.spyOn(api, 'get').mockResolvedValue(estadoApi());

    render(renderCabecera());
    await abrirPedido('PED-001');

    expect(await screen.findByText('En preparación en cocina')).toBeInTheDocument();
    expect(screen.getAllByText('En camino').length).toBeGreaterThan(0);
    expect(screen.getByText('Entregado')).toBeInTheDocument();
    expect(screen.getByText('S/ 29.50')).toBeInTheDocument();
  });

  it('un pedido anulado muestra «Tu pedido fue anulado» y no muestra pasos', async () => {
    guardarPedido(pedidoGuardado('PED-001'));
    vi.spyOn(api, 'get').mockResolvedValue(
      estadoApi({
        estado: 'ANULADO',
        estadoEtiqueta: 'Anulado',
        terminado: true,
        anulado: true,
        pasos: [
          { clave: 'RECIBIDO', etiqueta: 'Pedido recibido', hecho: false, actual: false, hora: null },
          { clave: 'ENTREGADO', etiqueta: 'Entregado', hecho: false, actual: false, hora: null },
        ],
      }),
    );

    render(renderCabecera());
    await abrirPedido('PED-001');

    expect(await screen.findByText('Tu pedido fue anulado')).toBeInTheDocument();
    expect(screen.queryByText('Entregado')).not.toBeInTheDocument();
  });

  it('un pedido terminado se conserva en el navegador aunque pasen más de 3 horas', async () => {
    const hace4Horas = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    guardarPedido(pedidoGuardado('PED-VIEJO', { creadoEn: hace4Horas }));
    vi.spyOn(api, 'post').mockResolvedValue({
      resultados: [estadoApi({ codigo: 'PED-VIEJO', terminado: true, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado' })],
    });

    render(renderCabecera());
    fireEvent.click(screen.getByRole('button', { name: /Mi pedido/i }));

    await waitFor(() => expect(leerPedidosGuardados()[0]?.terminado).toBe(true));
    expect(leerPedidosGuardados()).toHaveLength(1);
  });

  it('con varios pedidos, la lista muestra el estado de cada uno', async () => {
    guardarPedido(pedidoGuardado('PED-001'));
    guardarPedido(pedidoGuardado('PED-002'));
    vi.spyOn(api, 'post').mockResolvedValue({
      resultados: [
        estadoApi({ codigo: 'PED-001' }),
        estadoApi({ codigo: 'PED-002', estadoEtiqueta: 'Listo para recoger' }),
      ],
    });

    render(renderCabecera());
    fireEvent.click(screen.getByRole('button', { name: /Mis pedidos/i }));

    expect(await screen.findByText('Listo para recoger')).toBeInTheDocument();
    expect(screen.getByText('En camino')).toBeInTheDocument();
  });

  it('si localStorage lanza error, la carta no se rompe y no muestra «Mi pedido»', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denegado');
    });

    expect(() => guardarPedido(pedidoGuardado('PED-001'))).not.toThrow();
    expect(leerPedidosGuardados()).toEqual([]);

    render(renderCabecera());
    expect(screen.queryByRole('button', { name: /Mi pedido/i })).not.toBeInTheDocument();
  });
});
