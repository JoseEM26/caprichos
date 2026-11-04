import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { TarjetaReparto } from '../TarjetaReparto';
import { PanelRutaSugerida } from '../PanelRutaSugerida';
import { ResumenPedidoReparto } from '../ResumenPedidoReparto';
import { ModalReportarFalla } from '../ModalReportarFalla';
import { repartosApi, PedidoReparto } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { ErrorApi } from '../../../comun/api';

vi.mock('../MapaRepartos', () => ({
  MapaRepartos: ({
    puntos,
    zonas,
    conteoPorZona,
    zonaFiltroActiva,
    onSeleccionarZona,
    seleccionadoId,
    onSeleccionarPunto,
    esPantallaCompleta,
    onAlternarPantallaCompleta,
    rutasSugeridas,
    rutaActivaId,
    onSeleccionarRutaSugerida,
    mostrarRutasSugeridas,
    onAlternarMostrarRutasSugeridas,
  }: any) => (
    <div data-testid="mock-mapa-repartos">
      {onAlternarMostrarRutasSugeridas && (
        <button
          data-testid="mock-btn-ver-rutas"
          onClick={onAlternarMostrarRutasSugeridas}
        >
          {mostrarRutasSugeridas ? 'Ocultar rutas sugeridas' : 'Ver rutas sugeridas'}
        </button>
      )}
      {mostrarRutasSugeridas && rutasSugeridas && (
        <div data-testid="mock-rutas-sugeridas-lista">
          {rutasSugeridas.map((r: any) => (
            <button
              key={r.id}
              data-testid={`mock-ruta-${r.id}`}
              data-activa={r.id === rutaActivaId ? 'true' : 'false'}
              onClick={() => onSeleccionarRutaSugerida && onSeleccionarRutaSugerida(r)}
            >
              {r.nombre}: {r.totalPedidos} pedidos · ~{r.tiempoMin} min
            </button>
          ))}
        </div>
      )}
      <div data-testid="zonas-container">
        {(zonas || []).map((z: any) => (
          <button
            key={z.codigo}
            data-testid={`zona-poly-${z.codigo}`}
            data-activa={zonaFiltroActiva === z.codigo ? 'true' : 'false'}
            onClick={() => onSeleccionarZona && onSeleccionarZona(z.codigo)}
          >
            {z.codigo} ({conteoPorZona?.[z.codigo] || 0})
          </button>
        ))}
      </div>
      <div data-testid="puntos-container">
        {puntos.map((p: any) => (
          <button
            key={p.id}
            data-testid={`pin-${p.id}`}
            data-selected={p.id === seleccionadoId ? 'true' : 'false'}
            onClick={() => onSeleccionarPunto && onSeleccionarPunto(p.id)}
          >
            {p.orden ? `${p.orden}. ` : ''}
            {p.etiqueta} - {p.codigo} ({p.color})
          </button>
        ))}
      </div>
      {onAlternarPantallaCompleta && (
        <button
          data-testid="mock-btn-fullscreen"
          onClick={onAlternarPantallaCompleta}
        >
          {esPantallaCompleta ? 'Salir' : 'Pantalla completa'}
        </button>
      )}
    </div>
  ),
}));

