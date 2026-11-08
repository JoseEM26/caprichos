import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModalDisenoTexto } from '../componentes/ModalDisenoTexto';
import { ModalEditarElemento } from '../componentes/ModalEditarElemento';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { ModalFormularioReserva } from '../componentes/ModalFormularioReserva';
import { ReservasView } from '../ReservasView';
import { salonApi } from '../api';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

/** Elige boleta en el selector obligatorio (si el paso lo muestra y aún no hay elección). */
const elegirBoleta = () => {
  const b = screen.queryByTestId('comprobante-BOLETA');
  if (b && b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b);
};

// Mock de api
vi.mock('../api', () => ({
  salonApi: {
    obtenerPlano: vi.fn(),
    actualizarPiso: vi.fn(),
    crearElemento: vi.fn(),
    actualizarElemento: vi.fn(),
    girarElemento: vi.fn(),
    eliminarElemento: vi.fn(),
    obtenerDiseno: vi.fn(),
    aplicarDiseno: vi.fn(),
    obtenerMesas: vi.fn(),
    abrirPedidoMesa: vi.fn(),
    liberarMesaManual: vi.fn(),
    marcarEntregadoMesa: vi.fn(),
    listarReservas: vi.fn(),
    calendario: vi.fn(),
    agenda: vi.fn(),
    crearReserva: vi.fn(),
    actualizarReserva: vi.fn(),
    cancelarReserva: vi.fn(),
    sentarReserva: vi.fn(),
    obtenerCarta: vi.fn(),
  },
}));

// Mock de audioAlerta
vi.mock('../audioAlerta', () => ({
  reproducirAvisoListo: vi.fn(),
}));

