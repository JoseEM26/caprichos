import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    fireEvent.click(await screen.findByRole('button', { name: /Jr\. Los Olivos 45/ }));

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
    fireEvent.change(screen.getByLabelText(/Tu cumpleaños/i), { target: { value: '1990-05-10' } });
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
