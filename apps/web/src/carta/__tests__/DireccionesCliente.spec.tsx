import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { PanelCuenta } from '../cuenta/PanelCuenta';

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

const datosLocal: DatosLocalCarta = {
  invitadoPermitido: true,
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true } },
  envioGratisDesde: 70,
  pedidoMinimo: 0,
};

const direccionesGuardadas = [
  {
    id: '7',
    direccion: 'Av. Las Palmeras 123',
    referencia: 'Portón azul',
    lat: -12.046374,
    lng: -77.042793,
    alias: null,
    usos: 3,
    ultimoUsoEn: '2026-10-20T15:04:00.000Z',
    origen: 'CARTA',
  },
  {
    id: '8',
    direccion: 'Jr. Los Olivos 45',
    referencia: null,
    lat: null,
    lng: null,
    alias: null,
    usos: 1,
    ultimoUsoEn: '2026-10-01T10:00:00.000Z',
    origen: 'MOZO',
  },
];

const cuentaCon = () =>
  ({
    cliente: {
      partyId: '100',
      nombre: 'Ana Torres',
      telefono: '987000222',
      correo: null,
      cumpleanos: '14/03',
      puntos: 0,
      fotoUrl: null,
    },
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
    ingresar: vi.fn(),
    registrar: vi.fn(),
    salir: vi.fn(),
    refrescar: vi.fn(),
    actualizarPerfil: vi.fn(),
    subirFoto: vi.fn(),
    quitarFoto: vi.fn(),
  }) as any;

/** Respuestas de la API: la libreta, la zona de cada punto y el resto en blanco. */
function mockApi(opciones: { direcciones?: unknown[] | 'error'; envio?: Record<string, unknown> } = {}) {
  const envio = opciones.envio ?? { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
  vi.mocked(api.get).mockImplementation(async (ruta: string) => {
    if (ruta.startsWith('/carta/cuenta/direcciones')) {
      if (opciones.direcciones === 'error') throw new Error('sin red');
      return { direcciones: opciones.direcciones ?? direccionesGuardadas };
    }
    if (ruta.startsWith('/carta/envio')) return envio;
    throw new Error(`ruta no esperada: ${ruta}`);
  });
  vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 0, detalles: [] });
}

function Pagina() {
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
      <FormularioCheckout estadoLocal={estado} datosLocal={datosLocal} />
    </div>
  );
}

/** Abre el pedido y avanza al paso 2 (Ubicación) con la cuenta o como invitado. */
async function irAUbicacion() {
  render(
    <CarritoProvider>
      <Pagina />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación/i)).toBeInTheDocument();
}

