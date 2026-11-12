import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

function abrirPedido(equipo: { esEquipo: true; puedeCredito: boolean } | null, conSesion = true) {
  const ctx = conSesion
    ? ({ cliente: { partyId: '1', nombre: 'Luis', telefono: '912345678', puntos: 0 }, equipo, abrirPanel: vi.fn() } as any)
    : null;
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx);
  if (ctx) vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(ctx);
  render(
    <CarritoProvider>
      <Pagina invitadoPermitido={false} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

async function irAlPago(equipo: { esEquipo: true; puedeCredito: boolean } | null, conSesion = true) {
  abrirPedido(equipo, conSesion);
  if (!conSesion) {
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  }
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/);
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  await screen.findByRole('button', { name: /Enviar pedido/i });
}

describe('Checkout ▸ pago del equipo (contado o crédito del personal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      if (ruta.startsWith('/carta/envio')) return { cubierto: true, zona: 'Z1', tarifa: 5, tarifaZona: 5, gratisDesde: 70, modoGratis: 'mas_de' };
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 3.63, puntosEstimados: 0, detalles: [{ tipo: 'PERSONAL', nombre: 'Descuento por ser del equipo (25 %)', monto: 3.63 }] });
  });

  it('cliente común o sin sesión: no se muestra nada del equipo', async () => {
    await irAlPago(null);
    expect(screen.queryByTestId('selector-pago-equipo')).not.toBeInTheDocument();
    expect(screen.queryByText(/crédito del personal/i)).not.toBeInTheDocument();
  });

  it('equipo: muestra las dos opciones; al contado conserva medio de pago y comprobante', async () => {
    await irAlPago({ esEquipo: true, puedeCredito: true });
    expect(screen.getByRole('radio', { name: /Pagar al contado/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Cargar a mi crédito del personal/i })).toBeEnabled();
    expect(screen.getByText('Medio de pago')).toBeInTheDocument();
    expect(screen.getByText('Comprobante de pago')).toBeInTheDocument();
  });

  it('crédito: oculta medio de pago y comprobante y muestra el resumen', async () => {
    await irAlPago({ esEquipo: true, puedeCredito: true });
    fireEvent.click(screen.getByRole('radio', { name: /Cargar a mi crédito del personal/i }));
    expect(screen.queryByText('Medio de pago')).not.toBeInTheDocument();
    expect(screen.queryByText('Comprobante de pago')).not.toBeInTheDocument();
    expect(screen.getByTestId('resumen-credito-equipo').textContent).toMatch(/Se carga a tu crédito: S\/ \d+\.\d{2}/);
  });

  it('sin vínculo (puedeCredito falso): la opción de crédito sale deshabilitada con su explicación', async () => {
    await irAlPago({ esEquipo: true, puedeCredito: false });
    expect(screen.getByRole('radio', { name: /Cargar a mi crédito del personal/i })).toBeDisabled();
    expect(screen.getByText(/vincule tu cuenta/i)).toBeInTheDocument();
  });

  it('al enviar a crédito manda pagoEquipo=CREDITO sin medio de pago real ni porcentaje', async () => {
    await irAlPago({ esEquipo: true, puedeCredito: true });
    fireEvent.click(screen.getByRole('radio', { name: /Cargar a mi crédito del personal/i }));
    vi.mocked(api.post).mockResolvedValue({ id: '1', codigo: 'CP-W001', estado: 'COLA', subtotal: 14.5, total: 10.87, seguimientoToken: 't' });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await vi.waitFor(() => expect(vi.mocked(api.post).mock.calls.some(([r]) => r === '/pedidos')).toBe(true));
    const cuerpo = vi.mocked(api.post).mock.calls.find(([r]) => r === '/pedidos')![1] as any;
    expect(cuerpo.pagoEquipo).toBe('CREDITO');
    expect(cuerpo.comprobante).toEqual({ tipo: 'SIMPLE' });
    expect(JSON.stringify(cuerpo)).not.toMatch(/pct|porcentaje|colaborador/i);
  });
});
