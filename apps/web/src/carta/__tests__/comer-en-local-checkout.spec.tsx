import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { alEnvio } from './medioPago';

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

describe('Checkout ▸ Comer en el local', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockImplementation(async () => {
      throw new ErrorApi('ERROR_PRUEBA', 'error de prueba', 400);
    });
  });

  it('la opción aparece junto a Delivery y Recoger; al elegirla llama por el nombre y no pide dirección', async () => {
    abrirPedido(null);
    expect(screen.getByRole('button', { name: /^Delivery$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));

    expect(screen.getByTestId('aviso-comer-local')).toHaveTextContent(
      'Te atenderemos por tu nombre: Luis. Te llamaremos cuando tu pedido esté listo. Estás pidiendo para comer en el local.',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Dirección/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Referencia/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-comer-local')).toBeInTheDocument();
  });

  it('envía modalidad COMER_LOCAL con nombre y celular y sin entrega', async () => {
    abrirPedido(null);
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await alEnvio());

    await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
    const payload = pedidosEnviados()[0][1] as any;
    expect(payload.modalidad).toBe('COMER_LOCAL');
    expect(payload.entrega).toBeUndefined();
    expect(payload.cliente).toMatchObject({ nombre: 'Luis', telefono: '912345678' });
  });

  it('nombre y celular siguen siendo obligatorios: sin nombre no avanza', async () => {
    abrirPedido(null);
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu nombre');
    expect(pedidosEnviados()).toHaveLength(0);
  });
});
