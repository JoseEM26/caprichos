import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepartosView } from '../RepartosView';
import { TarjetaReparto } from '../TarjetaReparto';
import { ModalReportarFalla } from '../ModalReportarFalla';
import { repartosApi, PedidoReparto } from '../repartosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { ErrorApi } from '../../../comun/api';

describe('Ola F5: Repartos', () => {
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
        return ['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar'].includes(permiso);
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

    // Botón "Tomar pedido"
    const botonTomar = screen.getByRole('button', { name: /tomar pedido/i });
    fireEvent.click(botonTomar);

    // Modal de confirmación Sí/No
    expect(screen.getByText('¿Tomar este pedido?')).toBeInTheDocument();
    const botonConfirmar = screen.getByRole('button', { name: /sí, confirmar/i });
    fireEvent.click(botonConfirmar);

    // Debe mostrar el mensaje de límite de pedidos
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

    // Selecciona NO_CONTESTA (seleccionado por defecto)
    const selectMotivo = screen.getByLabelText(/motivo del incidente/i);
    expect(selectMotivo).toHaveValue('NO_CONTESTA');

    // Intenta enviar con 0 llamadas
    const botonEnviar = screen.getByRole('button', { name: /reportar entrega fallida/i });
    fireEvent.click(botonEnviar);

    // Debe rechazar y mostrar advertencia
    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    // Registra 1 llamada
    const botonLlamada = screen.getByRole('button', { name: /\+ registrar llamada/i });
    fireEvent.click(botonLlamada);

    // Intenta enviar de nuevo con solo 1 llamada
    fireEvent.click(botonEnviar);
    expect(
      screen.getByText(
        'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
      ),
    ).toBeInTheDocument();
    expect(reportarMock).not.toHaveBeenCalled();

    // Registra la 2da llamada
    fireEvent.click(botonLlamada);

    // Ahora sí debe permitir continuar a la confirmación
    fireEvent.click(botonEnviar);

    // Aparece el modal de confirmación Sí/No
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

  it('muestra tiempo de espera con color, vuelto a llevar y avisos pendientes de enviar', async () => {
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

    // Tiempo de espera (36 min naranja)
    expect(screen.getByText(/36 min \(espera\)/i)).toBeInTheDocument();

    // Vuelto a llevar
    expect(screen.getByText(/llevar vuelto s\/ 5\.00/i)).toBeInTheDocument();

    // Ver avisos
    const botonAvisos = screen.getByRole('button', { name: /avisos al cliente/i });
    fireEvent.click(botonAvisos);

    await waitFor(() => {
      expect(screen.getByText(/PENDIENTE DE ENVIAR \(no se envía nada real\)/i)).toBeInTheDocument();
    });
  });

  it('muestra la ruta sugerida de entrega como lista de paradas con distancia aproximada (sin mapa)', async () => {
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValueOnce({
      pedidos: [
        {
          ...pedidoEjemplo,
          id: '101',
          codigo: 'CP-0101',
          estado: 'EN_CAMINO',
        },
        {
          ...pedidoEjemplo,
          id: '102',
          codigo: 'CP-0102',
          cliente_nombre: 'Pedro Gomez',
          estado: 'EN_CAMINO',
          lat: -12.05,
          lng: -77.035,
        },
      ],
      orden: ['101', '102'],
      paso: ['101', '102'],
      ruta: [
        [-12.045, -77.03],
        [-12.05, -77.035],
      ],
    });

    render(<RepartosView />);

    // Cambia a pestaña "Mis pedidos"
    const tabMios = screen.getByRole('tab', { name: /mis pedidos/i });
    fireEvent.click(tabMios);

    await waitFor(() => {
      expect(screen.getByText(/ruta sugerida de entrega/i)).toBeInTheDocument();
      expect(screen.getByText(/sin mapa en esta ola/i)).toBeInTheDocument();
      expect(screen.getAllByText(/CP-0101/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/CP-0102/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
