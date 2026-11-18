import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const datos: DatosLocalCarta = {
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: { efectivo: { activo: true }, yape: { activo: true } },
  envioGratisDesde: 70,
  envioGratisModo: 'mas_de',
  pedidoMinimo: null,
  invitadoPermitido: true,
};

/** Tres productos en el carrito (S/ 14.50 cada uno). */
function Pagina() {
  const { agregarLinea, abrirCheckout } = useCarrito();
  const producto = (id: string, nombre: string) => ({
    productoId: id,
    nombre,
    precioBase: 14.5,
    cantidad: 1,
    opciones: [],
    precioUnitario: 14.5,
    subtotal: 14.5,
  });
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea(producto('prod-1', 'Frappé Clásico'));
          agregarLinea(producto('prod-2', 'Torta Helada'));
          agregarLinea(producto('prod-3', 'Limonada'));
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
  fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
}

const pedidosEnviados = () => vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/pedidos');
const selectores = () => screen.queryAllByTestId('selector-para-llevar');
const botonesLlevar = () => screen.getAllByTestId('para-llevar-si');
const botonesAqui = () => screen.getAllByTestId('para-llevar-no');

describe('Carta ▸ para llevar por línea (Comer en el local)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockImplementation(async () => {
      throw new ErrorApi('ERROR_PRUEBA', 'error de prueba', 400);
    });
  });

  it('en Delivery no aparece ningún selector; solo con Comer en el local', () => {
    abrirPedido();
    expect(selectores()).toHaveLength(0);
    expect(screen.queryByTestId('bloque-para-llevar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    expect(screen.getByTestId('bloque-para-llevar')).toBeInTheDocument();
    expect(selectores()).toHaveLength(3);
  });

  it('por defecto todo queda como Comer aquí', () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    expect(botonesAqui().every((b) => b.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(screen.queryByTestId('resumen-para-llevar')).not.toBeInTheDocument();
  });

  it('cada línea es un radiogroup accesible con 44 px de alto', () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    const grupo = within(screen.getByRole('radiogroup', { name: 'Dónde se come Limonada' }));
    expect(grupo.getAllByRole('radio')).toHaveLength(2);
    expect(grupo.getByRole('radio', { name: 'Comer aquí' })).toBeInTheDocument();
    expect(grupo.getByRole('radio', { name: /Para llevar/ })).toBeInTheDocument();
    expect(botonesLlevar()[0].style.minHeight).toBe('44px');
  });

  it('atajos «Todo para llevar» y «Todo aquí»', () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(screen.getByRole('button', { name: 'Todo para llevar' }));
    expect(botonesLlevar().every((b) => b.getAttribute('aria-checked') === 'true')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Todo aquí' }));
    expect(botonesAqui().every((b) => b.getAttribute('aria-checked') === 'true')).toBe(true);
  });

  it('resumen «2 para llevar · 1 aquí» solo cuando hay mezcla', () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(botonesLlevar()[0]);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('1 para llevar · 2 aquí');
    fireEvent.click(botonesLlevar()[1]);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('2 para llevar · 1 aquí');
    fireEvent.click(screen.getByRole('button', { name: 'Todo para llevar' }));
    expect(screen.queryByTestId('resumen-para-llevar')).not.toBeInTheDocument();
  });

  it('la cuenta de unidades vive en el carrito (sessionStorage), así sobrevive a cerrar y volver', () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(botonesLlevar()[0]);
    const guardado = JSON.parse(sessionStorage.getItem('caprichos_carrito') ?? '[]');
    expect(guardado.map((l: { llevar: number }) => l.llevar)).toEqual([1, 0, 0]);
    expect(guardado.some((l: object) => 'paraLlevar' in l)).toBe(false);
  });

  it('envía paraLlevar por línea solo en Comer en el local', async () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(botonesLlevar()[0]);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await alEnvio());

    await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
    const lineas = (pedidosEnviados()[0][1] as any).lineas;
    expect(lineas.map((l: { paraLlevar?: boolean }) => l.paraLlevar)).toEqual([true, false, false]);
  });

  it('al pasar a Recoger la marca se ignora: no bloque, ni paraLlevar en el envío', async () => {
    abrirPedido();
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    fireEvent.click(botonesLlevar()[0]);
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/ }));
    expect(screen.queryByTestId('bloque-para-llevar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await alEnvio());

    await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
    const payload = pedidosEnviados()[0][1] as any;
    expect(payload.modalidad).toBe('RECOGER');
    expect(payload.lineas.every((l: object) => !('paraLlevar' in l))).toBe(true);
  });
});

