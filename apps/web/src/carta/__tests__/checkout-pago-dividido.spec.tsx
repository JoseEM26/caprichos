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

const datos: DatosLocalCarta = {
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } },
  envioGratisDesde: 70,
  pedidoMinimo: 0,
  invitadoPermitido: false,
  propina: { carta: false, bot: false, tope: 50 },
};

function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea({
            productoId: 'prod-1',
            nombre: 'Combo',
            precioBase: 40,
            cantidad: 1,
            opciones: [],
            precioUnitario: 40,
            subtotal: 40,
          });
          abrirCheckout();
        }}
      >
        Abrir pedido
      </button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datos} />
    </div>
  );
}

function abrirPedido() {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <Pagina />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

async function irAPago() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByRole('button', { name: /Enviar pedido/i })).toBeInTheDocument();
}

const botonDelDividido = (texto: string) =>
  Array.from(screen.getByTestId('pago-dividido').querySelectorAll('button')).find((b) => b.textContent === texto)!;

describe('Checkout de la carta ▸ pago dividido', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  it('Yape S/ 38 + el resto en efectivo: manda pago.plan con los dos montos y no deja enviar si falta algo', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido();
    await irAPago();
    fireEvent.click(screen.getByTestId('alternar-pago-dividido'));
    // sin segundo medio ni monto: avisa y no envía
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    expect((await screen.findAllByText(/Elige el segundo medio de pago/)).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());

    fireEvent.change(screen.getByLabelText(/¿Cuánto pagas con YAPE\?/i), { target: { value: '38' } });
    fireEvent.click(botonDelDividido('EFECTIVO'));
    expect(screen.getByTestId('pago-dividido')).toHaveTextContent('YAPE S/ 38.00 + EFECTIVO S/ 2.00');
    fireEvent.change(screen.getByLabelText(/Paga con/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          pago: { metodo: 'YAPE', pagaCon: 5, plan: [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }] },
        }),
        expect.anything(),
      ),
    );
  });

  it('un monto igual o mayor al total no es un pago dividido', async () => {
    abrirPedido();
    await irAPago();
    fireEvent.click(screen.getByTestId('alternar-pago-dividido'));
    fireEvent.change(screen.getByLabelText(/¿Cuánto pagas con YAPE\?/i), { target: { value: '40' } });
    fireEvent.click(botonDelDividido('EFECTIVO'));
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    expect((await screen.findAllByText(/El primer monto debe ser menor a S\/ 40\.00/)).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());
  });
});
