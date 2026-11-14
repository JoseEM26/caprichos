import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { FormularioCheckout } from '../FormularioCheckout';
import { DatosLocalCarta, EstadoLocalCarta, ProductoCarta } from '../tipos';
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
  pedidoMinimo: 0,
  invitadoPermitido: false,
};

const dona: ProductoCarta = {
  id: '10',
  nombre: 'Dona',
  descripcion: null,
  fotoUrl: null,
  precio: 18,
  tamanos: [{ id: 'media', nombre: 'Media docena', precio: 18, unidades: 6 }],
  grupos: [],
  sabores: [
    { id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 },
    { id: 'o', nombre: 'Oreo', disponible: true, quedan: null },
  ],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: true,
  quedan: null,
  saboresConStock: true,
};

// Carga el stock de la carta y abre el checkout con la línea de mezcla ya en el carrito
function Pagina() {
  const { aplicarCarta, abrirCheckout } = useCarrito();
  useEffect(() => {
    aplicarCarta([dona]);
    abrirCheckout();
  }, []);
  return <FormularioCheckout estadoLocal={estado} datosLocal={datos} />;
}

async function irAEnviar() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  fireEvent.click(await alEnvio());
}

describe('Checkout ▸ mezcla de sabores y 409 de stock por sabor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(
      'caprichos_carrito',
      JSON.stringify([
        {
          id: 'l1',
          productoId: '10',
          nombre: 'Dona',
          tamanoId: 'media',
          tamanoNombre: 'Media docena',
          precioBase: 18,
          cantidad: 1,
          opciones: [],
          precioUnitario: 18,
          subtotal: 18,
          unidadesPorMezcla: 6,
          sabores: [
            { saborId: 'f', cantidad: 3, nombre: 'Fresa' },
            { saborId: 'o', cantidad: 3, nombre: 'Oreo' },
          ],
        },
      ]),
    );
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(null);
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      return {};
    });
    vi.mocked(api.post).mockImplementation(async (ruta: string) => {
      if (ruta === '/pedidos') {
        throw new ErrorApi('SABOR_AGOTADO', 'Ya no quedan Fresa', 409, {
          codigo: 'SABOR_AGOTADO',
          productoId: 10,
          saborId: 'f',
          saborNombre: 'Fresa',
        });
      }
      return { descuentoTotal: 0, detalles: [] };
    });
  });

  it('409 SABOR_AGOTADO muestra «Ya no quedan Fresa» y «Ajustar mi pedido» reabre los sabores sin vaciar el carrito', async () => {
    render(
      <CarritoProvider>
        <Pagina />
      </CarritoProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    await irAEnviar();

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything()));
    // el envío lleva los sabores de la línea
    const payload = vi.mocked(api.post).mock.calls.find((c) => c[0] === '/pedidos')?.[1] as any;
    expect(payload.lineas[0].sabores).toEqual([
      { saborId: 'f', cantidad: 3 },
      { saborId: 'o', cantidad: 3 },
    ]);

    expect(await screen.findByText('Ya no quedan Fresa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar mi pedido' }));

    // se abre la ventana de la línea: Fresa sale bloqueada (sin saldo) y el total sigue en 6
    expect(await screen.findByRole('dialog', { name: 'Elegir sabores de Dona' })).toBeInTheDocument();
    expect((screen.getByRole('button', { name: 'Agregar una de Fresa' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Elegidas 3 de 6')).toBeInTheDocument();
    // el carrito sigue con su línea
    expect(JSON.parse(sessionStorage.getItem('caprichos_carrito') ?? '[]')).toHaveLength(1);
  });
});
