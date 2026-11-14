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
  expect(await alEnvio()).toBeInTheDocument();
}

const elegirMedio = (n: number, medio: string) => fireEvent.change(screen.getByLabelText(`Medio ${n}`), { target: { value: medio } });
const enviar = () => fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));

describe('Checkout de la carta ▸ pago dividido', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  it('la tarjeta «Pagar con 2 o 3 medios» está en «¿Cómo pagas?» junto a los medios', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido();
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    const grupo = await screen.findByTestId('tarjetas-medio-pago');
    expect(grupo).toHaveTextContent('Pagar con 2 o 3 medios');
    expect(grupo).toHaveTextContent('Divide el pago');
  });

  it('Yape S/ 38 + el resto en efectivo: manda pago.plan y no deja enviar si falta algo', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido();
    await irAPago();
    cambiarMedio('Pagar con 2 o 3 medios');
    elegirMedio(2, 'EFECTIVO');
    // sin monto en el primero: avisa y no envía
    enviar();
    expect((await screen.findAllByText(/Escribe cuánto pagas con YAPE/)).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());

    fireEvent.change(screen.getByLabelText('Monto de Yape'), { target: { value: '38' } });
    expect(screen.getByLabelText('Monto de Efectivo')).toHaveTextContent('S/ 2.00');
    expect(screen.getByTestId('resumen-dividido')).toHaveTextContent('El pago cubre el total');
    fireEvent.change(screen.getByLabelText(/Paga con/i), { target: { value: '5' } });
    enviar();

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

  it('3 medios: Agregar otro medio (máx. 3), Quitar, autocompleta el último y manda los 3 renglones', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido();
    await irAPago();
    cambiarMedio('Pagar con 2 o 3 medios');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio' }));
    expect(screen.queryByRole('button', { name: 'Agregar otro medio' })).toBeNull(); // tope de 3
    elegirMedio(3, 'EFECTIVO');
    fireEvent.change(screen.getByLabelText('Monto de Yape'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Monto de Plin'), { target: { value: '15' } });
    expect(screen.getByLabelText('Monto de Efectivo')).toHaveTextContent('S/ 5.00');
    // no se repite un medio ya usado
    expect((screen.getByLabelText('Medio 2').querySelector('option[value="YAPE"]') as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Paga con/i), { target: { value: '10' } });
    enviar();
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({
          pago: { metodo: 'YAPE', pagaCon: 10, plan: [{ medio: 'YAPE', monto: 20 }, { medio: 'PLIN', monto: 15 }, { medio: 'EFECTIVO', monto: 5 }] },
        }),
        expect.anything(),
      ),
    );
  });

  it('Quitar deja 2 renglones; los montos que pasan del total muestran «Sobra» y no envían', async () => {
    abrirPedido();
    await irAPago();
    cambiarMedio('Pagar con 2 o 3 medios');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Plin' }));
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Monto de Yape'), { target: { value: '45' } });
    expect(screen.getByTestId('resumen-dividido')).toHaveTextContent('Sobra S/ 5.00');
    enviar();
    expect((await screen.findAllByText(/Sobra S\/ 5\.00/)).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());
  });

  it('con propina (monto libre): el plan dividido suma venta + propina y la propina viaja aparte', async () => {
    datos.propina!.carta = true;
    try {
      vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
      abrirPedido();
      await irAPago();
      cambiarMedio('Pagar con 2 o 3 medios');
      fireEvent.change(screen.getByLabelText(/Propina opcional para el equipo/i), { target: { value: '5' } });
      elegirMedio(2, 'EFECTIVO');
      fireEvent.change(screen.getByLabelText('Monto de Yape'), { target: { value: '38' } });
      // venta 40 + propina 5 = 45: a Yape 38, el resto (7) en efectivo
      expect(screen.getByLabelText('Monto de Efectivo')).toHaveTextContent('S/ 7.00');
      fireEvent.change(screen.getByLabelText(/Paga con/i), { target: { value: '10' } });
      enviar();
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith(
          '/pedidos',
          expect.objectContaining({
            propina: 5,
            pago: { metodo: 'YAPE', pagaCon: 10, plan: [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 7 }] },
          }),
          expect.anything(),
        ),
      );
    } finally {
      datos.propina!.carta = false;
    }
  });

  it('efectivo sin «paga con» no envía; «Pago exacto» lo llena y manda pagaCon', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    abrirPedido();
    await irAPago();
    cambiarMedio('EFECTIVO');
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    expect((await screen.findAllByText(/Escribe con cuánto pagas en efectivo/)).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /Pago exacto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({ pago: expect.objectContaining({ metodo: 'EFECTIVO', pagaCon: 40 }) }),
        expect.anything(),
      ),
    );
  });
});
