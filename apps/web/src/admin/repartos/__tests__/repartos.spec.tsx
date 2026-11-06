import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaReparto } from '../TarjetaReparto';
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
        puedeTomar={true}
        alActualizar={vi.fn()}
      />,
    );

    const botonTomar = screen.getByRole('button', { name: /tomar como repartidor/i });
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

  it('ausencia de coordenadas GPS en el DOM en TarjetaReparto y ResumenPedidoReparto', () => {
    const pedidoConCoords: PedidoReparto = {
      ...pedidoEjemplo,
      lat: -12.045678,
      lng: -77.034567,
    };

    const { container: containerTarjeta } = render(
      <TarjetaReparto pedido={pedidoConCoords} alActualizar={vi.fn()} esDisponible={true} puedeTomar={true} />,
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
        puedeTomar={true}
        alActualizar={vi.fn()}
      />,
    );
    expect(containerResumen.textContent).not.toMatch(/-12\.\d+/);
    expect(containerResumen.textContent).not.toMatch(/-77\.\d+/);
  });

  it('muestra alerta ámbar de tomado sin salir y ofrece Soltar / reasignar solo a quien puede', async () => {
    const pedidoConAlerta: PedidoReparto = {
      ...pedidoEjemplo,
      estado: 'LISTO',
      repartidor_party_id: '99',
      repartidor: { id: '99', nombre: 'Juan Repartidor' },
      tomado_en: '2026-10-21T18:00:00Z',
      alerta_tomado_sin_salir: true,
      minutos_sin_salir: 14,
    };

    const alSoltar = vi.fn();
    const { rerender } = render(
      <TarjetaReparto pedido={pedidoConAlerta} esDisponible={false} puedeLiquidar={true} alActualizar={vi.fn()} />,
    );

    const alerta = screen.getByTestId('alerta-tomado-sin-salir');
    expect(alerta).toHaveTextContent(/tomado hace 14 min sin salir \(posible repartidor desconectado\)/i);
    // Sin alSoltar (p. ej. supervisor) no hay botón de excepción
    expect(screen.queryByRole('button', { name: /soltar \/ reasignar/i })).not.toBeInTheDocument();

    rerender(
      <TarjetaReparto pedido={pedidoConAlerta} esDisponible={false} puedeLiquidar={true} alSoltar={alSoltar} alActualizar={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /soltar \/ reasignar/i })[0]);
    expect(alSoltar).toHaveBeenCalledWith(pedidoConAlerta);
  });

});
