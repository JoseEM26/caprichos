import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { api } from '../../comun/api';
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

function abrirPedido(conSesion: boolean) {
  const ctx = conSesion ? ({ cliente: { partyId: '1', nombre: 'Luis', telefono: '912345678', puntos: 0 }, abrirPanel: vi.fn() } as any) : null;
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx);
  if (ctx) vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(ctx);
  render(
    <CarritoProvider>
      <Pagina invitadoPermitido={false} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

async function irAlResumen(conSesion: boolean) {
  abrirPedido(conSesion);
  if (!conSesion) {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  }
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  await alEnvio();
}

describe('Checkout ▸ descuento del equipo (solo con sesión)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  const respuestaEquipo = { descuentoTotal: 3.63, puntosEstimados: 0, detalles: [{ tipo: 'PERSONAL', nombre: 'Descuento por ser del equipo (25 %)', monto: 3.63 }] };

  it('con sesión y descuento del equipo: mensaje, línea del resumen, sin «ganarás N puntos», y no manda celular ni porcentaje', async () => {
    vi.mocked(api.post).mockResolvedValue(respuestaEquipo);
    await irAlResumen(true);
    expect(await screen.findByText(/Descuento del equipo: 25 %/)).toBeInTheDocument();
    expect(screen.getAllByText(/Descuento por ser del equipo \(25 %\)/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('puntos-estimados').textContent).toMatch(/No suma puntos/);
    expect(screen.getByTestId('puntos-estimados').textContent).not.toMatch(/sumas/);
    const llamada = vi.mocked(api.post).mock.calls.filter(([r]) => r === '/carta/descuentos/vista-previa').pop()!;
    expect(JSON.stringify(llamada[1])).not.toMatch(/celular|pct|porcentaje|telefono/i);
  });

  it('sin sesión no se muestra nada del equipo aunque el servidor lo devolviera', async () => {
    vi.mocked(api.post).mockResolvedValue(respuestaEquipo);
    await irAlResumen(false);
    expect(screen.queryByText(/Descuento del equipo/)).not.toBeInTheDocument();
  });

  it('con sesión pero sin descuento del equipo: no se muestra nada y sí «ganarás»', async () => {
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 0, detalles: [] });
    await irAlResumen(true);
    expect(screen.queryByText(/Descuento del equipo/)).not.toBeInTheDocument();
    expect(screen.getByTestId('puntos-estimados').textContent).toMatch(/sumas/);
  });
});