describe('Ola F5 y Siguiente: Repartos y Mapa (Decisiones del Dueño 1 a 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '10', nombres: 'Admin Repartos', rol: 'ADMIN' },
      permisos: ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar', 'repartos/liquidar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((permiso: string) => {
        return ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar', 'repartos/liquidar'].includes(
          permiso,
        );
      }),
    });

    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerResumen').mockResolvedValue({ lados: {}, zonas: {} });
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({
      pedidos: [],
      orden: [],
      paso: [],
      ruta: [],
    });
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({
      umbralRetrasadoMin: 20,
      umbralTardeMin: 30,
      umbralMuyTardeMin: 45,
      velocidadMediaKmH: 20,
      maxPedidosPorRepartidor: 3,
    });
  });

  const pedidoEjemplo: PedidoReparto = {
    id: '101',
    codigo: 'CP-0101',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Maria Flores',
    cliente_telefono: '987654321',
    direccion: 'Av. Las Flores 123',
    referencia: 'Frente al parque',
    lat: -12.045,
    lng: -77.03,
    zona: 'Z1',
    zona_id: '1',
    minutosEspera: 36,
    color: 'naranja',
    total: 45.0,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: true,
    paga_con: 50.0,
    repartidor_party_id: null,
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: null,
    creado_en: '2026-10-21T19:00:00Z',
  };

  it('Tomar maneja LIMITE_PEDIDOS', async () => {
    vi.spyOn(repartosApi, 'tomarPedido').mockRejectedValueOnce(
      new ErrorApi(
        'LIMITE_PEDIDOS',
        'Ya llevas 3 pedidos: entrega alguno antes de tomar otro',
        409,
      ),
    );

    render(
      <TarjetaReparto
        pedido={pedidoEjemplo}
        esDisponible={true}
        alActualizar={vi.fn()}
      />,
    );

    const botonTomar = screen.getByRole('button', { name: /tomar pedido/i });
    fireEvent.click(botonTomar);

    expect(screen.getByText('¿Seguro que quieres tomar este pedido?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(
        screen.getByText('Ya llevas 3 pedidos: entrega alguno antes de tomar otro'),
      ).toBeInTheDocument();
    });
  });

  it('no se puede reportar NO_CONTESTA con menos de 2 llamadas', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:foto-local');
    URL.revokeObjectURL = vi.fn();
    const reportarMock = vi.spyOn(repartosApi, 'reportarFalla').mockResolvedValueOnce({
      ok: true,
      incidenteId: '99',
      intento: 1,
      pedido: { id: '101' },
    });

    render(
      <ModalReportarFalla
        pedido={pedidoEjemplo}
        alCerrar={vi.fn()}
        alCompletar={vi.fn()}
      />,
    );

    const selectMotivo = screen.getByLabelText(/motivo del incidente/i);
    expect(selectMotivo).toHaveValue('NO_CONTESTA');

    const botonEnviar = screen.getByRole('button', { name: /reportar entrega fallida/i });
    fireEvent.click(botonEnviar);

    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    const botonLlamada = screen.getByRole('button', { name: /\+ registrar llamada/i });
    fireEvent.click(botonLlamada);

    fireEvent.click(botonEnviar);
    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    fireEvent.click(botonLlamada);

    // Cliente no salió: la foto del lugar es obligatoria antes de confirmar
    fireEvent.click(botonEnviar);
    expect(screen.getByText('Toma al menos 1 foto del lugar donde esperaste.')).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('input-foto-prueba'), {
      target: { files: [new File(['x'], 'lugar.jpg', { type: 'image/jpeg' })] },
    });
    vi.spyOn(repartosApi, 'subirFotoPrueba').mockResolvedValue('5');

    fireEvent.click(botonEnviar);

    expect(screen.getByText('¿Confirmas que el cliente no salió?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, reportar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(reportarMock).toHaveBeenCalledWith(
        '101',
        expect.objectContaining({
          motivo: 'NO_CONTESTA',
          contactos: expect.arrayContaining([
            expect.objectContaining({ tipo: 'LLAMADA' }),
            expect.objectContaining({ tipo: 'LLAMADA' }),
          ]),
        }),
      );
    });
  });

  it('muestra tiempo de espera según 20/30/45 (36 min es Tarde), vuelto y avisos', async () => {
    vi.spyOn(repartosApi, 'consultarMensajes').mockResolvedValueOnce([
      {
        pedido_id: '101',
        numero: 1,
        enviado_en: '2026-10-21T19:10:00Z',
        respondido_en: null,
        estado: 'PENDIENTE',
      },
    ]);

    render(
      <TarjetaReparto
        pedido={pedidoEjemplo}
        esDisponible={true}
        alActualizar={vi.fn()}
      />,
    );

    // 36 minutos está entre 30 y 45, por tanto es «Tarde»
    expect(screen.getByText(/36 min \(Tarde\)/i)).toBeInTheDocument();
    expect(screen.getByText(/llevar vuelto s\/ 5\.00/i)).toBeInTheDocument();

    const botonAvisos = screen.getByRole('button', { name: /avisos al cliente/i });
    fireEvent.click(botonAvisos);

    await waitFor(() => {
      expect(
        screen.getByText(/PENDIENTE DE ENVIAR \(no se envía nada real\)/i),
      ).toBeInTheDocument();
    });
  });

  it('Decisión 1: BORRAR 5 tarjetas métricas y bloque suelto ¿Cómo funciona? (reemplazado por icono ?)', async () => {
    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-mapa-repartos')).toBeInTheDocument();
    });

    // 5 tarjetas de números borradas (no deben existir como botones o tabs de kpi)
    expect(screen.queryByRole('tab', { name: /^Todos$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Disponibles$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^En ruta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Con problema$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Entregados$/i })).not.toBeInTheDocument();

    // Bloque suelto details "¿Cómo funciona?" no existe en el flujo principal
    expect(screen.queryByText(/Cada pedido listo aparece como Disponible\. El repartidor/i)).not.toBeInTheDocument();

    // En su lugar, hay un botón de ayuda «?» pequeño
    const botonAyuda = screen.getByRole('button', { name: /¿Cómo funciona/i });
    expect(botonAyuda).toBeInTheDocument();
    expect(botonAyuda).toHaveTextContent('?');

    // Al pulsar «?», abre el modal accesible con la explicación
    fireEvent.click(botonAyuda);
    expect(screen.getByRole('dialog', { name: /¿Cómo funciona/i })).toBeInTheDocument();
  });

  it('Decisión 2 y 3: Tres filtros arriba del mapa (Retrasado, Tarde, Muy tarde) y botón de pantalla completa', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([
      { ...pedidoEjemplo, id: '1', codigo: 'CP-001', minutosEspera: 15 }, // Normal (<20)
      { ...pedidoEjemplo, id: '2', codigo: 'CP-002', minutosEspera: 25 }, // Retrasado (20-30)
      { ...pedidoEjemplo, id: '3', codigo: 'CP-003', minutosEspera: 35 }, // Tarde (30-45)
      { ...pedidoEjemplo, id: '4', codigo: 'CP-004', minutosEspera: 50 }, // Muy tarde (>=45)
    ]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pin-1')).toBeInTheDocument();
      expect(screen.getByTestId('pin-2')).toBeInTheDocument();
      expect(screen.getByTestId('pin-3')).toBeInTheDocument();
      expect(screen.getByTestId('pin-4')).toBeInTheDocument();
    });

    // Combo «Espera» arriba del mapa con los conteos de cada nivel
    fireEvent.click(screen.getByRole('button', { name: 'Espera: Todos' }));
    expect(screen.getByRole('option', { name: /^Retrasado/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /^Tarde/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /^Muy tarde/ })).toHaveTextContent('1');

    // Filtra por "Muy tarde"
    fireEvent.click(screen.getByRole('option', { name: /^Muy tarde/ }));
    expect(screen.getByRole('button', { name: /^Espera: Muy tarde/ })).toBeInTheDocument();

    // Solo el pedido 4 debe estar visible en el mapa
    expect(screen.getByTestId('pin-4')).toBeInTheDocument();
    expect(screen.queryByTestId('pin-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pin-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pin-3')).not.toBeInTheDocument();

    // Botón de pantalla completa existe
    const btnsFull = screen.getAllByRole('button', { name: /pantalla completa/i });
    expect(btnsFull.length).toBeGreaterThan(0);
  });

  it('Decisión 4: Ruta sugerida con orden numérico, botón «Iniciar ruta» y reordenamiento', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([
      { ...pedidoEjemplo, id: '1', codigo: 'CP-001', cliente_nombre: 'Rosa Díaz', minutosEspera: 10, lat: -12.02, lng: -76.96 },
      { ...pedidoEjemplo, id: '2', codigo: 'CP-002', cliente_nombre: 'Diego Ramos', minutosEspera: 50, lat: -12.025, lng: -76.965 },
      { ...pedidoEjemplo, id: '3', codigo: 'CP-003', cliente_nombre: 'Carlos Soto', minutosEspera: 32, lat: -12.022, lng: -76.962 },
    ]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /ruta sugerida de entrega/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /iniciar ruta/i })).toBeInTheDocument();
    });

    // Paradas numeradas en el mapa
    expect(screen.getByTestId('pin-2')).toHaveTextContent(/1\.\s*Diego Ramos/);
  });

  it('Decisión 5: las zonas se sombrean solo como referencia: tocarlas no oculta ningún pedido', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([
      { ...pedidoEjemplo, id: '201', codigo: 'CP-0201', zona: 'Z4' },
      { ...pedidoEjemplo, id: '202', codigo: 'CP-0202', zona: 'Z4' },
      { ...pedidoEjemplo, id: '204', codigo: 'CP-0204', zona: 'Z7' },
    ]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('zona-poly-Z4')).toBeInTheDocument();
      expect(screen.getByTestId('zona-poly-Z7')).toBeInTheDocument();
    });

    // Tocar la zona no filtra: siguen todos los pedidos en el mapa
    fireEvent.click(screen.getByTestId('zona-poly-Z4'));

    expect(screen.getByTestId('pin-201')).toBeInTheDocument();
    expect(screen.getByTestId('pin-202')).toBeInTheDocument();
    expect(screen.getByTestId('pin-204')).toBeInTheDocument();
  });

  it('Decisión 7: Resumen abajo con horas de cada paso, botón Reportar problema y un solo botón grande de estado', async () => {
    const pedidoConPasos: PedidoReparto = {
      ...pedidoEjemplo,
      estado: 'EN_CAMINO',
      repartidor_party_id: '10',
      tomado_en: '2026-10-21T18:00:00Z',
      salio_en: '2026-10-21T18:15:00Z',
      llego_en: null,
    };

    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([pedidoConPasos]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pin-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pin-101'));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /hoja de pedido CP-0101/i })).toBeInTheDocument();
      // Muestra horas de pasos registrados
      expect(screen.getByText(/tomado:/i)).toBeInTheDocument();
      expect(screen.getByText(/en camino:/i)).toBeInTheDocument();
      // Botón reportar problema presente
      expect(screen.getByRole('button', { name: /reportar problema/i })).toBeInTheDocument();
      // Un solo botón grande de estado hacia el siguiente paso
      expect(screen.getByRole('button', { name: /llegué a destino/i })).toBeInTheDocument();
    });
  });

  it('la vista Lista es general, ordenada por espera (el que más espera primero), sin grupos por zona', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([
      { ...pedidoEjemplo, id: '201', codigo: 'CP-0201', zona: 'Z4' },
      { ...pedidoEjemplo, id: '202', codigo: 'CP-0202', zona: 'Z4' },
      { ...pedidoEjemplo, id: '203', codigo: 'CP-0203', zona: 'Z4' },
      { ...pedidoEjemplo, id: '204', codigo: 'CP-0204', zona: 'Z7' },
    ]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    const botonLista = screen.getByRole('button', { name: /^lista$/i });
    fireEvent.click(botonLista);

    await waitFor(() => {
      expect(screen.getByText('CP-0201')).toBeInTheDocument();
    });
    expect(screen.queryByText('Z4 · 3 pedidos')).not.toBeInTheDocument();
    expect(screen.queryByText('Z7 · 1 pedido')).not.toBeInTheDocument();
  });

  it('ausencia de coordenadas GPS en el DOM en TarjetaReparto y ResumenPedidoReparto', () => {
    const pedidoConCoords: PedidoReparto = {
      ...pedidoEjemplo,
      lat: -12.045678,
      lng: -77.034567,
    };

    const { container: containerTarjeta } = render(
      <TarjetaReparto pedido={pedidoConCoords} alActualizar={vi.fn()} esDisponible={true} />,
    );
    expect(containerTarjeta.textContent).not.toMatch(/-12\.\d+/);
    expect(containerTarjeta.textContent).not.toMatch(/-77\.\d+/);

    const mockAcciones: any = {
      cargandoAccion: false,
      errorAccion: null,
      setErrorAccion: vi.fn(),
      tomar: vi.fn(),
      salir: vi.fn(),
      llegue: vi.fn(),
      entregar: vi.fn(),
      liberar: vi.fn(),
      reasignar: vi.fn(),
    };

    const { container: containerResumen } = render(
      <ResumenPedidoReparto
        pedido={pedidoConCoords}
        acciones={mockAcciones}
        esDisponible={true}
        alActualizar={vi.fn()}
      />,
    );
    expect(containerResumen.textContent).not.toMatch(/-12\.\d+/);
    expect(containerResumen.textContent).not.toMatch(/-77\.\d+/);
  });

  it('PanelRutaSugerida muestra casillas por parada, respeta límite y permite iniciar ruta', async () => {
    const candidatos = [
      { id: 'p1', codigo: 'CP-1001', cliente_nombre: 'Ana Paz', direccion: 'Calle 1', lat: -12.04, lng: -77.03, minutosEspera: 10, total: 30 },
      { id: 'p2', codigo: 'CP-1002', cliente_nombre: 'Beto Ruiz', direccion: 'Calle 2', lat: -12.05, lng: -77.02, minutosEspera: 15, total: 35 },
      { id: 'p3', codigo: 'CP-1003', cliente_nombre: 'Carla Sol', direccion: 'Calle 3', lat: -12.06, lng: -77.01, minutosEspera: 20, total: 40 },
      { id: 'p4', codigo: 'CP-1004', cliente_nombre: 'Daniel Vega', direccion: 'Calle 4', lat: -12.07, lng: -77.00, minutosEspera: 25, total: 45 },
    ];

    const mockAlternar = vi.fn();
    const mockIniciar = vi.fn();

    const rutaMock = {
      paradas: [
        { ...candidatos[0], orden: 1, distanciaTramoKm: 1, tiempoTramoMin: 3, distanciaAcumuladaKm: 1, tiempoAcumuladoMin: 3 },
        { ...candidatos[1], orden: 2, distanciaTramoKm: 1.5, tiempoTramoMin: 4, distanciaAcumuladaKm: 2.5, tiempoAcumuladoMin: 7 },
      ],
      totalParadas: 2,
      distanciaAproxKm: 2.5,
      tiempoAproxMin: 7,
      urlGoogleMaps: 'https://maps.google.com',
    };

    render(
      <PanelRutaSugerida
        ruta={rutaMock}
        pedidosCandidatos={candidatos}
        paradasSeleccionadasIds={['p1', 'p2']}
        onAlternarSeleccionParada={mockAlternar}
        onMoverParada={vi.fn()}
        maxParadas={3}
        alIniciarRuta={mockIniciar}
      />,
    );

    const checkboxP1 = screen.getByRole('checkbox', { name: /incluir pedido cp-1001/i });
    const checkboxP2 = screen.getByRole('checkbox', { name: /incluir pedido cp-1002/i });
    const checkboxP3 = screen.getByRole('checkbox', { name: /incluir pedido cp-1003/i });
    expect(checkboxP1).toBeChecked();
    expect(checkboxP2).toBeChecked();
    expect(checkboxP3).not.toBeChecked();

    fireEvent.click(checkboxP3);
    expect(mockAlternar).toHaveBeenCalledWith('p3');

    const btnIniciar = screen.getByRole('button', { name: /iniciar ruta/i });
    fireEvent.click(btnIniciar);

    await waitFor(() => {
      expect(screen.getByText(/¿iniciar ruta de reparto\?/i)).toBeInTheDocument();
      expect(screen.getByText(/vas a llevar estos 2 pedidos: cp-1001, cp-1002\./i)).toBeInTheDocument();
    });

    const btnConfirmar = screen.getByRole('button', { name: /sí, iniciar ruta/i });
    fireEvent.click(btnConfirmar);
    expect(mockIniciar).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('PanelRutaSugerida muestra aviso claro por cada pedido perdido', () => {
    const avisos = [
      { pedidoId: 'p1', codigo: 'CP-W090', motivo: 'OTRO_REPARTIDOR' as const, tomadoPor: 'Carlos' },
      { pedidoId: 'p2', codigo: 'CP-W091', motivo: 'LIMITE' as const },
      { pedidoId: 'p3', codigo: 'CP-W092', motivo: 'ANULADO' as const },
    ];

    const mockCerrar = vi.fn();

    render(
      <PanelRutaSugerida
        ruta={{ paradas: [], totalParadas: 0, distanciaAproxKm: 0, tiempoAproxMin: 0, urlGoogleMaps: '' }}
        pedidosCandidatos={[]}
        paradasSeleccionadasIds={[]}
        onAlternarSeleccionParada={vi.fn()}
        onMoverParada={vi.fn()}
        avisosPerdidos={avisos}
        onCerrarAvisoPerdido={mockCerrar}
      />,
    );

    const banner = screen.getByTestId('banner-pedidos-perdidos');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('El pedido CP-W090 ya lo tomó Carlos')).toBeInTheDocument();
    expect(screen.getByText('El pedido CP-W091 superó el límite máximo de pedidos permitidos')).toBeInTheDocument();
    expect(screen.getByText('El pedido CP-W092 fue anulado o devuelto a cocina')).toBeInTheDocument();

    const btnCerrar = screen.getByRole('button', { name: /descartar aviso para cp-w090/i });
    fireEvent.click(btnCerrar);
    expect(mockCerrar).toHaveBeenCalledWith('p1');
  });

  it('muestra alerta ámbar de tomado sin salir y permite liberar a caja/admin', async () => {
    const pedidoConAlerta: PedidoReparto = {
      ...pedidoEjemplo,
      estado: 'LISTO',
      repartidor_party_id: '99',
      repartidor: { id: '99', nombre: 'Juan Repartidor' },
      tomado_en: '2026-10-21T18:00:00Z',
      alerta_tomado_sin_salir: true,
      minutos_sin_salir: 14,
    };

    const mockActualizar = vi.fn();
    const spyLiberar = vi.spyOn(repartosApi, 'liberarPedido').mockResolvedValueOnce({ id: '101', estado: 'LISTO' } as any);

    render(
      <TarjetaReparto
        pedido={pedidoConAlerta}
        esDisponible={false}
        puedeLiquidar={true}
        alActualizar={mockActualizar}
      />,
    );

    const alerta = screen.getByTestId('alerta-tomado-sin-salir');
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent(/tomado hace 14 min sin salir \(posible repartidor desconectado\)/i);

    const btnLiberar = screen.getByRole('button', { name: /liberar a disponibles/i });
    fireEvent.click(btnLiberar);

    await waitFor(() => {
      expect(screen.getByText(/¿liberar este pedido\?/i)).toBeInTheDocument();
    });

    const btnConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(spyLiberar).toHaveBeenCalledWith('101', expect.any(String));
      expect(mockActualizar).toHaveBeenCalled();
    });
  });

  it('RepartosView muestra contador de cola de espera y botón Ver rutas sugeridas', async () => {
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValueOnce([
      { ...pedidoEjemplo, id: '301', codigo: 'CP-0301', lat: -12.04, lng: -77.03, minutosEspera: 25 },
      { ...pedidoEjemplo, id: '302', codigo: 'CP-0302', lat: -12.05, lng: -77.02, minutosEspera: 15 },
    ]);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const contador = screen.getByTestId('contador-cola-espera');
      expect(contador).toBeInTheDocument();
      expect(contador).toHaveTextContent(/2 pedidos esperando repartidor/i);
      expect(contador).toHaveTextContent(/listos ordenados del más antiguo al más nuevo/i);
    });

    const btnVerRutas = screen.getByTestId('mock-btn-ver-rutas');
    expect(btnVerRutas).toHaveTextContent(/ver rutas sugeridas/i);

    fireEvent.click(btnVerRutas);
    await waitFor(() => {
      expect(screen.getByTestId('mock-rutas-sugeridas-lista')).toBeInTheDocument();
    });
  });
});

