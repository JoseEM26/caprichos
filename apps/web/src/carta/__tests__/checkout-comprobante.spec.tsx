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

/** Datos del local con la propina de la carta encendida (o apagada) y su tope. */
const datos = (cartaActiva: boolean): DatosLocalCarta => ({
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
  propina: { carta: cartaActiva, bot: false, tope: 50 },
});

function Pagina({ cartaActiva }: { cartaActiva: boolean }) {
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
      <FormularioCheckout estadoLocal={estado} datosLocal={datos(cartaActiva)} />
    </div>
  );
}

function abrirPedido(cartaActiva: boolean, conSesion = false) {
  const ctx = conSesion ? ({ cliente: { partyId: '1', nombre: 'Luis', telefono: '912345678', puntos: 0 }, abrirPanel: vi.fn() } as any) : null;
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx);
  if (ctx) vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(ctx);
  render(
    <CarritoProvider>
      <Pagina cartaActiva={cartaActiva} />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

/** Desde el paso 1: recoger en el local y datos de la persona; sigue hasta el paso de pago (donde va la propina). */
async function irAPago() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Luis' } });
  fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByRole('button', { name: /Enviar pedido/i })).toBeInTheDocument();
}

/** Con sesión no se pide nombre ni celular: el paso 1 solo elige la modalidad. */
async function irAPagoConSesion() {
  fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByLabelText(/Paso 2: Ubicación \(actual\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
  expect(await screen.findByRole('button', { name: /Enviar pedido/i })).toBeInTheDocument();
}

const comprobanteEnviado = () => (vi.mocked(api.post).mock.calls.find((c) => c[0] === '/pedidos')?.[1] as any)?.comprobante;

describe('Checkout de la carta ▸ comprobante simple, boleta o factura', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (ruta: string) => {
      throw new Error(`ruta no esperada: ${ruta}`);
    });
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('TEST', 'cortado a propósito', 400));
  });

  it('ofrece las tres opciones con «Comprobante simple» elegido y sin pedir documento', async () => {
    abrirPedido(false);
    await irAPago();
    expect(screen.getByRole('button', { name: 'Comprobante simple' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Boleta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Factura' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/DNI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/RUC/i)).not.toBeInTheDocument();
  });

  it('simple envía solo el tipo SIMPLE (sin DNI ni RUC)', async () => {
    abrirPedido(false);
    await irAPago();
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() => expect(comprobanteEnviado()).toBeDefined());
    expect(comprobanteEnviado()).toEqual({ tipo: 'SIMPLE', dni: undefined, ruc: undefined, razonSocial: undefined });
  });

  it('boleta pide el DNI (opcional, 8 dígitos) y lo envía', async () => {
    abrirPedido(false);
    await irAPago();
    fireEvent.click(screen.getByRole('button', { name: 'Boleta' }));
    fireEvent.change(screen.getByLabelText(/DNI/i), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() => expect(comprobanteEnviado()).toBeDefined());
    expect(comprobanteEnviado()).toMatchObject({ tipo: 'BOLETA', dni: '12345678' });
  });

  it('factura exige RUC con prefijo válido y razón social; con datos buenos los envía', async () => {
    abrirPedido(false);
    await irAPago();
    fireEvent.click(screen.getByRole('button', { name: 'Factura' }));
    fireEvent.change(screen.getByLabelText(/RUC/i), { target: { value: '30123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    expect(await screen.findByText(/RUC válido de 11 dígitos/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith('/pedidos', expect.anything(), expect.anything());

    fireEvent.change(screen.getByLabelText(/RUC/i), { target: { value: '20131312955' } });
    fireEvent.change(await screen.findByLabelText(/Razón social/i), { target: { value: 'Acme SAC' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
    await waitFor(() => expect(comprobanteEnviado()).toBeDefined());
    expect(comprobanteEnviado()).toMatchObject({ tipo: 'FACTURA', ruc: '20131312955', razonSocial: 'Acme SAC' });
  });

  describe('RUC guardado en la cuenta', () => {
    const conRucGuardado = () =>
      vi.mocked(api.get).mockImplementation(async (ruta: string) => {
        if (ruta === '/carta/cuenta/facturacion') return { facturacion: { ruc: '20000000015' } } as any;
        return { ruc: '20000000015', razon_social: 'EMPRESA PRUEBA SAC', estado: 'ACTIVO', condicion: 'HABIDO', direccion: null, desactualizado: false } as any;
      });

    it('con sesión: al elegir Factura el RUC aparece puesto y se puede cambiar', async () => {
      conRucGuardado();
      abrirPedido(false, true);
      await irAPagoConSesion();
      fireEvent.click(screen.getByRole('button', { name: 'Factura' }));
      await waitFor(() => expect(screen.getByLabelText(/RUC/i)).toHaveValue('20000000015'));
      expect(screen.getByText(/RUC guardado en tu cuenta/)).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/carta/cuenta/facturacion');
      fireEvent.change(screen.getByLabelText(/RUC/i), { target: { value: '2013131295' } });
      expect(screen.getByLabelText(/RUC/i)).toHaveValue('2013131295');
    });

    it('sin sesión: nunca consulta el RUC guardado (no se obtiene tecleando un celular)', async () => {
      conRucGuardado();
      abrirPedido(false);
      await irAPago();
      fireEvent.click(screen.getByRole('button', { name: 'Factura' }));
      fireEvent.change(screen.getByLabelText(/RUC/i), { target: { value: '2013131295' } });
      expect(api.get).not.toHaveBeenCalledWith('/carta/cuenta/facturacion');
    });

    it('el celular se pide ANTES que el RUC (en el orden de la página)', async () => {
      abrirPedido(false);
      // el celular está en el paso 1; la factura, en el de pago: el celular ya quedó puesto antes
      fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
      const tel = screen.getByLabelText(/Teléfono celular/i);
      await irAPago();
      expect(tel).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Factura' }));
      expect(screen.getByLabelText(/RUC/i)).toBeInTheDocument();
    });
  });

  describe('factura con consulta de RUC a SUNAT', () => {
    const sunat = (extra: object = {}) => ({
      ruc: '20131312955', razon_social: 'SUNAT SA', estado: 'ACTIVO', condicion: 'HABIDO', direccion: 'AV. X 123', desactualizado: false, ...extra,
    });
    const escribirRuc = async () => {
      abrirPedido(false);
      await irAPago();
      fireEvent.click(screen.getByRole('button', { name: 'Factura' }));
      fireEvent.change(screen.getByLabelText(/RUC/i), { target: { value: '20131312955' } });
    };

    it('muestra la razón social de SUNAT como solo lectura y la envía con la dirección fiscal', async () => {
      vi.mocked(api.get).mockResolvedValue(sunat());
      await escribirRuc();
      expect(await screen.findByTestId('razon-verificada')).toHaveTextContent('SUNAT SA');
      expect(screen.getByText(/Verificado en SUNAT/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Razón social/i)).not.toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/carta/ruc/20131312955');
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
      await waitFor(() => expect(comprobanteEnviado()).toBeDefined());
      expect(comprobanteEnviado()).toMatchObject({ tipo: 'FACTURA', ruc: '20131312955', razonSocial: 'SUNAT SA', direccion: 'AV. X 123' });
    });

    it('avisa sin bloquear cuando el RUC no está activo o habido', async () => {
      vi.mocked(api.get).mockResolvedValue(sunat({ estado: 'BAJA DE OFICIO', condicion: 'NO HABIDO' }));
      await escribirRuc();
      expect(await screen.findByText(/la factura podría no ser válida/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
      await waitFor(() => expect(comprobanteEnviado()).toBeDefined());
    });

    it('si SUNAT no está disponible permite escribir la razón social, marcada sin verificar', async () => {
      vi.mocked(api.get).mockRejectedValue(new ErrorApi('RUC_NO_DISPONIBLE', 'no disponible', 503));
      await escribirRuc();
      fireEvent.change(await screen.findByLabelText(/Razón social/i), { target: { value: 'Mi Empresa' } });
      expect(screen.getByText(/Sin verificar/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
      await waitFor(() => expect(comprobanteEnviado()).toMatchObject({ razonSocial: 'Mi Empresa' }));
    });

    it('un RUC que SUNAT no reconoce bloquea el envío', async () => {
      vi.mocked(api.get).mockRejectedValue(new ErrorApi('RUC_NO_ENCONTRADO', 'no', 404));
      await escribirRuc();
      expect(await screen.findByText(/SUNAT no reconoce este RUC: revísalo\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/i }));
      expect(comprobanteEnviado()).toBeUndefined();
    });
  });
});