/** Un producto de `cantidad` unidades con `llevar` ya marcadas, como lo deja la carta al agregarlo. */
function PaginaUnProducto({ cantidad, llevar }: { cantidad: number; llevar?: number }) {
  const { agregarLinea, abrirCheckout } = useCarrito();
  return (
    <div>
      <button
        onClick={() => {
          agregarLinea({
            productoId: 'prod-1',
            nombre: 'Frappé Clásico',
            precioBase: 14.5,
            cantidad,
            opciones: [],
            precioUnitario: 14.5,
            subtotal: Number((14.5 * cantidad).toFixed(2)),
            llevar,
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

function abrirUnProducto(cantidad: number, llevar?: number) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
  render(
    <CarritoProvider>
      <PaginaUnProducto cantidad={cantidad} llevar={llevar} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
  fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
}

/** Con Comer en el local, avanza hasta enviar y devuelve el payload del pedido. */
async function enviarComoComerLocal() {
  fireEvent.click(screen.getByTestId('modalidad-comer-local'));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  fireEvent.click(await alEnvio());
  await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
  return pedidosEnviados()[0][1] as any;
}

/** Muestra las líneas del carrito tal como las deja el proveedor (para ver la migración de sessionStorage). */
function SondaLineas() {
  const { lineas } = useCarrito();
  return <pre data-testid="sonda">{JSON.stringify(lineas.map((l) => ({ cantidad: l.cantidad, llevar: l.llevar, paraLlevar: (l as { paraLlevar?: boolean }).paraLlevar })))}</pre>;
}

describe('Carta ▸ para llevar por unidad (2 frappés: uno para llevar, otro aquí)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockImplementation(async () => {
      throw new ErrorApi('ERROR_PRUEBA', 'error de prueba', 400);
    });
  });

  it('cantidad 2 con k=1: el selector muestra «1 de 2» y el payload lleva dos líneas (1 aquí + 1 para llevar)', async () => {
    abrirUnProducto(2);
    fireEvent.click(screen.getByTestId('modalidad-comer-local'));
    expect(screen.getByTestId('llevar-cuenta')).toHaveTextContent('0 de 2');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir una para llevar' }));
    expect(screen.getByTestId('llevar-cuenta')).toHaveTextContent('1 de 2');
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('1 para llevar · 1 aquí');

    const payload = await enviarComoComerLocal();
    expect(payload.lineas).toEqual([
      expect.objectContaining({ productoId: 'prod-1', cantidad: 1, paraLlevar: false }),
      expect.objectContaining({ productoId: 'prod-1', cantidad: 1, paraLlevar: true }),
    ]);
  });

  it('cantidad 2 con k=0: una sola línea de 2 aquí', async () => {
    abrirUnProducto(2, 0);
    const payload = await enviarComoComerLocal();
    expect(payload.lineas).toEqual([expect.objectContaining({ cantidad: 2, paraLlevar: false })]);
  });

  it('cantidad 2 con k=2: una sola línea de 2 para llevar', async () => {
    abrirUnProducto(2, 2);
    const payload = await enviarComoComerLocal();
    expect(payload.lineas).toEqual([expect.objectContaining({ cantidad: 2, paraLlevar: true })]);
  });

  it('en Recoger no se reparte ni se envía la marca aunque la línea tenga unidades para llevar', async () => {
    abrirUnProducto(2, 1);
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(await alEnvio());
    await waitFor(() => expect(pedidosEnviados()).toHaveLength(1));
    const payload = pedidosEnviados()[0][1] as any;
    expect(payload.modalidad).toBe('RECOGER');
    expect(payload.lineas).toEqual([expect.objectContaining({ cantidad: 2 })]);
    expect(payload.lineas.every((l: object) => !('paraLlevar' in l))).toBe(true);
  });

  it('sessionStorage: el booleano viejo migra (true → todas, false/ausente → 0) y llevar se recorta a la cantidad', () => {
    sessionStorage.setItem(
      'caprichos_carrito',
      JSON.stringify([
        { id: 'a', productoId: 'prod-1', nombre: 'Frappé', precioBase: 14.5, cantidad: 2, opciones: [], precioUnitario: 14.5, subtotal: 29, paraLlevar: true },
        { id: 'b', productoId: 'prod-2', nombre: 'Torta', precioBase: 14.5, cantidad: 3, opciones: [], precioUnitario: 14.5, subtotal: 43.5, paraLlevar: false },
        { id: 'c', productoId: 'prod-3', nombre: 'Limonada', precioBase: 14.5, cantidad: 3, opciones: [], precioUnitario: 14.5, subtotal: 43.5 },
        { id: 'd', productoId: 'prod-4', nombre: 'Helado', precioBase: 14.5, cantidad: 2, opciones: [], precioUnitario: 14.5, subtotal: 29, llevar: 5 },
      ]),
    );
    render(
      <CarritoProvider>
        <SondaLineas />
      </CarritoProvider>,
    );
    expect(JSON.parse(screen.getByTestId('sonda').textContent ?? '[]')).toEqual([
      { cantidad: 2, llevar: 2 },
      { cantidad: 3, llevar: 0 },
      { cantidad: 3, llevar: 0 },
      { cantidad: 2, llevar: 2 },
    ]);
  });
});
