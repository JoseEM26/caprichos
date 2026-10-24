import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CarritoProvider, useCarrito } from '../carta/CarritoContext';
import { VentanaProducto } from '../carta/VentanaProducto';
import { FormularioCheckout } from '../carta/FormularioCheckout';
import { CajonCarrito } from '../carta/CajonCarrito';
import { ProductoCarta, EstadoLocalCarta, DatosLocalCarta } from '../carta/tipos';
import { api } from '../comun/api';
import { calcularPrecioLinea, calcularTotalPedido } from '@caprichos/compartido';
import * as cuentaModulo from '../carta/cuenta/CuentaContext';
import { PuntosCanje } from '../carta/cuenta/PuntosCanje';

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
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), {
      target: { value: 'Carlos Mendoza' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), {
      target: { value: '987654321' },
    });

    // Elegir modalidad Recoger para no pedir dirección
    fireEvent.click(screen.getByText('Recoger en el local'));

    // Avanzar paso 1 -> paso 2 -> paso 3
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    const btnEnviar = screen.getByRole('button', { name: /Enviar pedido/i });

    // Dos toques rápidos consecutivos
    fireEvent.click(btnEnviar);
    fireEvent.click(btnEnviar);

    const envios = () => postSpy.mock.calls.filter((c) => c[0] === '/pedidos');
    await waitFor(() => {
      expect(envios()).toHaveLength(1);
    });

    // Verificar que la cabecera Idempotency-Key fue enviada
    const callArgs = envios()[0];
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
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), {
      target: { value: 'Empresa Demo SAC' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), {
      target: { value: '987654321' },
    });
    fireEvent.click(screen.getByText('Recoger en el local'));

    // Avanzar paso 1 -> paso 2 -> paso 3 (Pago)
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // Seleccionar Factura en paso 3
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
    expect(postSpy.mock.calls.filter((c) => c[0] === '/pedidos')).toHaveLength(0);
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
    expect(postSpy.mock.calls.filter((c) => c[0] === '/pedidos')).toHaveLength(0);
  });
});

describe('Carta ▸ puntos (reglas vigentes)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invitado ve el texto de puntos sin «1 punto = S/ 1» y dice que no vencen', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ descuentoTotal: 0, detalles: [] });

    function WrapperPuntos() {
      const { agregarLinea, abrirCheckout } = useCarrito();
      return (
        <div>
          <button
            onClick={() => {
              agregarLinea({
                productoId: 'prod-1',
                nombre: 'Postre',
                precioBase: 8,
                cantidad: 1,
                opciones: [],
                precioUnitario: 8,
                subtotal: 8,
              });
              abrirCheckout();
            }}
          >
            Preparar pedido
          </button>
          <FormularioCheckout estadoLocal={estadoAbierto} datosLocal={datosLocalEjemplo} />
        </div>
      );
    }

    render(
      <CarritoProvider>
        <WrapperPuntos />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Preparar pedido'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.click(screen.getByRole('button', { name: /¿Cómo funcionan los puntos\?/i }));

    expect(screen.getByText(/no vencen/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/1 punto = S\/ 1/);
  });

  it('PuntosCanje rechaza más puntos que el monto canjeable', () => {
    const alAplicar = vi.fn();
    vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({
      cliente: {
        partyId: '100',
        nombre: 'Ana',
        telefono: '987654321',
        dniMascara: '4521****',
        correo: 'ana@ejemplo.com',
        cumpleanos: '14/03',
        puntos: 30,
        fotoUrl: null,
      },
      panelAbierto: false,
      abrirPanel: vi.fn(),
      cerrarPanel: vi.fn(),
      ingresar: vi.fn(),
      registrar: vi.fn(),
      salir: vi.fn(),
      refrescar: vi.fn(),
      actualizarPerfil: vi.fn(),
      subirFoto: vi.fn(),
      quitarFoto: vi.fn(),
    });

    // totalPedido es el monto canjeable (sin promos ni descuentos)
    render(<PuntosCanje totalPedido={12} puntosAplicados={0} alAplicar={alAplicar} />);

    fireEvent.change(screen.getByLabelText(/¿Cuántos puntos deseas usar\?/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(alAplicar).not.toHaveBeenCalled();
    expect(
      screen.getByText('Solo puedes usar hasta S/ 12.00 en puntos: se aplican a productos sin promoción ni descuento.'),
    ).toBeInTheDocument();
  });
});