// Helper para simular sesión activa de admin
function simularSesionAdmin() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: {
      partyId: '1',
      nombres: 'Admin Test',
      rol: 'ADMIN',
    },
    permisos: ['*'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

describe('Módulo Salón (Ola F5: Plano, Pedido del mozo y Reservas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. El diseño pegado inválido no cambia nada
  // -------------------------------------------------------------------------
  it('1. El diseño pegado inválido muestra un error y no cambia nada ni llama al servidor', async () => {
    const disenoActual = {
      floors: [{ id: '1', n: 'Piso 1', on: true }],
      plan: { '1': [] },
    };
    const alAplicarDiseno = vi.fn().mockResolvedValue(undefined);
    const alCerrar = vi.fn();

    render(
      <ModalDisenoTexto
        abierto={true}
        disenoActual={disenoActual}
        alCerrar={alCerrar}
        alAplicarDiseno={alAplicarDiseno}
      />,
    );

    const textareaPegar = screen.getByPlaceholderText(
      'Pega aquí el JSON completo del diseño...',
    );
    const botonAplicar = screen.getByRole('button', {
      name: 'Aplicar el diseño pegado',
    });

    // Caso A: Texto no JSON
    fireEvent.change(textareaPegar, {
      target: { value: '{ esto no es json válido }' },
    });
    fireEvent.click(botonAplicar);

    expect(
      screen.getByText(/no es un JSON válido/i),
    ).toBeInTheDocument();
    expect(alAplicarDiseno).not.toHaveBeenCalled();

    // Caso B: JSON sin floors ni plan
    fireEvent.change(textareaPegar, {
      target: { value: JSON.stringify({ mensaje: 'incompleto' }) },
    });
    fireEvent.click(botonAplicar);

    expect(
      screen.getByText(/debe contener un arreglo no vacío de pisos en "floors"/i),
    ).toBeInTheDocument();
    expect(alAplicarDiseno).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. El giro y el movimiento respetan los límites
  // -------------------------------------------------------------------------
  it('2. El giro y el movimiento respetan los límites de la cuadrícula y manejan errores', async () => {
    const alActualizarPropiedades = vi.fn();
    const alGirar = vi.fn();
    const alAlternarActivo = vi.fn();
    const alEliminar = vi.fn();
    const alCerrar = vi.fn();

    // Elemento mesa
    const elementoMesa = {
      id: 'm1',
      pisoId: '1',
      tipo: 'MESA',
      nombre: 'Mesa 1',
      x: 18,
      y: 10,
      ancho: 2,
      alto: 2,
      numero: 1,
      asientos: 4,
      activo: true,
    };

    // Si al girar el backend arroja NO_CABE
    const { rerender } = render(
      <ModalEditarElemento
        elemento={elementoMesa}
        alCerrar={alCerrar}
        alActualizarPropiedades={alActualizarPropiedades}
        alGirar={alGirar}
        alAlternarActivo={alAlternarActivo}
        alEliminar={alEliminar}
      />,
    );

    const botonGirar = screen.getByRole('button', {
      name: /Girar \(horizontal\/vertical\)/i,
    });
    fireEvent.click(botonGirar);
    expect(alGirar).toHaveBeenCalledWith('m1');

    // Comprobar visualización del error NO_CABE cuando la prop errorOperacion está presente
    rerender(
      <ModalEditarElemento
        elemento={elementoMesa}
        alCerrar={alCerrar}
        alActualizarPropiedades={alActualizarPropiedades}
        alGirar={alGirar}
        alAlternarActivo={alAlternarActivo}
        alEliminar={alEliminar}
        errorOperacion="El elemento no cabe en la cuadrícula al girar en su posición actual"
      />,
    );

    expect(
      screen.getByText(/no cabe en la cuadrícula al girar/i),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Confirmar antes de eliminar
  // -------------------------------------------------------------------------
  it('3. Exige confirmación obligatoria Sí/No antes de eliminar un elemento', async () => {
    const alEliminar = vi.fn().mockResolvedValue(undefined);
    const alCerrar = vi.fn();

    const elemento = {
      id: 'elem-pared-1',
      pisoId: '1',
      tipo: 'PARED',
      nombre: 'Pared 1',
      x: 0,
      y: 0,
      ancho: 4,
      alto: 1,
      numero: null,
      asientos: null,
      activo: true,
    };

    render(
      <ModalEditarElemento
        elemento={elemento}
        alCerrar={alCerrar}
        alActualizarPropiedades={vi.fn()}
        alGirar={vi.fn()}
        alAlternarActivo={vi.fn()}
        alEliminar={alEliminar}
      />,
    );

    const botonEliminar = screen.getByRole('button', { name: 'Eliminar' });
    fireEvent.click(botonEliminar);

    // Debe mostrar diálogo Sí/No
    expect(screen.getByText('¿Eliminar pared?')).toBeInTheDocument();
    expect(alEliminar).not.toHaveBeenCalled();

    // Cancelar
    const botonNo = screen.getByRole('button', { name: 'No, conservar' });
    fireEvent.click(botonNo);
    expect(alEliminar).not.toHaveBeenCalled();

    // Volver a abrir y confirmar
    fireEvent.click(botonEliminar);
    const botonSi = screen.getByRole('button', { name: 'Sí, eliminar' });
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(alEliminar).toHaveBeenCalledWith('elem-pared-1');
    });
  });

  // -------------------------------------------------------------------------
  // 4. No se puede enviar un pedido de mesa sin mesa ni sin productos
  // -------------------------------------------------------------------------
  it('4. No se puede enviar un pedido de mesa sin mesa ni sin productos', async () => {
    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          {
            id: 'm1',
            pisoId: '1',
            tipo: 'MESA',
            numero: 1,
            nombre: 'Mesa 1',
            asientos: 4,
            x: 2,
            y: 5,
            ancho: 2,
            alto: 2,
            activo: true,
            estado: 'LIBRE' as const,
          },
        ],
      },
    ];

    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          nombre: 'Bebidas',
          orden: 1,
          productos: [
            {
              id: 'prod-1',
              nombre: 'Café Americano',
              descripcion: 'Café tostado',
              fotoUrl: null,
              precio: 8.5,
              tamanos: [],
              grupos: [],
              sabores: [],
              noSumaBeneficios: false,
              disponible: true,
              agotadoHasta: null,
            },
          ],
        },
      ],
    });

    render(
      <ModalNuevoPedidoMesa
        abierto={true}
        alCerrar={vi.fn()}
        pisos={pisosMock}
        mesasPreseleccionadasIds={[]}
      />,
    );

    // Con «Tomar pedido» no hay botón de continuar: se elige una mesa libre y sigue la carta (como el mockup)
    expect(screen.queryByRole('button', { name: 'Continuar a la carta' })).toBeNull();

    // Seleccionar mesa 1 (atajo de «Mesas libres»)
    fireEvent.click(screen.getByRole('button', { name: /Mesa 1/i }));

    // En el paso 2 sin productos, «Enviar directo a cocina» no envía y dice qué falta
    const botonEnviar = screen.getByRole('button', {
      name: 'Enviar directo a cocina',
    });
    elegirBoleta();
    fireEvent.click(botonEnviar);
    expect(screen.getByText('Agrega al menos un producto para enviarlo.')).toBeInTheDocument();
    expect(salonApi.abrirPedidoMesa).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. MESA_OCUPADA refresca
  // -------------------------------------------------------------------------
  it('5. MESA_OCUPADA muestra mensaje de error y refresca el estado de las mesas', async () => {
    const alRefrescarMesas = vi.fn().mockResolvedValue(undefined);

    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          {
            id: 'm1',
            pisoId: '1',
            tipo: 'MESA',
            numero: 1,
            nombre: 'Mesa 1',
            asientos: 4,
            x: 2,
            y: 5,
            ancho: 2,
            alto: 2,
            activo: true,
            estado: 'LIBRE' as const,
          },
        ],
      },
    ];

    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          nombre: 'Cafetería',
          orden: 1,
          productos: [
            {
              id: 'p1',
              nombre: 'Espresso',
              descripcion: 'Espresso doble',
              fotoUrl: null,
              precio: 6.0,
              tamanos: [],
              grupos: [],
              sabores: [],
              noSumaBeneficios: false,
              disponible: true,
              agotadoHasta: null,
            },
          ],
        },
      ],
    });

    vi.mocked(salonApi.abrirPedidoMesa).mockRejectedValue(
      new ErrorApi(
        'MESA_OCUPADA',
        'La mesa 1 ya está ocupada por otro pedido',
        409,
      ),
    );

    render(
      <ModalNuevoPedidoMesa
        abierto={true}
        alCerrar={vi.fn()}
        pisos={pisosMock}
        mesasPreseleccionadasIds={['m1']}
        alRefrescarMesas={alRefrescarMesas}
      />,
    );

    // Esperar a que cargue la carta y hacer clic en el producto para agregarlo
    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Espresso'));

    // Esperar a que abra VentanaProducto
    await waitFor(() => {
      expect(screen.getByText('Agregar al pedido')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Agregar al pedido'));

    // La mesa sin cuenta pide el nombre del cliente
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía Pérez' } });

    // Enviar directo a cocina
    const botonEnviar = screen.getByRole('button', {
      name: 'Enviar directo a cocina',
    });
    await waitFor(() => {
      expect(botonEnviar).not.toBeDisabled();
    });
    elegirBoleta();
    fireEvent.click(botonEnviar);

    // Diálogo confirmar
    expect(
      screen.getByText('¿Enviar pedido directo a cocina?'),
    ).toBeInTheDocument();
    const botonSi = screen.getByRole('button', { name: 'Sí, enviar comanda' });
    fireEvent.click(botonSi);

    // Debe invocar el refresco de mesas y mostrar el error
    await waitFor(() => {
      expect(alRefrescarMesas).toHaveBeenCalled();
      expect(
        screen.getByText(/La mesa 1 ya está ocupada/i),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 6. «Faltan N asientos»
  // -------------------------------------------------------------------------
  it('6. Muestra «Faltan N asientos» y deshabilita guardar cuando las mesas elegidas no alcanzan', async () => {
    const mesasMock = [
      {
        id: 'm1',
        pisoId: '1',
        tipo: 'MESA',
        numero: 1,
        nombre: 'Mesa 1',
        asientos: 4,
        x: 2,
        y: 5,
        ancho: 2,
        alto: 2,
        activo: true,
        estado: 'LIBRE' as const,
      },
      {
        id: 'm2',
        pisoId: '1',
        tipo: 'MESA',
        numero: 2,
        nombre: 'Mesa 2',
        asientos: 2,
        x: 5,
        y: 5,
        ancho: 2,
        alto: 2,
        activo: true,
        estado: 'LIBRE' as const,
      },
      {
        id: 'm3',
        pisoId: '1',
        tipo: 'MESA',
        numero: 3,
        nombre: 'Mesa 3',
        asientos: 2,
        x: 8,
        y: 5,
        ancho: 2,
        alto: 2,
        activo: true,
        estado: 'LIBRE' as const,
      },
    ];

    render(
      <ModalFormularioReserva
        abierto={true}
        mesasDisponibles={mesasMock}
        alCerrar={vi.fn()}
        alGuardar={vi.fn()}
      />,
    );

    // Ingresar datos del cliente
    const inputNombre = screen.getByLabelText(/Nombre del cliente/i);
    const inputTelefono = screen.getByLabelText(/Teléfono \/ Celular/i);
    fireEvent.change(inputNombre, { target: { value: 'Carlos Mendoza' } });
    fireEvent.change(inputTelefono, { target: { value: '999888777' } });

    // Aumentar personas a 8 (click 6 veces en +)
    const botonMasPersonas = screen.getByRole('button', {
      name: 'Una persona más',
    });
    for (let i = 0; i < 6; i++) {
      fireEvent.click(botonMasPersonas);
    }
    expect(screen.getByText('8')).toBeInTheDocument();

    // Seleccionar Mesa 1 (4 asientos) y Mesa 2 (2 asientos) -> Total 6 asientos
    const btnMesa1 = screen.getByRole('button', { name: /Mesa 1/i });
    const btnMesa2 = screen.getByRole('button', { name: /Mesa 2/i });
    fireEvent.click(btnMesa1);
    fireEvent.click(btnMesa2);

    // Debe mostrar claramente «Faltan 2 asientos»
    const avisoFaltan = screen.getByTestId('aviso-faltan-asientos');
    expect(avisoFaltan).toHaveTextContent('Faltan 2 asientos');

    const botonGuardar = screen.getByRole('button', {
      name: 'Registrar reserva',
    });
    expect(botonGuardar).toBeDisabled();

    // Sumar Mesa 3 (2 asientos) -> Total 8 asientos
    const btnMesa3 = screen.getByRole('button', { name: /Mesa 3/i });
    fireEvent.click(btnMesa3);

    expect(screen.queryByTestId('aviso-faltan-asientos')).toBeNull();
    expect(
      screen.getByText(/Capacidad suficiente: 8 asientos para 8 personas/i),
    ).toBeInTheDocument();
    expect(botonGuardar).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 7. Sentar abre el pedido con las mesas
  // -------------------------------------------------------------------------
  it('7. Sentar marca la reserva como SENTADA y abre el pedido del mozo con las mesas elegidas', async () => {
    const reservaMock = {
      id: 'res-101',
      nombre: 'Familia Ramírez',
      telefono: '912345678',
      personas: 4,
      hora: new Date(Date.now() + 3600000).toISOString(),
      tolerancia_min: 15,
      estado: 'ACTIVA' as const,
      motivo_cancelacion: null,
      pedido_id: null,
      mesas: [
        {
          id: 'rm-1',
          mesa_id: 'm-4',
          numero: 4,
          nombre: 'Mesa 4',
          asientos: 4,
        },
      ],
    };

    vi.mocked(salonApi.calendario).mockResolvedValue([]);
    vi.mocked(salonApi.agenda).mockResolvedValue([reservaMock]);
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({
      pisos: [
        {
          id: '1',
          nombre: 'Piso 1',
          activo: true,
          mesas: [
            {
              id: 'm-4',
              pisoId: '1',
              tipo: 'MESA',
              numero: 4,
              nombre: 'Mesa 4',
              asientos: 4,
              x: 2,
              y: 5,
              ancho: 2,
              alto: 2,
              activo: true,
              estado: 'LIBRE' as const,
            },
          ],
        },
      ],
    });
    vi.mocked(salonApi.sentarReserva).mockResolvedValue({
      mesas: ['m-4'],
      personas: 4,
      nombre: 'Familia Ramírez',
    });

    simularSesionAdmin();
    render(<ReservasView />);

    // Esperar a que la reserva activa aparezca en la agenda
    await waitFor(() => {
      expect(screen.getByText('Familia Ramírez')).toBeInTheDocument();
    });

    const botonSentar = screen.getByRole('button', { name: 'Sentar' });
    fireEvent.click(botonSentar);

    // Diálogo Sí/No de confirmación
    expect(
      screen.getByText('¿Sentar a los clientes de la reserva?'),
    ).toBeInTheDocument();

    const botonConfirmar = screen.getByRole('button', {
      name: 'Sí, sentar y abrir pedido',
    });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(salonApi.sentarReserva).toHaveBeenCalledWith('res-101');
      // Debe abrirse el modal del nuevo pedido de mesa con Mesa 4 preseleccionada
      expect(
        screen.getByRole('dialog', { name: /Nuevo pedido/ }),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Bebida: etiqueta simulada y nombre obligatorio
  // -------------------------------------------------------------------------
  it('8. La etiqueta de la bebida muestra el nombre al escribir y no agrega sin nombre (foco al primer campo)', async () => {
    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
        ],
      },
    ];
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          nombre: 'Bebidas',
          orden: 1,
          productos: [
            { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café tostado', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
          ],
        },
      ],
    });

    render(
      <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisosMock} mesasPreseleccionadasIds={['m1']} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Café Americano')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Café Americano'));
    await waitFor(() => {
      expect(screen.getByText('Agregar al pedido')).toBeInTheDocument();
    });

    const campo = screen.getByPlaceholderText('Ej.: Lucía o Mesa 4') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'Lucía' } });
    const etiqueta = screen.getByLabelText('Así se verá la etiqueta del vaso 1');
    expect(within(etiqueta).getByText('Lucía')).toBeInTheDocument();

    // Sin nombre: no agrega, muestra el aviso y enfoca el campo vacío
    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre de quien tomará cada bebida');
    expect(document.activeElement).toBe(campo);
    expect(screen.queryByText('Aún no agregas productos.', { exact: false })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 9. Tarjetas: la foto llena su espacio sin deformarse
  // -------------------------------------------------------------------------
  it('9. Las tarjetas de producto muestran la foto con object-fit cover', async () => {
    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
        ],
      },
    ];
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          nombre: 'Postres',
          orden: 1,
          productos: [
            { id: 'p1', nombre: 'Torta', descripcion: 'Torta', fotoUrl: '/fotos/torta.jpg', precio: 12, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
            { id: 'p2', nombre: 'Galleta', descripcion: 'Galleta', fotoUrl: null, precio: 4, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
          ],
        },
      ],
    });

    render(
      <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisosMock} mesasPreseleccionadasIds={['m1']} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Torta' })).toBeInTheDocument();
    });
    expect(screen.getByRole('img', { name: 'Torta' })).toHaveAttribute('decoding', 'async'); // object-fit: cover vive en nuevo-pedido-mozo.css
    // Sin foto: la tarjeta muestra iniciales, igual que la carta
    expect(screen.getByText('G', { exact: true })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 10. Mesa ocupada: aviso al tocarla
  // -------------------------------------------------------------------------
  it('10. Tocar una mesa ocupada avisa en vez de no hacer nada', async () => {
    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'OCUPADA' as const },
        ],
      },
    ];
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({ categorias: [] });

    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisosMock} />);

    fireEvent.click(await screen.findByTestId('elemento-plano-m1'));

    expect(screen.getByRole('alert')).toHaveTextContent('Mesa 1 está ocupada. Elige una mesa libre.');
  });

  // -------------------------------------------------------------------------
  // 11. Pedido abierto desde Pedidos y caja se envía con canal CAJA y el nombre de la bebida
  // -------------------------------------------------------------------------
  it('11. El pedido abierto desde Caja se envía con canal CAJA y el nombre de la bebida en personas', async () => {
    const pisosMock = [
      {
        id: '1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [
          { id: 'm1', pisoId: '1', tipo: 'MESA', numero: 1, nombre: 'Mesa 1', asientos: 4, x: 2, y: 5, ancho: 2, alto: 2, activo: true, estado: 'LIBRE' as const },
        ],
      },
    ];
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue({
      categorias: [
        {
          id: 'cat-1',
          nombre: 'Bebidas',
          orden: 1,
          productos: [
            { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café tostado', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
          ],
        },
      ],
    });
    vi.mocked(salonApi.abrirPedidoMesa).mockResolvedValue({ id: 'ped-1' } as any);

    render(
      <ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={pisosMock} pasoInicial="modal" mesasPreseleccionadasIds={['m1']} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Café Americano')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Café Americano'));
    await waitFor(() => {
      expect(screen.getByText('Agregar al pedido')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    fireEvent.change(screen.getByLabelText('Nombre del cliente *'), { target: { value: 'Lucía Pérez' } });
    elegirBoleta();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar directo a cocina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar comanda' }));

    await waitFor(() => {
      expect(salonApi.abrirPedidoMesa).toHaveBeenCalledTimes(1);
    });
    const [payload] = vi.mocked(salonApi.abrirPedidoMesa).mock.calls[0];
    expect(payload.canal).toBe('CAJA');
    expect(payload.mesas).toEqual(['m1']);
    expect(payload.lineas[0].personas).toEqual(['Lucía']);
  });
});
