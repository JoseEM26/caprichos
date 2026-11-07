import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { api } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

vi.mock('../../comun/api', async () => {
  const real = await vi.importActual<typeof import('../../comun/api')>('../../comun/api');
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const estado: EstadoLocalCarta = {
  abierta: true, motivo: 'OK', texto: 'Abierto', abre: '14:00', cierra: '22:00',
  pausaAltaDemanda: false, tiempoPrometidoMin: 25, altaDemandaMin: 0,
};
const datos: DatosLocalCarta = {
  nombre: 'Caprichos', direccion: 'Av. Las Delicias 123', telefono: '999888777', whatsapp: '999888777', redes: {}, horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } }, envioGratisDesde: 70, pedidoMinimo: 0, invitadoPermitido: false,
};

function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea({ productoId: 'prod-1', nombre: 'Frappé Clásico', precioBase: 14.5, cantidad: 1, opciones: [], precioUnitario: 14.5, subtotal: 14.5 });
          abrirCheckout();
        }}
      >
        Abrir pedido
      </button>
      <FormularioCheckout estadoLocal={estado} datosLocal={datos} />
    </div>
  );
}

async function irAUbicacion() {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(<CarritoProvider><Pagina /></CarritoProvider>);
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
}

const ENVIO_Z1 = { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };

function conGps() {
  const geo = { getCurrentPosition: vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -12.05, longitude: -77.04, accuracy: 20 } })) };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}

describe('Checkout delivery con ubicación opcional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta.startsWith('/carta/envio') ? ENVIO_Z1 : {}));
    vi.mocked(api.post).mockResolvedValue({ existe: false });
  });
  afterEach(() => Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }));

  it('ofrece GPS y mapa, y sin ubicación avisa «Envío por confirmar»', async () => {
    await irAUbicacion();
    expect(screen.getByRole('button', { name: /Marcar en el mapa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Usar mi ubicación actual/i })).toBeInTheDocument();
    expect(screen.getByTestId('aviso-envio-por-confirmar').textContent).toMatch(/Envío por confirmar/);
  });

  it('sin ubicación, dirección y referencia son obligatorias para seguir', async () => {
    await irAUbicacion();
    expect(document.getElementById('f-referencia')).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/dirección de al menos 5/);

    fireEvent.change(document.getElementById('f-direccion') as HTMLInputElement, { target: { value: 'Av. Los Olivos 123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/referencia/);

    fireEvent.change(document.getElementById('f-referencia') as HTMLInputElement, { target: { value: 'Frente al parque' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 3/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Envío por confirmar: se calcula al recibir tu ubicación/).length).toBeGreaterThan(0);
  });

  it('con GPS muestra zona y envío en vivo, exige confirmar y deja seguir sin escribir dirección ni referencia', async () => {
    conGps();
    await irAUbicacion();
    fireEvent.click(screen.getByRole('button', { name: /Usar mi ubicación actual/i }));

    expect(await screen.findByText(/Zona Z1 · envío S\/ 5\.00/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/carta/envio?lat=-12.05&lng=-77.04');
    expect(document.getElementById('f-referencia')).not.toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Mi pedido llega aquí/);

    fireEvent.click(screen.getByRole('button', { name: 'Mi pedido llega aquí' }));
    expect(await screen.findByText('Ubicación confirmada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(await screen.findByLabelText(/Paso 3/i)).toBeInTheDocument();
  });

  it('«Marcar en el mapa» abre el mapa a pantalla completa con buscador', async () => {
    await irAUbicacion();
    fireEvent.click(screen.getByRole('button', { name: /Marcar en el mapa/i }));
    expect(screen.getByRole('dialog', { name: /Marca dónde recibes tu pedido/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar ubicación' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mapa' }));
    expect(screen.queryByRole('dialog', { name: /Marca dónde recibes/i })).not.toBeInTheDocument();
  });
});