describe('Checkout por apartados y mapa a pantalla completa (Mejoras 1 y 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function WrapperCheckout() {
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
          Iniciar Checkout
        </button>
        <FormularioCheckout
          estadoLocal={estadoAbierto}
          datosLocal={datosLocalEjemplo}
        />
      </div>
    );
  }

  it('indicador de pasos refleja paso actual y completados, y permite volver tocando el círculo', async () => {
    render(
      <CarritoProvider>
        <WrapperCheckout />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Iniciar Checkout'));

    // Paso 1 actual
    const paso1Btn = screen.getByLabelText(/Paso 1: Tus datos \(actual\)/i);
    expect(paso1Btn).toBeInTheDocument();
    expect(paso1Btn).toHaveAttribute('aria-current', 'step');

    // Paso 2 y 3 pendientes
    const paso2Btn = screen.getByLabelText(/Paso 2: Ubicación/i);
    expect(paso2Btn).toBeDisabled();

    // Completar paso 1
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Lucía Pérez' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '987654321' } });

    // Avanzar a paso 2
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // Ahora paso 2 es actual y paso 1 completado
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/i)).toBeInTheDocument();
    const paso1Completado = screen.getByLabelText(/Paso 1: Tus datos \(completado\)/i);
    expect(paso1Completado).toBeInTheDocument();
    expect(paso1Completado).not.toBeDisabled();

    // Tocar el círculo del paso 1 completado vuelve a él
    fireEvent.click(paso1Completado);
    expect(screen.getByLabelText(/Paso 1: Tus datos \(actual\)/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lucía Pérez')).toBeInTheDocument();
  });

  it('no se puede avanzar con datos inválidos y se muestra el error en su apartado', async () => {
    render(
      <CarritoProvider>
        <WrapperCheckout />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Iniciar Checkout'));

    // Sin elegir invitado ni cuenta
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByText('Elige si ingresas con tu cuenta o continúas como invitado')).toBeInTheDocument();

    // Con invitado pero sin nombre
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();

    // Con teléfono inválido
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Mateo' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(screen.getByText('El teléfono debe tener 9 dígitos y empezar con 9')).toBeInTheDocument();

    // Corregir teléfono y avanzar a Paso 2 en Delivery sin dirección
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

    // Ahora en paso 2 sin dirección ni coordenadas
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));
    expect(
      screen.getByText('Para delivery debes indicar una dirección de al menos 5 caracteres o usar tu ubicación'),
    ).toBeInTheDocument();
  });

  it('Atrás conserva lo escrito en los apartados', async () => {
    render(
      <CarritoProvider>
        <WrapperCheckout />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Iniciar Checkout'));

    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Rodrigo Torres' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '998877665' } });

    // Avanzar a paso 2
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // Escribir dirección y referencia
    fireEvent.change(screen.getByLabelText(/Dirección escrita/i), { target: { value: 'Calle Los Robles 450' } });
    fireEvent.change(screen.getByLabelText(/Referencia/i), { target: { value: 'Casa con reja negra' } });

    // Presionar Atrás
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));

    // Volver a paso 1: conserva nombre y teléfono
    expect(screen.getByLabelText(/Paso 1: Tus datos \(actual\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre completo/i)).toHaveValue('Rodrigo Torres');
    expect(screen.getByLabelText(/Teléfono celular/i)).toHaveValue('998877665');

    // Volver a avanzar a paso 2: conserva dirección y referencia
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    expect(screen.getByLabelText(/Paso 2: Ubicación \(actual\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dirección escrita/i)).toHaveValue('Calle Los Robles 450');
    expect(screen.getByLabelText(/Referencia/i)).toHaveValue('Casa con reja negra');
  });

  it('«Marcar en el mapa» abre la pantalla completa con el marcador de la tienda y «Confirmar ubicación» la cierra con el punto confirmado', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/carta/direcciones')) {
        return {
          resultados: [
            { texto: 'Av. Campoy 450, San Juan de Lurigancho', lat: -12.019, lng: -76.963 },
          ],
          apagado: false,
        };
      }
      if (url.includes('/carta/envio')) {
        return { cubierto: true, zona: 'Zona Campoy', tarifa: 4.5, gratisDesde: 50 };
      }
      return {};
    });

    render(
      <CarritoProvider>
        <WrapperCheckout />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Iniciar Checkout'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Mariana' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '987112233' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // En paso 2 tocar «Marcar en el mapa»
    fireEvent.click(screen.getByRole('button', { name: /Marcar en el mapa/i }));

    // Se abre la ventana a pantalla completa
    const modalMapa = screen.getByRole('dialog', { name: 'Marca dónde recibes tu pedido' });
    expect(modalMapa).toBeInTheDocument();
    expect(screen.getByText('Marca dónde recibes tu pedido')).toBeInTheDocument();
    expect(screen.getByLabelText('Cerrar mapa')).toBeInTheDocument();

    // Marcador de la tienda visible en el mapa
    expect(modalMapa.textContent).toContain('Caprichos');
    expect(modalMapa.textContent).toContain(datosLocalEjemplo.direccion);

    // Botón confirmar deshabilitado hasta que haya punto
    const btnConfirmar = screen.getByRole('button', { name: /Confirmar ubicación/i });
    expect(btnConfirmar).toBeDisabled();

    // Seleccionar dirección en el buscador
    const inputBuscar = screen.getByLabelText(/Buscar dirección/i);
    fireEvent.change(inputBuscar, { target: { value: 'Av. Campoy' } });

    const optResult = await screen.findByRole('button', { name: /Av. Campoy 450/i });
    fireEvent.click(optResult);

    // Ahora punto confirmado habilitado
    await waitFor(() => {
      expect(btnConfirmar).not.toBeDisabled();
    });

    // Confirmar ubicación cierra la pantalla completa y marca confirmada en el formulario
    fireEvent.click(btnConfirmar);
    expect(screen.queryByRole('dialog', { name: 'Marca dónde recibes tu pedido' })).not.toBeInTheDocument();
    expect(screen.getByText('Ubicación confirmada')).toBeInTheDocument();
  });

  it('recoger muestra la tienda en un mapa pequeño de solo lectura con su dirección', async () => {
    render(
      <CarritoProvider>
        <WrapperCheckout />
      </CarritoProvider>,
    );

    fireEvent.click(screen.getByText('Iniciar Checkout'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar como invitado/i }));
    fireEvent.change(screen.getByLabelText(/Nombre completo/i), { target: { value: 'Diego' } });
    fireEvent.change(screen.getByLabelText(/Teléfono celular/i), { target: { value: '912345678' } });

    // Elegir recoger
    fireEvent.click(screen.getByText('Recoger en el local'));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

    // En paso 2 muestra «Recoges en Caprichos» y mapa con la dirección de la tienda
    expect(screen.getByText('Recoges en Caprichos')).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(datosLocalEjemplo.direccion)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('application', { name: 'Ubicación de Caprichos para recoger' })).toBeInTheDocument();
    // No hay botones de marcar en el mapa ni dirección escrita
    expect(screen.queryByText(/Marcar en el mapa/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Dirección escrita/i)).not.toBeInTheDocument();
  });
});
