import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { FormularioCheckout } from '../carta/FormularioCheckout';
import { EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';

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

function ctx(telefono: string | null) {
  return {
    cliente: {
      partyId: '100',
      nombre: 'Ana Torres',
      telefono,
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
    expect(screen.getByText('El teléfono debe tener 9 dígitos y empezar con 9')).toBeInTheDocument();

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