describe('Carta ▸ direcciones anteriores en el checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });
  afterEach(() => vi.restoreAllMocks());

  it('con sesión y delivery muestra sus direcciones y la opción de una nueva', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    expect(await screen.findByText('¿A dónde lo enviamos?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Av\. Las Palmeras 123/ })).toBeInTheDocument();
    expect(screen.getByText('Portón azul')).toBeInTheDocument();
    expect(screen.getByText('usada 3 veces')).toBeInTheDocument();
    // la otra ubicación queda en el historial plegado
    expect(screen.queryByText('usada 1 vez')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver historial de ubicaciones anteriores (1)' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial de ubicaciones anteriores (1)' }));
    expect(screen.getByText('usada 1 vez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otra dirección' })).toBeInTheDocument();
    // hasta elegir no aparece el formulario de dirección
    expect(document.getElementById('f-direccion')).toBeNull();
  });

  it('elegir una anterior rellena dirección, referencia y recalcula la zona y el envío', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: /Av\. Las Palmeras 123/ }));

    expect(await screen.findByText('Zona Z1 · envío S/ 5.00')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/carta/envio?lat=-12.046374&lng=-77.042793');
    expect(document.getElementById('f-direccion')).toHaveValue('Av. Las Palmeras 123');
    expect(document.getElementById('f-referencia')).toHaveValue('Portón azul');
  });

  it('ubicación anterior sin texto: muestra mini mapa y texto legible (no coordenadas) y al elegirla coloca el pin', async () => {
    mockApi({
      direcciones: [
        { id: '9', direccion: 'Punto marcado en el mapa', referencia: null, lat: -12.0186, lng: -76.958, alias: null, usos: 1, ultimoUsoEn: '2026-10-20T15:04:00.000Z', origen: 'WHATSAPP' },
      ],
    });
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    expect(await screen.findByTestId('mini-mapa-direccion')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/-12\.0186|-76\.958/);

    fireEvent.click(await screen.findByRole('button', { name: /Punto marcado en el mapa/ }));

    expect(await screen.findByText('Zona Z1 · envío S/ 5.00')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/carta/envio?lat=-12.0186&lng=-76.958');
    expect(document.querySelector('.leaflet-marker-icon')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/-12\.0186|-76\.958/);
  });

  it('si la anterior quedó fuera de zona avisa y vuelve a preguntar', async () => {
    mockApi({ envio: { cubierto: false, zona: null, tarifa: null, tarifaZona: null, gratisDesde: 70, modoGratis: 'mas_de' } });
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: /Av\. Las Palmeras 123/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/quedó fuera de nuestra zona de reparto/);
    expect(screen.getByText('¿A dónde lo enviamos?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Av\. Las Palmeras 123/ })).toBeInTheDocument();
    expect(document.getElementById('f-direccion')).toBeNull();
  });

  it('una anterior sin punto en el mapa rellena solo el texto', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial de ubicaciones anteriores (1)' }));
    fireEvent.click(screen.getByRole('button', { name: /Jr\. Los Olivos 45/ }));

    expect(document.getElementById('f-direccion')).toHaveValue('Jr. Los Olivos 45');
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/carta/envio'));
  });

  it('«Otra dirección» muestra el formulario vacío', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Otra dirección' }));

    expect(document.getElementById('f-direccion')).toHaveValue('');
    expect(document.getElementById('f-referencia')).toHaveValue('');
  });

  it('la ubicación principal es la más usada; con empate gana la más reciente', async () => {
    mockApi({
      direcciones: [
        { id: '1', direccion: 'Calle Uno', referencia: null, lat: null, lng: null, alias: null, usos: 2, ultimoUsoEn: '2026-10-01T10:00:00.000Z', origen: 'CARTA' },
        { id: '2', direccion: 'Calle Dos', referencia: null, lat: null, lng: null, alias: null, usos: 5, ultimoUsoEn: '2026-09-01T10:00:00.000Z', origen: 'CARTA' },
        { id: '3', direccion: 'Calle Tres', referencia: null, lat: null, lng: null, alias: null, usos: 2, ultimoUsoEn: '2026-10-25T10:00:00.000Z', origen: 'CARTA' },
      ],
    });
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    expect(await screen.findByRole('button', { name: /Calle Dos/ })).toBeInTheDocument();
    expect(screen.getByText('Tu ubicación habitual')).toBeInTheDocument();
    expect(screen.getByText('usada 5 veces')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Calle Tres/ })).not.toBeInTheDocument();
  });

  it('el historial va plegado y se ordena por uso (empate: más reciente primero)', async () => {
    mockApi({
      direcciones: [
        { id: '1', direccion: 'Calle Uno', referencia: null, lat: null, lng: null, alias: null, usos: 2, ultimoUsoEn: '2026-10-01T10:00:00.000Z', origen: 'CARTA' },
        { id: '2', direccion: 'Calle Dos', referencia: null, lat: null, lng: null, alias: null, usos: 5, ultimoUsoEn: '2026-09-01T10:00:00.000Z', origen: 'CARTA' },
        { id: '3', direccion: 'Calle Tres', referencia: null, lat: null, lng: null, alias: null, usos: 2, ultimoUsoEn: '2026-10-25T10:00:00.000Z', origen: 'CARTA' },
        { id: '4', direccion: 'Calle Cuatro', referencia: null, lat: null, lng: null, alias: null, usos: 1, ultimoUsoEn: '2026-10-30T10:00:00.000Z', origen: 'CARTA' },
      ],
    });
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    const boton = await screen.findByRole('button', { name: 'Ver historial de ubicaciones anteriores (3)' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Ubicaciones anteriores' })).not.toBeInTheDocument();

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    const grupo = screen.getByRole('group', { name: 'Ubicaciones anteriores' });
    const nombres = within(grupo)
      .getAllByRole('button')
      .map((b) => within(b).getByText(/^Calle /).textContent);
    expect(nombres).toEqual(['Calle Tres', 'Calle Uno', 'Calle Cuatro']);

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Ubicaciones anteriores' })).not.toBeInTheDocument();
  });

  it('elegir una del historial la usa y cierra la lista', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial de ubicaciones anteriores (1)' }));
    fireEvent.click(screen.getByRole('button', { name: /Jr\. Los Olivos 45/ }));

    await waitFor(() => expect(document.getElementById('f-direccion')).toHaveValue('Jr. Los Olivos 45'));
    expect(screen.queryByText('¿A dónde lo enviamos?')).not.toBeInTheDocument();
  });

  it('sin ubicación elegida el botón Continuar está deshabilitado con un aviso; al elegir se habilita', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    const continuar = await screen.findByRole('button', { name: /^Continuar$/ });
    expect(continuar).toBeDisabled();
    expect(screen.getByText('Elige dónde lo enviamos')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Av\. Las Palmeras 123/ }));
    // el texto del envío depende del subtotal del carrito (persiste entre pruebas): solo se mira la zona
    expect(await screen.findByText(/^Zona Z1 · envío/)).toBeInTheDocument();
    expect(screen.queryByText('Elige dónde lo enviamos')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continuar$/ })).toBeEnabled();
  });

  it('«Usar mi ubicación actual» sigue visible en la lista y toma el punto del GPS', async () => {
    const geo = { getCurrentPosition: vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -12.05, longitude: -77.04, accuracy: 20 } })) };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(cuentaCon());
    await irAUbicacion();

    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación actual' }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/carta/envio?lat=-12.05&lng=-77.04'));
    expect(screen.queryByText('¿A dónde lo enviamos?')).not.toBeInTheDocument();
    expect(screen.getByText('Mi pedido llega aquí')).toBeInTheDocument();
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
  });

  it('sin sesión no aparece la lista', async () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    render(
      <CarritoProvider>
        <Pagina />
      </CarritoProvider>,
    );
    fireEvent.click(screen.getByText('Abrir pedido'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

    expect(await screen.findByLabelText(/Paso 2: Ubicación/i)).toBeInTheDocument();
    expect(screen.queryByText('¿A dónde lo enviamos?')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/carta/cuenta/direcciones');
    expect(document.getElementById('f-direccion')).toBeInTheDocument();
  });
});

