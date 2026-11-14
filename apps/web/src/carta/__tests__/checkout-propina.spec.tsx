import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { alEnvio, cambiarMedio } from './medioPago';

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

/** Datos del local con la propina de la carta encendida (o apagada) y su tope. */
const datos = (cartaActiva: boolean): DatosLocalCarta => ({
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true }, plin: { activo: true }, transferencia: { activo: true } },
  envioGratisDesde: 70,
  pedidoMinimo: 0,
  invitadoPermitido: false,
  propina: { carta: cartaActiva, bot: false, tope: 50 },
});

function Pagina({ cartaActiva }: { cartaActiva: boolean }) {
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
      <FormularioCheckout estadoLocal={estado} datosLocal={datos(cartaActiva)} />
    </div>
  );
}

function abrirPedido(cartaActiva: boolean) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <Pagina cartaActiva={cartaActiva} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

/** Desde el paso 1: recoger en el local y datos de la persona; sigue hasta el paso de pago (donde va la propina). */
async function irAPago() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await alEnvio()).toBeInTheDocument();
}

describe('Checkout de la carta ▸ propina opcional', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockResolvedValue({});
  });

  it('con la carta apagada no aparece el campo de propina', async () => {
    abrirPedido(false);
    await irAPago();
    expect(screen.queryByTestId('propina-carta')).not.toBeInTheDocument();
  });

  it('con la carta encendida pide la propina opcional, aparte de la venta, y suma al total a pagar', async () => {
    abrirPedido(true);
    await irAPago();
    fireEvent.change(screen.getByLabelText(/Propina opcional para el equipo/i), { target: { value: '5' } });
    expect(screen.getByTestId('propina-resumen')).toHaveTextContent('S/ 5.00');
    // venta 14.50 + propina 5.00 = lo que paga el cliente
    expect(screen.getByRole('button', { name: /Enviar pedido/i })).toHaveTextContent('Enviar pedido · S/ 19.50');
  });

  it.each(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'])('con %s la propina (monto libre) se ofrece igual y suma al total a pagar', async (medio) => {
    abrirPedido(true);
    await irAPago();
    cambiarMedio(medio);
    expect(screen.getByTestId('propina-carta')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Propina opcional para el equipo/i), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: /Enviar pedido/i })).toHaveTextContent('Enviar pedido · S/ 17.50');
  });

  it('envía la propina aparte del pedido (campo propina, no suma al total de productos)', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido(true);
    await irAPago();
    fireEvent.change(screen.getByLabelText(/Propina opcional para el equipo/i), { target: { value: '2,50' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos', expect.objectContaining({ propina: 2.5 }), expect.anything()));
  });

  it('una propina sobre el tope no deja enviar y avisa con el máximo', async () => {
    abrirPedido(true);
    await irAPago();
    fireEvent.change(screen.getByLabelText(/Propina opcional para el equipo/i), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    expect(await screen.findByText(/La propina debe ser un monto entre S\/ 0 y S\/ 50\.00/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());
  });
});
