import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return {
    ...real,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const estado: EstadoLocalCarta = {
  abierta: true,
  motivo: 'OK',
  texto: 'Abierto',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: 25,
  altaDemandaMin: 0,
};

/** Carrito de S/ 14.50 (un Frappé) con el mínimo de delivery que se pase. */
const datosCon = (pedidoMinimo: number | null): DatosLocalCarta => ({
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } },
  envioGratisDesde: 70,
  envioGratisModo: 'mas_de',
  pedidoMinimo,
  invitadoPermitido: true,
});

function Pagina({ pedidoMinimo }: { pedidoMinimo: number | null }) {
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
        Abrir pedido
      </button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datosCon(pedidoMinimo)} />
    </div>
  );
}

function abrirPedido(pedidoMinimo: number | null) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <Pagina pedidoMinimo={pedidoMinimo} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
}

const pedidosEnviados = () => vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/pedidos');

describe('Checkout ▸ pedido mínimo solo para delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockImplementation(async () => {
      throw new ErrorApi('ERROR_PRUEBA', 'error de prueba', 400);
    });
  });

  it('delivery bajo el mínimo: muestra cuánto falta y no deja avanzar a pagar', async () => {
    abrirPedido(30);

    // Subtotal 14.50 con mínimo 30: faltan 15.50
    expect(screen.getAllByText('Pedido mínimo de delivery S/ 30.00. Te faltan S/ 15.50').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Seguir agregando productos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Te faltan S/ 15.50');
    expect(screen.queryByRole('button', { name: /Enviar pedido/i })).not.toBeInTheDocument();
    expect(pedidosEnviados()).toHaveLength(0);
  });

  it('delivery bajo el mínimo: «Cambiar a Recoger» quita el aviso y deja enviar sin mínimo', async () => {
    abrirPedido(30);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a Recoger' }));
    expect(screen.queryByText(/Pedido mínimo de delivery/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar pedido/i }));

    await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
    expect((pedidosEnviados()[0][1] as any).modalidad).toBe('RECOGER');
  });

  it('recoger bajo el mínimo: no muestra el aviso', () => {
    abrirPedido(30);
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    expect(screen.queryByText(/Pedido mínimo de delivery/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
  });

  it('sin pedido_minimo configurado no hay aviso ni bloqueo en delivery', async () => {
    abrirPedido(null);

    expect(screen.queryByText(/Pedido mínimo de delivery/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
  });

  it('si el servidor responde PEDIDO_MINIMO, muestra su mensaje tal cual y vuelve a los datos de entrega', async () => {
    abrirPedido(null);
    vi.mocked(api.post).mockImplementation(async () => {
      throw new ErrorApi(
        'PEDIDO_MINIMO',
        'El pedido mínimo para delivery es S/ 30.00; te faltan S/ 15.50',
        400,
      );
    });

    // Delivery con dirección escrita (sin mínimo local, el servidor es quien decide)
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
    fireEvent.change(document.getElementById('f-direccion') as HTMLInputElement, {
      target: { value: 'Av. Los Olivos 123' },
    });
    fireEvent.change(document.getElementById('f-referencia') as HTMLInputElement, { target: { value: 'Frente al parque' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar pedido/i }));

    expect(await screen.findByText('El pedido mínimo para delivery es S/ 30.00; te faltan S/ 15.50')).toBeInTheDocument();
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  });
});
