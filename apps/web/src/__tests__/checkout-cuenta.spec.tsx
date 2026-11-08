import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { FormularioCheckout } from '../carta/FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';
import { api } from '../comun/api';

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

function ctx(telefono: string | null, puntos = 0) {
  return {
    cliente: {
      partyId: '100',
      nombre: 'Ana Torres',
      telefono,
      correo: null,
      cumpleanos: '14/03',
      puntos,
      fotoUrl: null,
    },
    panelAbierto: false,
    abrirPanel: vi.fn(),
    cerrarPanel: vi.fn(),
    ingresar: vi.fn(),
    registrar: vi.fn(),
    salir: vi.fn(),
    refrescar: vi.fn(),
    actualizarPerfil: vi.fn().mockResolvedValue(undefined),
    subirFoto: vi.fn(),
    quitarFoto: vi.fn(),
  };
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

function abrir() {
  render(
    <CarritoProvider>
      <Pagina />
    </CarritoProvider>,
  );
  fireEvent.click(screen.getByText('Abrir pedido'));
}

describe('Pedido con la cuenta iniciada', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no pide nombre ni teléfono: usa los de la cuenta y deja avanzar', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx('987000222'));
    abrir();

    expect(screen.queryByLabelText(/Nombre completo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Teléfono celular/i)).not.toBeInTheDocument();
    expect(screen.getByText('987000222')).toBeInTheDocument();
    expect(screen.getByText(/Ana Torres/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/i)).toBeInTheDocument();
  });

  it('permite usar otro número solo para este pedido y volver al guardado', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx('987000222'));
    abrir();

    fireEvent.click(screen.getByRole('button', { name: /Usar otro número para este pedido/i }));
    const campo = screen.getByLabelText(/Teléfono celular/i);
    expect(campo).toHaveValue('');

    // con el campo vacío no avanza
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByText('Escribe tu celular: 9 dígitos que empiecen con 9')).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Paso 1: Tus datos \(completado\)/i));
    fireEvent.click(screen.getByRole('button', { name: /Usar mi número guardado/i }));
    expect(screen.getByText('987000222')).toBeInTheDocument();
  });

  it('si la cuenta no trae teléfono lo pide, sin DNI ni opción de guardarlo', () => {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx(null));
    abrir();

    expect(screen.queryByLabelText(/Nombre completo/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono celular/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Guardar este número/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/DNI/)).not.toBeInTheDocument();
  });
});

describe('Pago con puntos y resumen de precios', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  // Vista previa del servidor: el producto de 14.50 no tiene promoción, así que es canjeable
  const vistaSinPromo = { descuentoTotal: 0, montoCanjeable: 14.5, puntosEstimados: 0.73, puntosPorcentaje: 5, detalles: [] };
  const vistaConPromo = {
    descuentoTotal: 2.9,
    montoCanjeable: 0,
    puntosEstimados: 0,
    puntosPorcentaje: 5,
    detalles: [{ tipo: 'DESCUENTO', nombre: 'Frappé 20 % esta semana', monto: 2.9 }],
  };

  async function irAPagar(vista: unknown, puntos: number) {
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx('987000222', puntos));
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(ctx('987000222', puntos) as any);
    vi.spyOn(api, 'post').mockResolvedValue(vista as any);
    vi.spyOn(api, 'get').mockResolvedValue({ direcciones: [] } as any);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    // la vista previa llega en asíncrono: se espera a que el resumen tenga las promociones del servidor
    if (vista === vistaConPromo) await screen.findByText('Promociones y descuentos');
    else await screen.findByLabelText(/¿Cuántos puntos deseas usar\?/i);
  }

  it('escribir puntos cambia el Total a pagar sin pulsar Aplicar', async () => {
    await irAPagar(vistaSinPromo, 30);
    vi.useFakeTimers();
    try {
      expect(screen.getAllByText('S/ 14.50').length).toBeGreaterThan(0);

      fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '5' } });
      act(() => vi.advanceTimersByTime(250));

      expect(screen.getAllByText('S/ 9.50').length).toBeGreaterThan(0);
      expect(screen.getByText('Puntos usados')).toBeInTheDocument();
      expect(screen.getAllByText('−S/ 5.00').length).toBeGreaterThan(0);

      fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '' } });
      expect(screen.getAllByText('S/ 14.50').length).toBeGreaterThan(0);
      expect(screen.queryByText('Puntos usados')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('un valor mayor al disponible no cambia el total y muestra el error', async () => {
    await irAPagar(vistaSinPromo, 30);
    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '99' } });
    expect(screen.getByText('Solo tienes 30.00 puntos.')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 14.50').length).toBeGreaterThan(0);
  });

  it('el resumen muestra la línea de promociones con su desglose y nunca descuenta puntos de lo que ya está en promoción', async () => {
    await irAPagar(vistaConPromo, 30);

    expect(screen.getByText('Promociones y descuentos')).toBeInTheDocument();
    expect(screen.getByText('Frappé 20 % esta semana')).toBeInTheDocument();
    expect(screen.getAllByText('−S/ 2.90').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/ 11.60').length).toBeGreaterThan(0);

    // todo el pedido está en promoción: no hay campo de puntos, solo la explicación
    expect(screen.queryByLabelText(/¿Cuántos puntos deseas usar\?/i)).toBeNull();
    expect(screen.getByText(/Se pueden usar desde 1 punto, en productos sin promoción ni descuento/)).toBeInTheDocument();
    expect(screen.queryByText('Puntos usados')).toBeNull();
  });

  it('con cupón aplicado los puntos no se usan: desaparece el canje y el resumen muestra el cupón', async () => {
    const cupon = { cupon: { codigoBase: 'DOS', descripcion: 'S/ 2 de descuento', descuentoCalculado: 2, tipo: 'MONTO', valor: 2 } };
    vi.spyOn(api, 'post').mockImplementation((async (url: string) =>
      url.includes('cupon') ? cupon : vistaSinPromo) as any);
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(ctx('987000222', 30));
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(ctx('987000222', 30) as any);
    vi.spyOn(api, 'get').mockResolvedValue({ direcciones: [] } as any);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Recoger en el local/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    await screen.findByLabelText(/¿Cuántos puntos deseas usar\?/i);

    const campoCupon = document.getElementById('f-cup') as HTMLInputElement;
    fireEvent.change(campoCupon, { target: { value: 'dos' } });
    fireEvent.click(campoCupon.closest('div')!.querySelector('button')!);

    await screen.findByText('Cupón DOS');
    expect(screen.queryByLabelText(/¿Cuántos puntos deseas usar\?/i)).toBeNull();
    expect(screen.queryByText('Puntos usados')).toBeNull();
    expect(screen.getAllByText('−S/ 2.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/ 12.50').length).toBeGreaterThan(0);
  });
});