describe('Cuenta ▸ Mis direcciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  function abrirCuenta() {
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaCon(), panelAbierto: true });
    render(<PanelCuenta />);
  }

  it('lista las direcciones y quita una solo tras confirmar Sí', async () => {
    mockApi();
    vi.mocked(api.delete).mockResolvedValue({ ok: true });
    abrirCuenta();

    expect(await screen.findByText('Av. Las Palmeras 123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar dirección Av\. Las Palmeras 123/ }));

    // No: no borra
    expect(screen.getByRole('dialog', { name: '¿Quitar esta dirección?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No, cancelar' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Av. Las Palmeras 123')).toBeInTheDocument();

    // Sí: llama al DELETE y sale de la lista
    fireEvent.click(screen.getByRole('button', { name: /Quitar dirección Av\. Las Palmeras 123/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(screen.queryByText('Av. Las Palmeras 123')).not.toBeInTheDocument());
    expect(api.delete).toHaveBeenCalledWith('/carta/cuenta/direcciones/7');
    expect(screen.getByText('Jr. Los Olivos 45')).toBeInTheDocument();
  });

  it('sin direcciones muestra el estado vacío', async () => {
    mockApi({ direcciones: [] });
    abrirCuenta();

    expect(
      await screen.findByText('Aún no tienes direcciones guardadas. Se guardan solas cuando pides delivery.'),
    ).toBeInTheDocument();
  });
});
