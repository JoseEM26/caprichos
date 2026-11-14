import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const baseDatos: DatosLocalCarta = {
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

let datos: DatosLocalCarta = baseDatos;
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


import { mediosPagoPorDefecto } from '@caprichos/compartido';

describe('Checkout de la carta ▸ medios de pago por canal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  it('un medio apagado en CARTA no se muestra y el medio inicial pasa a uno encendido', async () => {
    const c = mediosPagoPorDefecto();
    c.CARTA.YAPE = false;
    datos = { ...baseDatos, mediosPagoCanal: c };
    abrirPedido();
    await irAPago();
    expect(screen.queryByRole('button', { name: 'YAPE' })).toBeNull();
    expect(screen.getByRole('button', { name: 'EFECTIVO' })).toBeInTheDocument();
  });

  it('sin interruptores (o todo encendido) se ve como siempre', async () => {
    datos = baseDatos;
    abrirPedido();
    await irAPago();
    expect(screen.getByRole('button', { name: 'YAPE' })).toBeInTheDocument();
  });

  it('con todo apagado lo dice simple', async () => {
    const c = mediosPagoPorDefecto();
    for (const m of Object.keys(c.CARTA)) (c.CARTA as any)[m] = false;
    datos = { ...baseDatos, mediosPagoCanal: c };
    abrirPedido();
    await irAPago();
    expect(screen.getByTestId('sin-medios-pago')).toBeInTheDocument();
  });
});
