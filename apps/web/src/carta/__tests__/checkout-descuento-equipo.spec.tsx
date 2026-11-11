import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../comun/api';
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

describe('Checkout ▸ descuento del equipo por celular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      throw new Error(`ruta no esperada: ${ruta}`);
    });
  });

  const respuestaEquipo = { descuentoTotal: 3.63, detalles: [{ tipo: 'PERSONAL', nombre: 'Descuento por ser del equipo (25 %)', monto: 3.63 }] };

  it('celular completo de un trabajador activo: manda solo el celular (nunca un porcentaje) y muestra el mensaje y la línea', async () => {
    vi.mocked(api.post).mockResolvedValue(respuestaEquipo);
    abrirPedido(false);
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    expect(await screen.findByText(/Tienes 25 % de descuento por ser parte del equipo Caprichos/)).toBeInTheDocument();
    const llamada = vi.mocked(api.post).mock.calls.filter(([r]) => r === '/carta/descuentos/vista-previa').pop()!;
    expect(llamada[1]).toMatchObject({ celular: '912345678' });
    expect(JSON.stringify(llamada[1])).not.toMatch(/pct|porcentaje/i);
  });

  it('sin descuento del equipo no se muestra nada y con celular incompleto no se consulta con celular', async () => {
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 0, detalles: [] });
    abrirPedido(false);
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '91234' } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(screen.queryByText(/parte del equipo Caprichos/)).not.toBeInTheDocument();
    for (const [r, cuerpo] of vi.mocked(api.post).mock.calls) {
      if (r === '/carta/descuentos/vista-previa') expect(cuerpo).not.toHaveProperty('celular');
    }
  });
});
