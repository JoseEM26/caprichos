import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { cambiarMedio } from './medioPago';


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

function abrirPedido(delivery = false) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <Pagina />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
  void delivery;
}


async function aPaso(modalidad: RegExp, paso: number) {
  fireEvent.click(screen.getByRole('button', { name: modalidad }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  if (paso === 3) {
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByText('¿Cómo pagas?')).toBeInTheDocument();
  }
}

const tarjeta = (n: string) => screen.getByRole('button', { name: new RegExp(`^${n}$`, 'i') });
const ENVIO_Z1 = { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };

describe('Checkout ▸ pago en dos momentos', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta.startsWith('/carta/envio') ? ENVIO_Z1 : {}));
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
  });

  it('muestra el indicador «Paso 3 de 3 · ¿Cómo pagas?» y una tarjeta por medio, sin detalle', async () => {
    abrirPedido();
    await aPaso(/Recoger en el local/i, 3);
    expect(screen.getByTestId('pasos-subtitulo')).toHaveTextContent('Paso 3 de 3 · ¿Cómo pagas?');
    for (const m of ['Yape', 'Plin', 'Efectivo', 'Tarjeta', 'Transferencia', 'Pagar con 2 o 3 medios']) expect(tarjeta(m)).toBeInTheDocument();
    expect(screen.queryByText('Comprobante de pago')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elige cómo pagas/i })).toBeDisabled();
  });

  it('elegir un medio muestra solo su detalle; «Cambiar» vuelve a las tarjetas sin perder lo escrito', async () => {
    abrirPedido();
    await aPaso(/Recoger en el local/i, 3);
    fireEvent.click(tarjeta('Efectivo'));
    expect(screen.getByText('Pagar con Efectivo')).toBeInTheDocument();
    expect(screen.queryByTestId('tarjetas-medio-pago')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Paga con/i), { target: { value: '50' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(screen.getByTestId('tarjetas-medio-pago')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Paga con/i)).not.toBeInTheDocument();

    fireEvent.click(tarjeta('Efectivo'));
    expect(screen.getByLabelText(/Paga con/i)).toHaveValue(50);
  });

  it('Yape y Plin muestran su número con «Copiar»; Transferencia su cuenta', async () => {
    abrirPedido();
    await aPaso(/Recoger en el local/i, 3);
    fireEvent.click(tarjeta('Yape'));
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    cambiarMedio('Transferencia');
    expect(screen.getByText(/Cuenta:/)).toBeInTheDocument();
  });

  it.each([
    ['Yape', 'YAPE'],
    ['Plin', 'PLIN'],
    ['Efectivo', 'EFECTIVO'],
    ['Tarjeta', 'TARJETA'],
    ['Transferencia', 'TRANSFERENCIA'],
  ])('con %s el pedido sale con el mismo pago de siempre', async (nombre, metodo) => {
    abrirPedido();
    await aPaso(/Recoger en el local/i, 3);
    fireEvent.click(tarjeta(nombre));
    if (metodo === 'EFECTIVO') fireEvent.click(screen.getByRole('button', { name: /Pago exacto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/pedidos',
        expect.objectContaining({ pago: expect.objectContaining(metodo === 'EFECTIVO' ? { metodo, pagaCon: 40 } : { metodo }) }),
        expect.anything(),
      ),
    );
  });
});

describe('Checkout ▸ ubicación del delivery en dos momentos', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta.startsWith('/carta/envio') ? ENVIO_Z1 : {}));
    vi.mocked(api.post).mockResolvedValue({ existe: false });
    const geo = { getCurrentPosition: vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -12.05, longitude: -77.04, accuracy: 20 } })) };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  });

  it('«¿Dónde te lo llevamos?» ofrece tres tarjetas y ningún formulario', async () => {
    abrirPedido();
    await aPaso(/^Delivery$/, 2);
    expect(screen.getByTestId('pasos-subtitulo')).toHaveTextContent('Paso 2 de 3 · ¿Dónde te lo llevamos?');
    expect(screen.getByRole('button', { name: /Usar mi ubicación actual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marcar en el mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escribir la dirección/i })).toBeInTheDocument();
    expect(document.getElementById('f-direccion')).toBeNull();
    expect(document.getElementById('f-referencia')).toBeNull();
  });

  it('GPS: un toque da zona y envío, solo se ve la referencia y «Cambiar forma» conserva lo escrito', async () => {
    abrirPedido();
    await aPaso(/^Delivery$/, 2);
    fireEvent.click(screen.getByRole('button', { name: /Usar mi ubicación actual/i }));
    expect(await screen.findByText(/Zona Z1 · envío S\/ 5\.00/)).toBeInTheDocument();
    expect(screen.getByText('Tu ubicación actual')).toBeInTheDocument();
    expect(document.getElementById('f-direccion')).toBeNull();
    fireEvent.change(document.getElementById('f-referencia') as HTMLInputElement, { target: { value: 'Portón blanco' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar forma' }));
    expect(screen.getByRole('button', { name: /Escribir la dirección/i })).toBeInTheDocument();
    expect(document.getElementById('f-referencia')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Escribir la dirección/i }));
    expect(document.getElementById('f-referencia')).toHaveValue('Portón blanco');
  });

  it('mapa: abre el mapa a pantalla completa', async () => {
    abrirPedido();
    await aPaso(/^Delivery$/, 2);
    fireEvent.click(screen.getByRole('button', { name: /Marcar en el mapa/i }));
    expect(screen.getByLabelText('Marca dónde recibes tu pedido')).toBeInTheDocument();
  });

  it('escribir: pide dirección y referencia', async () => {
    abrirPedido();
    await aPaso(/^Delivery$/, 2);
    fireEvent.click(screen.getByRole('button', { name: /Escribir la dirección/i }));
    expect(screen.getByText('Escribir la dirección', { selector: 'h3' })).toBeInTheDocument();
    expect(document.getElementById('f-direccion')).toBeInTheDocument();
    expect(document.getElementById('f-referencia')).toBeRequired();
  });
});