describe('Reparto de caja: mapa y contadores solo con pedidos activos, sin teléfonos ni coordenadas en pantalla', () => {
  const local = { lat: -12.0196436, lng: -76.963255 };
  const base = {
    modalidad: 'DELIVERY',
    cliente_telefono: '987654321',
    direccion: 'Av. Test 123',
    referencia: null,
    zona: 'Z1',
    zona_id: '1',
    color: 'naranja',
    total: 45.0,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: true,
    paga_con: 50.0,
    repartidor_party_id: null,
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: null,
    creado_en: '2026-10-21T19:00:00Z',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Caja', rol: 'CAJERO' },
      permisos: ['repartos/ver', 'repartos/liquidar'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockImplementation((permiso: string) => ['repartos/ver', 'repartos/liquidar'].includes(permiso)),
    });
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(repartosApi, 'obtenerResumen').mockResolvedValue({ lados: {}, zonas: {} } as any);
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] } as any);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue({
      umbralRetrasadoMin: 20,
      umbralTardeMin: 30,
      umbralMuyTardeMin: 45,
      velocidadMediaKmH: 20,
      maxPedidosPorRepartidor: 3,
    });
  });

  it('el mapa y los contadores no incluyen ANULADO ni ENTREGADO aunque la lista los traiga', async () => {
    const listos = [
      { ...base, id: 'l1', codigo: 'CP-L1', cliente_nombre: 'Rosa Uno', estado: 'LISTO', lat: local.lat + 0.02, lng: local.lng, minutosEspera: 50 },
      { ...base, id: 'l2', codigo: 'CP-L2', cliente_nombre: 'Ana Dos', estado: 'LISTO', lat: local.lat, lng: local.lng + 0.02, minutosEspera: 25, repartidor_party_id: '102', repartidor: { id: '102', nombre: 'Luis' } },
      { ...base, id: 'l3', codigo: 'CP-L3', cliente_nombre: 'Eva Tres', estado: 'EN_CAMINO', lat: local.lat - 0.02, lng: local.lng, minutosEspera: 35, repartidor_party_id: '102', repartidor: { id: '102', nombre: 'Luis' } },
    ];
    const trampas = [
      { ...base, id: 'x1', codigo: 'CP-W021', cliente_nombre: 'Anulado Uno', estado: 'ANULADO', lat: local.lat + 0.01, lng: local.lng + 0.01, minutosEspera: 80 },
      { ...base, id: 'x2', codigo: 'CP-W076', cliente_nombre: 'Entregado Dos', estado: 'ENTREGADO', lat: local.lat + 0.01, lng: local.lng - 0.01, minutosEspera: 90 },
    ];
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([listos[0]] as any);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([...listos, ...trampas] as any);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pin-l1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pin-l2')).toBeInTheDocument();
    expect(screen.getByTestId('pin-l3')).toBeInTheDocument();
    expect(screen.queryByTestId('pin-x1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pin-x2')).not.toBeInTheDocument();

    // Contadores: 1 retrasado (25), 1 tarde (35), 1 muy tarde (50); los anulados de 80 y 90 min no cuentan
    fireEvent.click(screen.getByRole('button', { name: 'Espera: Todos' }));
    expect(screen.getByRole('option', { name: /^Retrasado/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /^Tarde/ })).toHaveTextContent('1');
    expect(screen.getByRole('option', { name: /^Muy tarde/ })).toHaveTextContent('1');
    fireEvent.keyDown(document, { key: 'Escape' });

    // Ningún teléfono ni número largo visible en la página
    const texto = document.body.textContent || '';
    expect(texto).not.toContain('987654321');
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toMatch(/-?\d+\.\d{3,}/);
  });

  it('un nombre que es un teléfono se muestra como cliente sin nombre, sin el número', async () => {
    const pedido = { ...base, id: 'n1', codigo: 'CP-N1', cliente_nombre: '792627476-1', estado: 'LISTO', lat: local.lat + 0.02, lng: local.lng, minutosEspera: 10 };
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([pedido] as any);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([pedido] as any);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pin-n1')).toHaveTextContent('Cliente sin nombre');
    });
    expect(document.body.textContent || '').not.toContain('792627476');
  });

  it('Ver rutas sugeridas muestra varias rutas, incluida la más cercana, y ninguna tiene coordenadas en el texto', async () => {
    const enSector = (id: string, dLat: number, dLng: number, espera: number) => ({
      ...base, id, codigo: `CP-${id.toUpperCase()}`, cliente_nombre: `Cliente ${id}`, estado: 'LISTO',
      lat: local.lat + dLat, lng: local.lng + dLng, minutosEspera: espera,
    });
    const disponibles = [
      enSector('norte', 0.02, 0, 50),
      enSector('este', 0, 0.02, 32),
      enSector('sur', -0.02, 0, 22),
      enSector('oeste', 0, -0.02, 5),
    ];
    vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue(disponibles as any);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue(disponibles as any);

    render(
      <MemoryRouter>
        <RepartosView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('contador-cola-espera')).toHaveTextContent(/4 pedidos esperando repartidor/i);
    });

    fireEvent.click(screen.getByTestId('mock-btn-ver-rutas'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-rutas-sugeridas-lista')).toBeInTheDocument();
    });
    const botones = screen.getByTestId('mock-rutas-sugeridas-lista').querySelectorAll('button');
    expect(botones.length).toBeGreaterThanOrEqual(3);
    const textos = Array.from(botones).map((b) => b.textContent || '');
    expect(textos.some((t) => t.includes('Ruta más cercana'))).toBe(true);
    expect(textos.some((t) => t.includes('Ruta Norte'))).toBe(true);
    for (const t of textos) {
      expect(t).not.toMatch(/-?\d+\.\d{3,}/);
    }
  });
});
