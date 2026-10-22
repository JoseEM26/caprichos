import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { VentanaProducto } from '../carta/VentanaProducto';
import { FormularioCheckout } from '../carta/FormularioCheckout';
import { CajonCarrito } from '../carta/CajonCarrito';
import { ProductoCarta, EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import { api } from '../comun/api';
import { calcularPrecioLinea, calcularTotalPedido } from '@caprichos/compartido';

const productoEjemplo: ProductoCarta = {
  id: 'prod-1',
  nombre: 'Frappé Clásico',
  descripcion: 'Café batido con hielo y leche',
  fotoUrl: null,
  precio: 14.5,
  tamanos: [
    { id: 'tam-1', nombre: 'Regular 12 oz', precio: 14.5 },
    { id: 'tam-2', nombre: 'Grande 16 oz', precio: 17.0 },
  ],
  grupos: [
    {
      id: 'grp-leche',
      nombre: 'Tipo de leche',
      obligatorio: true,
      minimo: 1,
      maximo: 1,
      opciones: [
        { id: 'op-entera', nombre: 'Leche entera', precioExtra: 0, disponible: true },
        { id: 'op-almendra', nombre: 'Leche de almendras', precioExtra: 3.0, disponible: true },
      ],
    },
    {
      id: 'grp-extras',
      nombre: 'Extras',
      obligatorio: false,
      minimo: 0,
      maximo: 2,
      opciones: [
        { id: 'op-chantilly', nombre: 'Crema chantilly', precioExtra: 2.0, disponible: true },
        { id: 'op-fudge', nombre: 'Fudge de chocolate', precioExtra: 1.5, disponible: true },
      ],
    },
  ],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

const estadoAbierto: EstadoLocalCarta = {
  abierta: true,
  motivo: 'OK',
  texto: 'Abierto',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: 25,
  altaDemandaMin: 0,
};

const estadoCerrado: EstadoLocalCarta = {
  abierta: false,
  motivo: 'HORARIO',
  texto: 'Cerrado por hoy',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: null,
  altaDemandaMin: 0,
};

const datosLocalEjemplo: DatosLocalCarta = {
  nombre: 'Caprichos',
  direccion: 'Av. Las Delicias 123',
  telefono: '999888777',
  whatsapp: '999888777',
  redes: {},
  horario: [],
  mediosPago: {
    yape: { activo: true, numero: '999888777' },
    efectivo: { activo: true },
  },
  envioGratisDesde: 70,
  pedidoMinimo: 14.5,
};

describe('Pruebas de la Carta Pública (front-carta)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Precio calculado con opciones
  it('1. calcula precio unitario y subtotal con opciones extras en vivo', () => {
    // Prueba directa de la función compartida
    const linea = calcularPrecioLinea({
      precioBase: 17.0, // Grande
      opciones: [{ precioExtra: 3.0 }, { precioExtra: 2.0 }], // Almendras + Chantilly
      cantidad: 2,
    });
    // 17.0 + 3.0 + 2.0 = 22.0 * 2 = 44.0
    expect(linea.precioUnitario).toBe(22.0);
    expect(linea.subtotal).toBe(44.0);

    const total = calcularTotalPedido({ subtotal: linea.subtotal, envio: 5.0 });
    expect(total).toBe(49.0);

    // Prueba en el componente VentanaProducto
    render(
      <CarritoProvider>
        <VentanaProducto producto={productoEjemplo} onCerrar={() => {}} />
      </CarritoProvider>,
    );

    // Inicialmente Regular 12 oz (14.50)
    expect(screen.getAllByText('S/ 14.50').length).toBeGreaterThan(0);

    // Selecciona leche de almendras (+S/ 3.00)
    fireEvent.click(screen.getByText('Leche de almendras'));
    // 14.50 + 3.00 = 17.50
    expect(screen.getAllByText('S/ 17.50').length).toBeGreaterThan(0);

    // Selecciona tamaño Grande 16 oz (17.00)
    fireEvent.click(screen.getByText('Grande 16 oz'));
    // 17.00 + 3.00 = 20.00
    expect(screen.getAllByText('S/ 20.00').length).toBeGreaterThan(0);

    // Agrega extra Chantilly (+S/ 2.00)
    fireEvent.click(screen.getByText('Crema chantilly'));
    // 20.00 + 2.00 = 22.00
    expect(screen.getAllByText('S/ 22.00').length).toBeGreaterThan(0);

    // Aumenta cantidad a 2 (+)
    fireEvent.click(screen.getByLabelText('Aumentar cantidad'));
    // 22.00 * 2 = 44.00
    expect(screen.getAllByText('S/ 44.00').length).toBeGreaterThan(0);
  });

  // 2. No deja agregar con un grupo obligatorio vacío
  it('2. no deja agregar al pedido si falta un grupo obligatorio y muestra aviso', () => {
    const fnCerrar = vi.fn();

    render(
      <CarritoProvider>
        <VentanaProducto producto={productoEjemplo} onCerrar={fnCerrar} />
      </CarritoProvider>,
    );

    // No se seleccionó leche aún (es obligatorio)
    const btnAgregar = screen.getByText('Agregar al pedido');
    fireEvent.click(btnAgregar);

    // Debe mostrar alerta de validación
    expect(
      screen.getByText(/El grupo "Tipo de leche" es obligatorio/),
    ).toBeInTheDocument();

    // No debe haber cerrado la ventana
    expect(fnCerrar).not.toHaveBeenCalled();

    // Ahora selecciona la opción obligatoria
    fireEvent.click(screen.getByText('Leche entera'));

    // Ahora sí agrega
    fireEvent.click(btnAgregar);
    expect(fnCerrar).toHaveBeenCalledTimes(1);
  });

  // 3. Carrito persistente en sessionStorage
  it('3. persiste las líneas del carrito en sessionStorage y las recupera', () => {
    function ComponentePrueba() {
      const { lineas, agregarLinea, subtotal } = useCarrito();
      return (
        <div>
          <span data-testid="lineas-count">{lineas.length}</span>
          <span data-testid="subtotal">{subtotal}</span>
          <button
            onClick={() =>
              agregarLinea({
                productoId: 'prod-1',
                nombre: 'Frappé Clásico',
                precioBase: 14.5,
                cantidad: 1,
                opciones: [],
                precioUnitario: 14.5,
                subtotal: 14.5,
              })
            }
          >
            Agregar
          </button>
        </div>
      );
    }

    const { unmount } = render(
      <CarritoProvider>
        <ComponentePrueba />
      </CarritoProvider>,
    );

    expect(screen.getByTestId('lineas-count').textContent).toBe('0');

    // Agregar un producto
    fireEvent.click(screen.getByText('Agregar'));
    expect(screen.getByTestId('lineas-count').textContent).toBe('1');
    expect(screen.getByTestId('subtotal').textContent).toBe('14.5');

    // Verificar que se guardó en sessionStorage
    const enStorage = sessionStorage.getItem('caprichos_carrito');
    expect(enStorage).toBeTruthy();
    const parseado = JSON.parse(enStorage!);
    expect(parseado).toHaveLength(1);
    expect(parseado[0].nombre).toBe('Frappé Clásico');

    // Desmontar y volver a montar un nuevo CarritoProvider para simular recarga
    unmount();

    render(
      <CarritoProvider>
        <ComponentePrueba />
      </CarritoProvider>,
    );

    // Recupera la línea de sessionStorage
    expect(screen.getByTestId('lineas-count').textContent).toBe('1');
    expect(screen.getByTestId('subtotal').textContent).toBe('14.5');
  });

  // 4. Idempotency-Key (dos toques = una sola petición)
  it('4. previene doble envío ante toques repetidos y manda cabecera Idempotency-Key', async () => {
    const postSpy = vi.spyOn(api, 'post').mockImplementation(async () => {
      // Simula latencia
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        id: '123',
        codigo: 'PED-001',
        estado: 'PENDIENTE',
        subtotal: 14.5,
        envio: 0,
        total: 14.5,
        mensaje: 'Un asesor te escribirá para coordinar el pago',
      };
    });

    function WrapperPrueba() {
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
            Preparar pedido
          </button>
          <FormularioCheckout
            estadoLocal={estadoAbierto}
            datosLocal={datosLocalEjemplo}
          />
        </div>
      );
    }

    render(
      <CarritoProvider>
        <WrapperPrueba />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Preparar pedido'));

    // Llenar datos de contacto válidos
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), {
      target: { value: 'Carlos Mendoza' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), {
      target: { value: '987654321' },
    });

    // Elegir modalidad Recoger para no pedir dirección
    fireEvent.click(screen.getByText('Recoger en el local'));

    const btnEnviar = screen.getByRole('button', { name: /Enviar pedido/i });

    // Dos toques rápidos consecutivos
    fireEvent.click(btnEnviar);
    fireEvent.click(btnEnviar);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    // Verificar que la cabecera Idempotency-Key fue enviada
    const callArgs = postSpy.mock.calls[0];
    expect(callArgs[0]).toBe('/pedidos');
    expect(callArgs[2]?.headers).toHaveProperty('Idempotency-Key');
  });

  // 5. Factura con RUC inválido (10 dígitos)
  it('5. rechaza comprobante Factura con RUC de 10 dígitos y no envía la petición', async () => {
    const postSpy = vi.spyOn(api, 'post');

    function WrapperFactura() {
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
            Preparar factura
          </button>
          <FormularioCheckout
            estadoLocal={estadoAbierto}
            datosLocal={datosLocalEjemplo}
          />
        </div>
      );
    }

    render(
      <CarritoProvider>
        <WrapperFactura />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Preparar factura'));

    // Llenar datos de cliente válidos
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), {
      target: { value: 'Empresa Demo SAC' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), {
      target: { value: '987654321' },
    });
    fireEvent.click(screen.getByText('Recoger en el local'));

    // Seleccionar Factura
    fireEvent.click(screen.getByRole('button', { name: 'Factura' }));

    // Ingresar RUC inválido de 10 dígitos
    fireEvent.change(screen.getByLabelText(/RUC \(11 dígitos/i), {
      target: { value: '2012345678' }, // 10 dígitos
    });
    fireEvent.change(screen.getByLabelText(/Razón social/i), {
      target: { value: 'Empresa Demo SAC' },
    });

    const btnEnviar = screen.getByRole('button', { name: /Enviar pedido/i });
    fireEvent.click(btnEnviar);

    // Debe mostrar error indicando que un RUC de 10 dígitos no se acepta
    expect(
      screen.getByText(/un RUC de 10 dígitos no se acepta/i),
    ).toBeInTheDocument();

    // La API NO debió ser llamada
    expect(postSpy).not.toHaveBeenCalled();
  });

  // 6. Carta cerrada bloquea el envío
  it('6. carta cerrada bloquea el envío de pedidos con advertencia clara', async () => {
    const postSpy = vi.spyOn(api, 'post');

    function WrapperCerrado() {
      const { agregarLinea, abrirCajon } = useCarrito();
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
              abrirCajon();
            }}
          >
            Ver carrito
          </button>
          <CajonCarrito estadoLocal={estadoCerrado} />
        </div>
      );
    }

    render(
      <CarritoProvider>
        <WrapperCerrado />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Ver carrito'));

    // En el cajón del carrito debe mostrar la advertencia
    expect(
      screen.getByText(/El local está cerrado \(Cerrado por hoy\): no se pueden enviar pedidos/),
    ).toBeInTheDocument();

    // El botón de continuar está deshabilitado
    const btnContinuar = screen.getByRole('button', {
      name: /Carta cerrada para pedidos/i,
    });
    expect(btnContinuar).toBeDisabled();

    // No se llama a la API
    expect(postSpy).not.toHaveBeenCalled();
  });
});
