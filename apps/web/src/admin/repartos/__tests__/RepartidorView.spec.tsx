import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { repartosApi, PedidoReparto } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

describe('RepartidorView - Pantalla Mobile-First de Repartidor', () => {
  function crearMockPedido(parcial: Partial<PedidoReparto> & { id: string; codigo: string }): PedidoReparto {
    return {
      modalidad: 'DELIVERY',
      estado: 'LISTO',
      cliente_nombre: 'Cliente',
      cliente_telefono: null,
      direccion: 'Direccion',
      referencia: null,
      lat: -12.06,
      lng: -77.04,
      zona: 'Breña',
      zona_id: '1',
      minutosEspera: 10,
      color: 'verde',
      total: 30,
      pago_estado: 'PAGADO',
      pago_metodo: 'EFECTIVO',
      cobro_pendiente_efectivo: false,
      paga_con: null,
      repartidor_party_id: null,
      tomado_en: null,
      salio_en: null,
      llego_en: null,
      entregado_en: null,
      motivo_falla: null,
      creado_en: '2026-10-27T14:00:00Z',
      cantidad_productos: 1,
      ...parcial,
    };
  }

  const pedidoActivo1: PedidoReparto = crearMockPedido({
    id: '101',
    codigo: 'CP-0101',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Rosa Sanchez',
    cliente_telefono: '987654321',
    direccion: 'Av. Brasil 1234, Dpto 301',
    referencia: 'Frente al parque',
    zona: 'Breña',
    total: 45.5,
    pago_estado: 'PAGADO',
    pago_metodo: 'YAPE',
    creado_en: '2026-10-27T14:00:00Z',
    minutosEspera: 15,
    cantidad_productos: 3,
    lat: -12.06,
    lng: -77.04,
    repartidor_party_id: '10',
  });

  const pedidoActivo2: PedidoReparto = crearMockPedido({
    id: '102',
    codigo: 'CP-0102',
    modalidad: 'DELIVERY',
    estado: 'EN_CAMINO',
    cliente_nombre: 'Carlos Ramos',
    cliente_telefono: '912345678',
    direccion: 'Jr. Huaraz 567',
    referencia: 'Puerta blanca',
    zona: 'Breña',
    total: 32.0,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: true,
    creado_en: '2026-10-27T14:10:00Z',
    minutosEspera: 25,
    cantidad_productos: 2,
    lat: -12.07,
    lng: -77.05,
    repartidor_party_id: '10',
  });

  const pedidoDisponible1: PedidoReparto = crearMockPedido({
    id: '201',
    codigo: 'CP-0201',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Ana Belen',
    cliente_telefono: null, // Oculto antes de tomar
    direccion: 'Av. Arica 890',
    referencia: 'Edificio Los Cedros',
    zona: 'Breña',
    total: 58.0,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: true,
    creado_en: '2026-10-27T14:20:00Z',
    minutosEspera: 10,
    cantidad_productos: 4,
    lat: -12.065,
    lng: -77.045,
  });

  const pedidoDisponible2: PedidoReparto = crearMockPedido({
    id: '202',
    codigo: 'CP-0202',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Jorge Mendoza',
    cliente_telefono: null, // Oculto antes de tomar
    direccion: 'Av. Venezuela 1100',
    referencia: 'Cerca a Metro',
    zona: 'Breña',
    total: 27.5,
    pago_estado: 'PAGADO',
    pago_metodo: 'PLIN',
    creado_en: '2026-10-27T14:25:00Z',
    minutosEspera: 5,
    cantidad_productos: 1,
    lat: -12.068,
    lng: -77.048,
  });

  const pedidoEntregadoHoy: PedidoReparto = crearMockPedido({
    id: '301',
    codigo: 'CP-0301',
    modalidad: 'DELIVERY',
    estado: 'ENTREGADO',
    cliente_nombre: 'Lucia Diaz',
    cliente_telefono: '999888777',
    direccion: 'Av. Alfonso Ugarte 450',
    zona: 'Breña',
    total: 50.0,
    pago_estado: 'PAGADO',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: false,
    creado_en: '2026-10-27T12:00:00Z',
    minutosEspera: 0,
    cantidad_productos: 2,
    lat: -12.05,
    lng: -77.04,
    repartidor_party_id: '10',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'Repartidor 1', rol: 'REPARTIDOR' },
      permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((permiso: string) => {
        return ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(
          permiso,
        );
      }),
    });

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});

    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({
      pedidos: [pedidoActivo1, pedidoActivo2],
      orden: ['101', '102'],
      paso: [],
      ruta: [],
    });
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([
      pedidoDisponible1,
      pedidoDisponible2,
    ]);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([pedidoEntregadoHoy]);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({
      umbralRetrasadoMin: 20,
      umbralTardeMin: 30,
      umbralMuyTardeMin: 45,
      velocidadMediaKmH: 20,
      maxPedidosPorRepartidor: 5,
    });
  });

  it('1. Renderiza RepartidorView para rol REPARTIDOR mostrando cabecera con nombre, conteo y tope', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cabecera-repartidor')).toBeInTheDocument();
    });

    expect(screen.getByText('Repartidor 1')).toBeInTheDocument();
    expect(screen.getByTestId('badge-tope-pedidos')).toHaveTextContent('2 / 5 pedidos');
    expect(screen.getByTestId('tab-mi-ruta')).toBeInTheDocument();
    expect(screen.getByTestId('tab-para-elegir')).toBeInTheDocument();
    expect(screen.getByTestId('tab-hechos-hoy')).toBeInTheDocument();
  });

  it('2. En pestaña Mi ruta muestra los pedidos activos con botones grandes y confirmación Sí/No', async () => {
    const spySalir = vi.spyOn(repartosApi, 'salir').mockResolvedValue({} as any);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-pedido-101')).toBeInTheDocument();
      expect(screen.getByTestId('tarjeta-pedido-102')).toBeInTheDocument();
    });

    // Pedido 101 está en LISTO -> botón "Salir a reparto"
    const btnSalir = screen.getByTestId('btn-salir-101');
    expect(btnSalir).toHaveTextContent('Salir a reparto');

    // Al hacer click no ejecuta directo: abre Confirmar
    fireEvent.click(btnSalir);
    expect(screen.getByText('¿Salir a reparto?')).toBeInTheDocument();

    // Al confirmar Sí
    const btnConfirmarSi = screen.getByText('Sí, confirmar');
    fireEvent.click(btnConfirmarSi);

    await waitFor(() => {
      expect(spySalir).toHaveBeenCalledWith('101');
    });
  });

  it('3. Estado vacío en Mi ruta cuando no hay pedidos asignados', async () => {
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValueOnce({
      pedidos: [],
      orden: [],
      paso: [],
      ruta: [],
    });

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('estado-vacio-mi-ruta')).toBeInTheDocument();
    });

    expect(screen.getByText('No tienes pedidos activos')).toBeInTheDocument();
    const btnIrElegir = screen.getByTestId('btn-ir-a-elegir');
    expect(btnIrElegir).toBeInTheDocument();

    // Navega a la pestaña 'Para elegir'
    fireEvent.click(btnIrElegir);
    expect(screen.getByTestId('tab-para-elegir')).toHaveAttribute('aria-selected', 'true');
  });

  it('4. Pestaña Para elegir oculta teléfono del cliente y permite selección parcial con recálculo dinámico', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-para-elegir')).toBeInTheDocument();
    });

    // Cambiar a pestaña 'Para elegir'
    fireEvent.click(screen.getByTestId('tab-para-elegir'));

    await waitFor(() => {
      expect(screen.getByTestId('candidato-pedido-201')).toBeInTheDocument();
      expect(screen.getByTestId('candidato-pedido-202')).toBeInTheDocument();
    });

    // Verifica que el teléfono está oculto antes de tomar
    expect(screen.getByTestId('telefono-oculto-201')).toHaveTextContent('Teléfono oculto hasta tomar');

    // Seleccionar pedido 201
    const card201 = screen.getByTestId('candidato-pedido-201');
    fireEvent.click(card201);

    // Muestra panel de recálculo dinámico
    await waitFor(() => {
      expect(screen.getByTestId('resumen-ruta-elegida')).toBeInTheDocument();
    });
    expect(screen.getByText(/Elegidos: 1 pedido/i)).toBeInTheDocument();
    expect(screen.getByTestId('btn-tomar-elegidos')).toHaveTextContent(/Tomar 1 pedido/i);
  });

  it('5. Conflicto atómico al tomar: muestra aviso claro si otro repartidor ganó un pedido', async () => {
    const spyIniciarRuta = vi.spyOn(repartosApi, 'iniciarRuta').mockResolvedValueOnce({
      tomados: [pedidoDisponible1],
      perdidos: [
        {
          pedidoId: '202',
          codigo: 'CP-0202',
          motivo: 'OTRO_REPARTIDOR',
          tomadoPor: 'Repartidor 2',
        },
      ],
    });

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-para-elegir')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('tab-para-elegir'));

    await waitFor(() => {
      expect(screen.getByTestId('candidato-pedido-201')).toBeInTheDocument();
    });

    // Seleccionar ambos pedidos
    fireEvent.click(screen.getByTestId('candidato-pedido-201'));
    fireEvent.click(screen.getByTestId('candidato-pedido-202'));

    const btnTomar = screen.getByTestId('btn-tomar-elegidos');
    fireEvent.click(btnTomar);

    // Modal Confirmar
    expect(screen.getByText('¿Iniciar ruta con los pedidos elegidos?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sí, confirmar'));

    await waitFor(() => {
      expect(spyIniciarRuta).toHaveBeenCalledWith({ pedidoIds: ['201', '202'] });
    });

    // Muestra aviso de pedido perdido sin romper la vista
    await waitFor(() => {
      expect(screen.getByTestId('alerta-pedidos-perdidos')).toBeInTheDocument();
      expect(screen.getByText(/fue tomado por Repartidor 2 un instante antes/i)).toBeInTheDocument();
    });
  });

  it('6. Pestaña Hechos hoy muestra entregas completadas y tarjeta con total en efectivo para liquidar', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-hechos-hoy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-hechos-hoy'));

    await waitFor(() => {
      expect(screen.getByTestId('resumen-liquidacion')).toBeInTheDocument();
    });

    // Suma en efectivo del pedido entregado (S/ 50.00)
    expect(screen.getByTestId('total-efectivo-liquidar')).toHaveTextContent('S/ 50.00');
    expect(screen.getByTestId('hecho-pedido-301')).toBeInTheDocument();
    expect(screen.getByText('Lucia Diaz')).toBeInTheDocument();
  });

  it('7. Reportar problema abre modal de reporte de falla', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-reportar-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-reportar-101'));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Reportar entrega fallida/i }),
      ).toBeInTheDocument();
    });
  });

  it('8. En escritorio (contenido >= 1024 px) usa dos columnas con el mapa a la vista y sin botón Ver mapa', async () => {
    const medida = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 1280, height: 800, top: 0, left: 0, right: 1280, bottom: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-pedido-101')).toBeInTheDocument();
    });

    const raiz = screen.getByTestId('vista-repartidor');
    expect(raiz.style.gridTemplateColumns).toContain('420px');
    expect(screen.queryByTestId('btn-ver-mapa')).not.toBeInTheDocument();
    expect(raiz.querySelector('.leaflet-container')).not.toBeNull();
    // Las pestañas siguen siendo role=tab dentro de un tablist
    expect(screen.getByRole('tablist', { name: 'Pestañas de reparto' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);

    medida.mockRestore();
  });

  it('9. En celular (contenido < 1024 px) una columna con barra inferior y el mapa solo en hoja a pantalla completa', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-pedido-101')).toBeInTheDocument();
    });

    const raiz = screen.getByTestId('vista-repartidor');
    expect(raiz.style.gridTemplateColumns).toBe('');
    // El mapa no está apretado con la lista: no se renderiza hasta abrir la hoja
    expect(raiz.querySelector('.leaflet-container')).toBeNull();

    fireEvent.click(screen.getByTestId('btn-ver-mapa'));
    const hoja = await screen.findByRole('dialog', { name: 'Mi ruta en el mapa' });
    expect(hoja).toBeInTheDocument();
    expect(hoja.querySelector('.leaflet-container')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mapa' }));
    expect(screen.queryByRole('dialog', { name: 'Mi ruta en el mapa' })).not.toBeInTheDocument();
  });

  it('10. Para elegir en celular: Ver en mapa abre la hoja con los sugeridos y la barra inferior muestra el botón de tomar', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-para-elegir')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('tab-para-elegir'));

    await waitFor(() => {
      expect(screen.getByTestId('candidato-pedido-201')).toBeInTheDocument();
    });

    // Sin elegidos el botón de tomar está deshabilitado y no se confirma nada
    expect(screen.getByTestId('btn-tomar-elegidos')).toBeDisabled();

    fireEvent.click(screen.getByTestId('candidato-pedido-201'));
    expect(screen.getByTestId('candidato-pedido-201')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('btn-tomar-elegidos')).toBeEnabled();

    fireEvent.click(screen.getByTestId('btn-ver-mapa'));
    const hoja = await screen.findByRole('dialog', { name: 'Pedidos sugeridos en el mapa' });
    expect(hoja.querySelector('.leaflet-container')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mapa' }));
  });
});
