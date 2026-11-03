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

const datosDe = (invitadoPermitido: boolean | undefined): DatosLocalCarta => ({
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } },
  envioGratisDesde: 70,
  pedidoMinimo: 0,
  invitadoPermitido,
});

function Pagina({ invitadoPermitido }: { invitadoPermitido: boolean | undefined }) {
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
      <FormularioCheckout estadoLocal={estado} datosLocal={datosDe(invitadoPermitido)} />
    </div>
  );
}

function abrirPedido(invitadoPermitido: boolean | undefined) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <Pagina invitadoPermitido={invitadoPermitido} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

/** Desde el paso 1 ya lleno: recoger en el local, y avanzar hasta el botón de enviar. */
async function irAEnviar() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Enviar pedido/i }));
}

describe('Checkout ▸ pedir como invitado apagado o encendido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockImplementation(async (ruta: string) => {
      if (ruta === '/pedidos') throw new ErrorApi('CELULAR_REQUERIDO', 'Escribe tu celular para hacer tu pedido y sumar puntos', 400);
      return { descuentoTotal: 0, detalles: [] };
    });
  });

  it('apagado: «Ver mis puntos» abre el acceso solo para consultar; el pedido no exige iniciar sesión', () => {
    const abrirPanel = vi.fn();
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: null, abrirPanel } as any);
    render(
      <CarritoProvider>
        <Pagina invitadoPermitido={false} />
      </CarritoProvider>,
    );
    fireEvent.click(screen.getByText('Abrir pedido'));
    expect(screen.getByText(/Tus puntos se suman con tu celular, sin contraseña/)).toBeInTheDocument();
    expect(screen.queryByText(/Ingresar para acumular puntos/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mis puntos' }));
    expect(abrirPanel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Teléfono celular/i)).toBeRequired();
  });

  it('apagado: no se ofrece «Continuar como invitado», el celular es obligatorio y se explica que suma puntos', async () => {
    abrirPedido(false);

    expect(screen.queryByRole('button', { name: /Continuar como invitado/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Paso 1: Tus datos \(actual\)/)).toBeInTheDocument();
    expect(screen.getByText('Tu celular: sumas puntos con tu número, sin contraseña.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono celular/i)).toBeRequired();

    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByText('Escribe tu celular para hacer tu pedido y sumar puntos')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Paso 2: Ubicación \(actual\)/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    // El pedido sin cuenta no pide cumpleaños: solo nombre y celular
    expect(screen.queryByLabelText(/Tu cumpleaños/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  });

  it('apagado: si el servidor responde CELULAR_REQUERIDO, el pedido no se envía y se muestra el mensaje claro', async () => {
    abrirPedido(false);
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    await irAEnviar();

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything()));
    expect(await screen.findByText('Escribe tu celular para hacer tu pedido y sumar puntos.')).toBeInTheDocument();
  });

  it('encendido: se ofrece «Continuar como invitado», el celular es opcional con su nota y el pedido va sin teléfono', async () => {
    abrirPedido(true);

    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    expect(screen.getByText('Opcional. Con tu celular sumas puntos.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono celular/i)).not.toBeRequired();

    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  });

  it('encendido: el pedido sin celular no manda teléfono en el cliente', async () => {
    abrirPedido(true);
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    await irAEnviar();

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything()));
    const payload = vi.mocked(api.post).mock.calls.find((c) => c[0] === '/pedidos')![1] as any;
    expect(payload.cliente).toEqual({ nombre: 'Luis' });
  });
});

describe('Checkout ▸ dirección del último pedido del celular (sin cuenta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  /** Respuesta de la pista pública; el pedido siempre responde error para no seguir el flujo. */
  function conPista(respuestaPista: unknown) {
    vi.mocked(api.post).mockImplementation(async (ruta: string) => {
      if (ruta === '/pedidos') throw new ErrorApi('CELULAR_REQUERIDO', 'Escribe tu celular para hacer tu pedido y sumar puntos', 400);
      if (ruta === '/pedidos/pista-direccion') return respuestaPista;
      return { descuentoTotal: 0, detalles: [] };
    });
  }

  /** Paso 1 con nombre y celular completos, y avanza al paso 2 (delivery por defecto). */
  async function llegarUbicacion() {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  }

  it('con celular que tuvo un pedido con dirección: muestra la pista enmascarada y la opción de reutilizarla', async () => {
    conPista({ existe: true, zona: 'SJL', direccion: 'Av. Los G••••' });
    abrirPedido(false);
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByText('Av. Los G•••• · zona SJL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usar la dirección de mi último pedido/i })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/pedidos/pista-direccion', { telefono: '912345678' });
  });

  it('al elegir la dirección anterior, el formulario de dirección se oculta y el pedido manda solo la marca', async () => {
    conPista({ existe: true, zona: 'SJL', direccion: 'Av. Los G••••' });
    abrirPedido(false);
    await llegarUbicacionConPista();
    fireEvent.click(screen.getByRole('button', { name: /Usar la dirección de mi último pedido/i }));
    expect(screen.getByText('Enviaremos a la dirección de tu último pedido')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Dirección escrita/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything()));
    const payload = vi.mocked(api.post).mock.calls.find((c) => c[0] === '/pedidos')![1] as any;
    expect(payload.entrega).toEqual({ reutilizarUltimaDireccion: true });
  });

  it('«Usar otra dirección» vuelve al formulario normal', async () => {
    conPista({ existe: true, zona: 'SJL', direccion: 'Av. Los G••••' });
    abrirPedido(false);
    await llegarUbicacionConPista();
    fireEvent.click(screen.getByRole('button', { name: /Usar la dirección de mi último pedido/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usar otra dirección/i }));
    expect(screen.getByLabelText(/Dirección escrita/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usar la dirección de mi último pedido/i })).toBeInTheDocument();
  });

  it('sin pedido previo con ese celular: no se ofrece la pista', async () => {
    conPista({ existe: false });
    abrirPedido(false);
    await llegarUbicacion();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos/pista-direccion', { telefono: '912345678' }));
    expect(screen.queryByRole('button', { name: /Usar la dirección de mi último pedido/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Dirección escrita/i)).toBeInTheDocument();
  });

  /** Como llegarAUbicacion, pero espera a que llegue la pista. */
  async function llegarUbicacionConPista() {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByRole('button', { name: /Usar la dirección de mi último pedido/i })).toBeInTheDocument();
  }
});
