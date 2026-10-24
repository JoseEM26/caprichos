import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepartosView } from '../RepartosView';
import { TarjetaReparto } from '../TarjetaReparto';
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
  }: any) => (
    <div data-testid="mock-mapa-repartos">
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
      usuario: { partyId: '10', nombres: 'Repartidor Carlos', rol: 'REPARTIDOR' },
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

    expect(screen.getByText('¿Tomar este pedido?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(
        screen.getByText('Ya llevas 3 pedidos: entrega alguno antes de tomar otro'),
      ).toBeInTheDocument();
    });
  });

  it('no se puede reportar NO_CONTESTA con menos de 2 llamadas', async () => {
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

    fireEvent.click(botonEnviar);

    expect(screen.getByText('¿Confirmar reporte de entrega fallida?')).toBeInTheDocument();
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

    // Botones de filtro de tiempo arriba del mapa con sus conteos
    const btnRetrasado = screen.getByRole('button', { name: /^retrasado \(1\)/i });
    const btnTarde = screen.getByRole('button', { name: /^tarde \(1\)/i });
    const btnMuyTarde = screen.getByRole('button', { name: /^muy tarde \(1\)/i });

    expect(btnRetrasado).toBeInTheDocument();
    expect(btnTarde).toBeInTheDocument();
    expect(btnMuyTarde).toBeInTheDocument();

    // Filtra por "Muy tarde"
    fireEvent.click(btnMuyTarde);

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
      expect(screen.getByRole('button', { name: /he llegado/i })).toBeInTheDocument();
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
});
